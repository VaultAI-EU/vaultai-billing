import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";

/**
 * GET /api/admin/organizations
 * 
 * Liste toutes les organisations avec leur statut de liaison Stripe
 * Endpoint admin pour voir quelles orgs doivent être liées manuellement
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification admin
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
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

    // Récupérer toutes les organisations
    const allOrgs = await db
      .select()
      .from(organizations)
      .orderBy(organizations.created_at);

    // Séparer les organisations liées et non liées
    const linked = allOrgs.filter(org => org.stripe_customer_id);
    const pending = allOrgs.filter(org => !org.stripe_customer_id);

    return NextResponse.json({
      summary: {
        total: allOrgs.length,
        linked: linked.length,
        pending: pending.length,
      },
      organizations: {
        linked: linked.map(org => ({
          id: org.id,
          name: org.name,
          instance_url: org.instance_url,
          stripe_customer_id: org.stripe_customer_id,
          stripe_subscription_id: org.stripe_subscription_id,
          deployment_type: org.deployment_type,
          plan_type: org.plan_type,
          subscription_status: org.subscription_status,
          admin_email: org.admin_email,
          created_at: org.created_at,
        })),
        pending: pending.map(org => ({
          id: org.id,
          name: org.name,
          instance_url: org.instance_url,
          subscription_status: org.subscription_status,
          created_at: org.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("[Admin] Error fetching organizations:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

