import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

/**
 * POST /api/admin/organizations/[id]/link
 *
 * Lie manuellement une organisation à un customer Stripe
 * et crée une subscription
 *
 * Body:
 * {
 *   admin_email: string,
 *   deployment_type: "on-premise" | "managed-cloud",
 *   billing_period: "monthly" | "yearly",
 *   trial_days?: number (default: 4)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification admin
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer l'utilisateur depuis la DB pour obtenir le rôle
    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (!dbUser || dbUser.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      );
    }

    const { id: organizationId } = await params;
    const body = await request.json();
    const {
      admin_email,
      deployment_type,
      billing_period,
      trial_days = 4,
    } = body;

    // Validation
    if (!admin_email || !deployment_type || !billing_period) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: admin_email, deployment_type, billing_period",
        },
        { status: 400 }
      );
    }

    // Validation des valeurs
    if (
      deployment_type !== "on-premise" &&
      deployment_type !== "managed-cloud"
    ) {
      return NextResponse.json(
        { error: "deployment_type must be 'on-premise' or 'managed-cloud'" },
        { status: 400 }
      );
    }

    if (billing_period !== "monthly" && billing_period !== "yearly") {
      return NextResponse.json(
        { error: "billing_period must be 'monthly' or 'yearly'" },
        { status: 400 }
      );
    }

    // Récupérer l'organisation
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Vérifier si déjà lié
    if (org.stripe_customer_id) {
      return NextResponse.json(
        {
          error: "Organization already linked to Stripe",
          stripe_customer_id: org.stripe_customer_id,
        },
        { status: 400 }
      );
    }

    console.log(`[Admin] Linking organization ${org.name} to Stripe...`);

    // Créer un customer Stripe
    const customer = await stripe.customers.create({
      email: admin_email,
      name: org.name,
      metadata: {
        vaultai_organization_id: organizationId,
        vaultai_organization_name: org.name,
        instance_url: org.instance_url || "unknown",
        deployment_type,
        billing_period,
      },
    });

    console.log(`[Admin] Created Stripe customer: ${customer.id}`);

    // Sélectionner le bon price selon deployment_type et billing_period
    let priceId: string;
    if (deployment_type === "managed-cloud") {
      priceId =
        billing_period === "yearly"
          ? STRIPE_PRICES.MANAGED_CLOUD_YEARLY
          : STRIPE_PRICES.MANAGED_CLOUD_MONTHLY;
    } else {
      // on-premise (self-hosted)
      priceId =
        billing_period === "yearly"
          ? STRIPE_PRICES.SELF_HOSTED_YEARLY
          : STRIPE_PRICES.SELF_HOSTED_MONTHLY;
    }

    // Créer une subscription avec période d'essai
    // Utilisation de "send_invoice" pour permettre la facturation sans carte bancaire
    // Les factures seront envoyées par email et le client paiera via un lien de paiement
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: trial_days,
      collection_method: "send_invoice", // Envoie les factures par email au lieu de prélever automatiquement
      days_until_due: 30, // Le client a 30 jours pour payer après réception de la facture
      metadata: {
        vaultai_organization_id: organizationId,
        deployment_type,
        billing_period,
      },
    });

    console.log(`[Admin] Created Stripe subscription: ${subscription.id}`);

    // Récupérer le subscription_item_id (nécessaire pour les meter events)
    const subscriptionItemId = subscription.items.data[0]?.id;
    if (!subscriptionItemId) {
      throw new Error("Failed to get subscription item ID");
    }
    console.log(`[Admin] Subscription item ID: ${subscriptionItemId}`);

    // Calculer la date de fin d'essai
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trial_days);

    // Mettre à jour l'organisation dans la DB
    // On stocke le subscription_item_id dans les metadata pour pouvoir l'utiliser plus tard
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        admin_email,
        deployment_type: deployment_type as "on-premise" | "managed-cloud",
        billing_period: billing_period as "monthly" | "yearly",
        subscription_status: "trial",
        trial_end: trialEnd,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    console.log(
      `[Admin] ✅ Organization ${org.name} successfully linked to Stripe`
    );

    return NextResponse.json({
      success: true,
      message: "Organization linked to Stripe successfully",
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        stripe_customer_id: updatedOrg.stripe_customer_id,
        stripe_subscription_id: updatedOrg.stripe_subscription_id,
        subscription_status: updatedOrg.subscription_status,
        trial_end: updatedOrg.trial_end,
      },
    });
  } catch (error) {
    console.error("[Admin] Error linking organization:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
