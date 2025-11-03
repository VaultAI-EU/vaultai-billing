import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations } from "@/lib/db";
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
 *   plan_type: "managed-cloud" | "self-hosted",
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

    if (!session?.user || session.user.role !== "admin") {
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
      plan_type,
      trial_days = 4,
    } = body;

    // Validation
    if (!admin_email || !deployment_type || !plan_type) {
      return NextResponse.json(
        { error: "Missing required fields: admin_email, deployment_type, plan_type" },
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
        plan_type,
      },
    });

    console.log(`[Admin] Created Stripe customer: ${customer.id}`);

    // Sélectionner le bon price selon le plan
    const priceId =
      plan_type === "managed-cloud"
        ? STRIPE_PRICES.MANAGED_CLOUD_MONTHLY
        : STRIPE_PRICES.SELF_HOSTED_MONTHLY;

    // Créer une subscription avec période d'essai
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: trial_days,
      metadata: {
        vaultai_organization_id: organizationId,
        deployment_type,
        plan_type,
      },
    });

    console.log(`[Admin] Created Stripe subscription: ${subscription.id}`);

    // Calculer la date de fin d'essai
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trial_days);

    // Mettre à jour l'organisation dans la DB
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        admin_email,
        deployment_type: deployment_type as "on-premise" | "managed-cloud",
        plan_type: plan_type as "managed-cloud" | "self-hosted",
        subscription_status: "trial",
        trial_end: trialEnd,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    console.log(`[Admin] ✅ Organization ${org.name} successfully linked to Stripe`);

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
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

