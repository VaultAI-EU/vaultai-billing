import { NextRequest, NextResponse } from "next/server";
import { db, organizations } from "@/lib/db";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { generateBillingToken } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * POST /api/organizations/register
 * 
 * Enregistre une nouvelle organisation et crée un customer Stripe
 * avec une subscription en période d'essai (4 jours)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organization_id,
      organization_name,
      email,
      deployment_type = "on-premise",
      plan_type = "managed-cloud", // ou "self-hosted"
    } = body;

    if (!organization_id || !organization_name || !email) {
      return NextResponse.json(
        { error: "Missing required fields: organization_id, organization_name, email" },
        { status: 400 }
      );
    }

    // Vérifier si l'organisation existe déjà
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organization_id))
      .limit(1);

    if (existingOrg) {
      return NextResponse.json({
        success: true,
        organization_id: existingOrg.id,
        billing_token: existingOrg.billing_token,
        stripe_customer_id: existingOrg.stripe_customer_id,
        stripe_subscription_id: existingOrg.stripe_subscription_id,
      });
    }

    // Générer un token unique pour cette organisation
    const billingToken = generateBillingToken();

    // Créer un customer Stripe
    const customer = await stripe.customers.create({
      email,
      name: organization_name,
      metadata: {
        vaultai_organization_id: organization_id,
        vaultai_organization_name: organization_name,
        deployment_type,
        plan_type,
      },
    });

    // Sélectionner le bon price selon le plan et le type
    const priceId =
      plan_type === "managed-cloud"
        ? STRIPE_PRICES.MANAGED_CLOUD_MONTHLY
        : STRIPE_PRICES.SELF_HOSTED_MONTHLY;

    // Créer une subscription avec période d'essai de 4 jours
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 4,
      metadata: {
        vaultai_organization_id: organization_id,
        deployment_type,
        plan_type,
      },
    });

    // Calculer la date de fin d'essai (4 jours)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 4);

    // Stocker l'organisation dans la DB
    const [newOrg] = await db
      .insert(organizations)
      .values({
        id: organization_id,
        name: organization_name,
        billing_token: billingToken,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        deployment_type: deployment_type as "on-premise" | "managed-cloud",
        plan_type: plan_type as "managed-cloud" | "self-hosted",
        subscription_status: "trial",
        trial_end: trialEnd,
      })
      .returning();

    return NextResponse.json({
      success: true,
      organization_id: newOrg.id,
      billing_token: newOrg.billing_token,
      stripe_customer_id: newOrg.stripe_customer_id,
      stripe_subscription_id: newOrg.stripe_subscription_id,
      trial_end: newOrg.trial_end?.toISOString(),
    });
  } catch (error) {
    console.error("Error registering organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

