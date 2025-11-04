import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/admin/organizations/[id]/unlink
 *
 * Supprime le lien entre une organisation et Stripe
 * Annule la subscription et garde le customer pour historique
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

    // Vérifier si déjà non lié
    if (!org.stripe_customer_id || !org.stripe_subscription_id) {
      return NextResponse.json(
        {
          error: "Organization is not linked to Stripe",
        },
        { status: 400 }
      );
    }

    console.log(
      `[Admin] Unlinking organization ${org.name} from Stripe...`
    );

    // Annuler la subscription Stripe
    try {
      await stripe.subscriptions.cancel(org.stripe_subscription_id);
      console.log(
        `[Admin] Cancelled Stripe subscription: ${org.stripe_subscription_id}`
      );
    } catch (stripeError) {
      console.error(
        "[Admin] Error cancelling subscription:",
        stripeError
      );
      // On continue quand même pour nettoyer la DB
    }

    // Mettre à jour l'organisation dans la DB pour supprimer le lien
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        stripe_customer_id: null,
        stripe_subscription_id: null,
        subscription_status: "pending",
        deployment_type: null,
        billing_period: null,
        trial_end: null,
        updated_at: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();

    console.log(
      `[Admin] ✅ Organization ${org.name} successfully unlinked from Stripe`
    );

    return NextResponse.json({
      success: true,
      message: "Organization unlinked from Stripe successfully",
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        stripe_customer_id: updatedOrg.stripe_customer_id,
        stripe_subscription_id: updatedOrg.stripe_subscription_id,
        subscription_status: updatedOrg.subscription_status,
      },
    });
  } catch (error) {
    console.error("[Admin] Error unlinking organization:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

