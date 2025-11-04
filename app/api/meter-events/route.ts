import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/config";
import { db, organizations, usageReports } from "@/lib/db";
import { stripe, METER_EVENT_NAME } from "@/lib/stripe";
import { eq } from "drizzle-orm";

/**
 * POST /api/meter-events
 * 
 * Reçoit les rapports d'usage quotidiens depuis les instances VaultAI
 * et les forward vers Stripe Billing API
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification avec le token universel
    const authHeader = request.headers.get("authorization");
    if (!authenticateRequest(authHeader)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organization_id, user_count, deployment_type, timestamp } = body;

    // Validation
    if (!organization_id || typeof user_count !== "number" || user_count < 0) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Récupérer l'organisation depuis la DB
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organization_id))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Vérifier que l'organisation a un customer Stripe et une subscription
    if (!org.stripe_customer_id || !org.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Organization not registered with Stripe" },
        { status: 400 }
      );
    }

    // Récupérer la subscription depuis Stripe pour obtenir le subscription_item_id
    let subscriptionItemId: string | null = null;
    try {
      const subscription = await stripe.subscriptions.retrieve(
        org.stripe_subscription_id
      );
      // Récupérer le premier subscription item (celui avec le metered price)
      subscriptionItemId = subscription.items.data[0]?.id || null;
      
      if (!subscriptionItemId) {
        console.error(
          `[Meter Events] No subscription item found for subscription ${org.stripe_subscription_id}`
        );
      }
    } catch (stripeError) {
      console.error(
        "[Meter Events] Error retrieving subscription:",
        stripeError
      );
    }

    // Envoyer le meter event à Stripe
    let stripeMeterEventId: string | null = null;
    try {
      // Pour les metered prices, on doit utiliser subscription_item_id dans le payload
      // pour que Stripe associe correctement l'event à la facture
      const payload: any = {
        value: user_count.toString(),
      };

      if (subscriptionItemId) {
        // Utiliser subscription_item_id si disponible (recommandé pour metered billing)
        payload.stripe_subscription_item_id = subscriptionItemId;
      } else {
        // Fallback sur customer_id si subscription_item_id n'est pas disponible
        payload.stripe_customer_id = org.stripe_customer_id;
      }

      // Dimensions optionnelles pour analytics
      if (deployment_type || org.deployment_type) {
        payload.deployment_type = deployment_type || org.deployment_type;
      }

      const meterEvent = await stripe.billing.meterEvents.create({
        event_name: METER_EVENT_NAME,
        payload,
        timestamp: timestamp
          ? Math.floor(new Date(timestamp).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      }) as any;

      stripeMeterEventId = meterEvent.id;
      console.log(
        `[Meter Events] ✅ Meter event created: ${stripeMeterEventId} for ${user_count} users`
      );
    } catch (stripeError: any) {
      console.error("[Meter Events] Error sending meter event to Stripe:", {
        error: stripeError.message,
        code: stripeError.code,
        user_count,
        subscription_item_id: subscriptionItemId,
      });
      // On continue quand même pour stocker le rapport localement
    }

    // Stocker le rapport localement pour analytics
    const [report] = await db
      .insert(usageReports)
      .values({
        organization_id: org.id,
        user_count,
        deployment_type: deployment_type || org.deployment_type,
        stripe_meter_event_id: stripeMeterEventId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      report_id: report.id,
      stripe_meter_event_id: stripeMeterEventId,
    });
  } catch (error) {
    console.error("Error processing meter event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

