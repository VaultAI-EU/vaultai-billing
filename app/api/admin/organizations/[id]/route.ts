import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, usageReports, user } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/admin/organizations/[id]
 * 
 * Récupère les détails d'une organisation avec ses rapports d'usage
 */
export async function GET(
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

    const { id } = await params;

    // Récupérer l'organisation
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Récupérer les rapports d'usage (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const reports = await db
      .select()
      .from(usageReports)
      .where(eq(usageReports.organization_id, id))
      .orderBy(desc(usageReports.reported_at))
      .limit(100); // Limiter à 100 rapports récents

    // Calculer les statistiques
    const totalReports = reports.length;
    const latestReport = reports[0];
    const avgUsers = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.user_count, 0) / reports.length)
      : 0;
    const maxUsers = reports.length > 0
      ? Math.max(...reports.map(r => r.user_count))
      : 0;

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        instance_url: org.instance_url,
        stripe_customer_id: org.stripe_customer_id,
        stripe_subscription_id: org.stripe_subscription_id,
        deployment_type: org.deployment_type,
        billing_period: org.billing_period,
        subscription_status: org.subscription_status,
        admin_email: org.admin_email,
        trial_end: org.trial_end,
        created_at: org.created_at,
        updated_at: org.updated_at,
      },
      statistics: {
        total_reports: totalReports,
        latest_report: latestReport
          ? {
              user_count: latestReport.user_count,
              reported_at: latestReport.reported_at,
            }
          : null,
        avg_users: avgUsers,
        max_users: maxUsers,
      },
      reports: reports.map(report => ({
        id: report.id,
        user_count: report.user_count,
        deployment_type: report.deployment_type,
        reported_at: report.reported_at,
        stripe_meter_event_id: report.stripe_meter_event_id,
      })),
    });
  } catch (error) {
    console.error("[Admin] Error fetching organization:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

