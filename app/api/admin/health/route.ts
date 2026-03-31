import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, healthReports, user } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

const DOWN_THRESHOLD_MINUTES = 30;

/**
 * GET /api/admin/health
 *
 * Récupère le dernier rapport de santé de chaque instance.
 * Protégé par authentification admin (session + rôle).
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

    // Récupérer toutes les organisations
    const allOrgs = await db
      .select()
      .from(organizations)
      .orderBy(organizations.name);

    // Pour chaque org, récupérer le dernier rapport de santé
    const instances = await Promise.all(
      allOrgs.map(async (org) => {
        const [latestHealth] = await db
          .select()
          .from(healthReports)
          .where(eq(healthReports.organization_id, org.id))
          .orderBy(desc(healthReports.reported_at))
          .limit(1);

        const lastSeenMinutesAgo = latestHealth
          ? Math.round((Date.now() - new Date(latestHealth.reported_at).getTime()) / 60000)
          : null;

        const isPotentiallyDown = lastSeenMinutesAgo === null || lastSeenMinutesAgo > DOWN_THRESHOLD_MINUTES;

        return {
          organization_id: org.id,
          organization_name: org.display_name || org.name,
          instance_url: org.instance_url,
          subscription_status: org.subscription_status,
          // Health data (null if no report yet)
          status: isPotentiallyDown ? "down" : latestHealth?.status || "unknown",
          memory_rss_mb: latestHealth?.memory_rss_mb ?? null,
          memory_heap_used_mb: latestHealth?.memory_heap_used_mb ?? null,
          memory_heap_total_mb: latestHealth?.memory_heap_total_mb ?? null,
          memory_external_mb: latestHealth?.memory_external_mb ?? null,
          cpu_user_percent: latestHealth?.cpu_user_percent ?? null,
          cpu_system_percent: latestHealth?.cpu_system_percent ?? null,
          uptime_seconds: latestHealth?.uptime_seconds ?? null,
          node_version: latestHealth?.node_version ?? null,
          reported_at: latestHealth?.reported_at ?? null,
          last_seen_minutes_ago: lastSeenMinutesAgo,
          is_potentially_down: isPotentiallyDown,
        };
      })
    );

    // Filtrer les instances qui ont au moins un rapport
    const withReports = instances.filter((i) => i.reported_at !== null);
    const withoutReports = instances.filter((i) => i.reported_at === null);

    const summary = {
      total_instances: allOrgs.length,
      reporting: withReports.length,
      healthy: withReports.filter((i) => i.status === "healthy").length,
      warning: withReports.filter((i) => i.status === "warning").length,
      unhealthy: withReports.filter((i) => i.status === "unhealthy").length,
      down: withReports.filter((i) => i.status === "down").length,
      never_reported: withoutReports.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      instances,
    });
  } catch (error) {
    console.error("[Admin Health] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
