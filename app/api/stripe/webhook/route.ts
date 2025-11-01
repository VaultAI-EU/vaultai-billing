import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db, organizations } from "@/lib/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

/**
 * POST /api/stripe/webhook
 * 
 * Webhook Stripe pour synchroniser les changements de subscription
 * (paiement réussi, échoué, annulation, etc.)
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.vaultai_organization_id;

        if (orgId) {
          await db
            .update(organizations)
            .set({
              stripe_subscription_id: subscription.id,
              subscription_status:
                subscription.status === "trialing"
                  ? "trial"
                  : subscription.status === "active"
                    ? "active"
                    : subscription.status === "past_due"
                      ? "past_due"
                      : "canceled",
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
              updated_at: new Date(),
            })
            .where(eq(organizations.id, orgId));
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.vaultai_organization_id;

        if (orgId) {
          await db
            .update(organizations)
            .set({
              subscription_status: "canceled",
              updated_at: new Date(),
            })
            .where(eq(organizations.id, orgId));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (customerId) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.stripe_customer_id, customerId))
            .limit(1);

          if (org) {
            await db
              .update(organizations)
              .set({
                subscription_status: "past_due",
                updated_at: new Date(),
              })
              .where(eq(organizations.id, org.id));
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (customerId) {
          const [org] = await db
            .select()
            .from(organizations)
            .where(eq(organizations.stripe_customer_id, customerId))
            .limit(1);

          if (org && org.subscription_status === "past_due") {
            await db
              .update(organizations)
              .set({
                subscription_status: "active",
                updated_at: new Date(),
              })
              .where(eq(organizations.id, org.id));
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

