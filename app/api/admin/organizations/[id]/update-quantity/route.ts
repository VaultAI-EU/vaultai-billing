import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/admin/organizations/[id]/update-quantity
 *
 * Met à jour la quantité du subscription_item directement dans Stripe.
 * Plus simple que les meter events - fonctionne pour tous les types de prix.
 *
 * Body:
 * {
 *   quantity: number (nombre d'utilisateurs à facturer)
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
    const { quantity } = body;

    // Validation
    if (typeof quantity !== "number" || quantity < 0) {
      return NextResponse.json(
        { error: "quantity must be a non-negative number" },
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

    // Vérifier que l'organisation est liée à Stripe
    if (!org.stripe_customer_id || !org.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Organization not linked to Stripe" },
        { status: 400 }
      );
    }

    console.log(
      `[Admin] Updating subscription quantity for ${org.name} to ${quantity} users...`
    );

    // Récupérer la subscription depuis Stripe pour obtenir le subscription_item_id
    let subscriptionItemId: string | null = null;
    try {
      const subscription = await stripe.subscriptions.retrieve(
        org.stripe_subscription_id
      );
      subscriptionItemId = subscription.items.data[0]?.id || null;

      if (!subscriptionItemId) {
        console.error(
          `[Admin] No subscription item found for subscription ${org.stripe_subscription_id}`
        );
        return NextResponse.json(
          { error: "No active subscription item found for this organization" },
          { status: 500 }
        );
      }
    } catch (stripeError: any) {
      console.error(
        "[Admin] Error retrieving subscription:",
        stripeError.message
      );
      return NextResponse.json(
        { error: "Failed to retrieve Stripe subscription details" },
        { status: 500 }
      );
    }

    // Mettre à jour la quantité du subscription_item
    try {
      const updatedItem = await stripe.subscriptionItems.update(
        subscriptionItemId,
        {
          quantity: quantity,
        }
      );

      console.log(
        `[Admin] ✅ Subscription quantity updated to ${quantity} users (item: ${updatedItem.id})`
      );

      return NextResponse.json({
        success: true,
        message: "Subscription quantity updated successfully",
        subscription_item_id: updatedItem.id,
        quantity: updatedItem.quantity,
      });
    } catch (stripeError: any) {
      console.error(
        "[Admin] Error updating subscription quantity:",
        stripeError.message
      );
      return NextResponse.json(
        {
          error: "Failed to update subscription quantity",
          details: stripeError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Admin] Error updating subscription quantity:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

