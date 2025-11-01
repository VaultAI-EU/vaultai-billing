import { NextRequest, NextResponse } from "next/server";
import { authenticateOrganization } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

/**
 * GET /api/organizations/:id/status
 * 
 * Retourne le statut de la subscription pour une organisation
 * Utilisé par les instances VaultAI pour afficher le statut billing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const billingToken = authHeader.replace("Bearer ", "");
    const org = await authenticateOrganization(billingToken);

    if (!org) {
      return NextResponse.json(
        { error: "Invalid billing token" },
        { status: 401 }
      );
    }

    if (org.id !== id) {
      return NextResponse.json(
        { error: "Organization ID mismatch" },
        { status: 403 }
      );
    }

    // Récupérer les infos de subscription depuis Stripe si disponible
    let subscriptionDetails = null;
    if (org.stripe_subscription_id) {
      try {
        const subscription = (await stripe.subscriptions.retrieve(
          org.stripe_subscription_id
        )) as any;

        subscriptionDetails = {
          status: subscription.status,
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        };
      } catch (error) {
        console.error("Error fetching subscription from Stripe:", error);
      }
    }

    // Calculer le statut de trial
    const isTrialActive =
      org.trial_end && new Date(org.trial_end) > new Date();

    return NextResponse.json({
      organization_id: org.id,
      organization_name: org.name,
      subscription_status: org.subscription_status,
      trial_active: isTrialActive,
      trial_end: org.trial_end?.toISOString() || null,
      plan_type: org.plan_type,
      deployment_type: org.deployment_type,
      stripe_subscription: subscriptionDetails,
    });
  } catch (error) {
    console.error("Error fetching organization status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

