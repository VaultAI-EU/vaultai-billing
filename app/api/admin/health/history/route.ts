import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, healthReports, user } from "@/lib/db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

/**
 * GET /api/admin/health/history?org_id=xxx&hours=24
 *
 * Retourne l'historique des rapports de santé pour les graphiques.
 * Si org_id est fourni, retourne l'historique de cette org.
 * Sinon, retourne l'historique agrégé de toutes les orgs.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("org_id");
    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (orgId) {
      // History for a specific organization
      const reports = await db
        .select({
          memory_rss_mb: healthReports.memory_rss_mb,
          memory_heap_used_mb: healthReports.memory_heap_used_mb,
          memory_heap_total_mb: healthReports.memory_heap_total_mb,
          memory_external_mb: healthReports.memory_external_mb,
          cpu_user_percent: healthReports.cpu_user_percent,
          cpu_system_percent: healthReports.cpu_system_percent,
          uptime_seconds: healthReports.uptime_seconds,
          status: healthReports.status,
          reported_at: healthReports.reported_at,
        })
        .from(healthReports)
        .where(
          and(
            eq(healthReports.organization_id, orgId),
            gte(healthReports.reported_at, since)
          )
        )
        .orderBy(healthReports.reported_at);

      return NextResponse.json({ success: true, org_id: orgId, reports });
    }

    // All orgs — get latest + recent history per org
    const allOrgs = await db
      .select({ id: organizations.id, name: organizations.name, display_name: organizations.display_name })
      .from(organizations)
      .orderBy(organizations.name);

    const orgHistories = await Promise.all(
      allOrgs.map(async (org) => {
        const reports = await db
          .select({
            memory_rss_mb: healthReports.memory_rss_mb,
            memory_heap_used_mb: healthReports.memory_heap_used_mb,
            memory_heap_total_mb: healthReports.memory_heap_total_mb,
            cpu_user_percent: healthReports.cpu_user_percent,
            cpu_system_percent: healthReports.cpu_system_percent,
            uptime_seconds: healthReports.uptime_seconds,
            status: healthReports.status,
            reported_at: healthReports.reported_at,
          })
          .from(healthReports)
          .where(
            and(
              eq(healthReports.organization_id, org.id),
              gte(healthReports.reported_at, since)
            )
          )
          .orderBy(healthReports.reported_at);

        return {
          organization_id: org.id,
          organization_name: org.display_name || org.name,
          reports,
        };
      })
    );

    // Filter out orgs with no reports
    const withData = orgHistories.filter((o) => o.reports.length > 0);

    return NextResponse.json({ success: true, organizations: withData });
  } catch (error) {
    console.error("[Admin Health History] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
