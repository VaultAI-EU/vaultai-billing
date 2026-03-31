import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, healthReports, user } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

const DOWN_THRESHOLD_MINUTES = 30;

/**
 * GET /api/admin/health
 *
 * Récupère le dernier rapport de santé de chaque instance (par instance_url).
 * Une instance peut héberger plusieurs organisations.
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

    // Récupérer les instances distinctes depuis health_reports
    const distinctInstances = await db
      .selectDistinct({ instance_url: healthReports.instance_url })
      .from(healthReports);

    // Pour chaque instance, récupérer le dernier rapport
    const instances = await Promise.all(
      distinctInstances.map(async ({ instance_url }) => {
        const [latest] = await db
          .select()
          .from(healthReports)
          .where(eq(healthReports.instance_url, instance_url))
          .orderBy(desc(healthReports.reported_at))
          .limit(1);

        const lastSeenMinutesAgo = latest
          ? Math.round(
              (Date.now() - new Date(latest.reported_at).getTime()) / 60000
            )
          : null;

        const isPotentiallyDown =
          lastSeenMinutesAgo === null ||
          lastSeenMinutesAgo > DOWN_THRESHOLD_MINUTES;

        // Trouver les orgs sur cette instance
        const orgsOnInstance = await db
          .select({
            id: organizations.id,
            name: organizations.name,
            display_name: organizations.display_name,
            subscription_status: organizations.subscription_status,
            hidden: organizations.hidden,
          })
          .from(organizations)
          .where(eq(organizations.instance_url, instance_url));

        return {
          instance_url,
          organizations: orgsOnInstance.map((o) => ({
            id: o.id,
            name: o.display_name || o.name,
            subscription_status: o.subscription_status,
            hidden: o.hidden,
          })),
          status: isPotentiallyDown
            ? "down"
            : latest?.status || "unknown",
          memory_rss_mb: latest?.memory_rss_mb ?? null,
          memory_heap_used_mb: latest?.memory_heap_used_mb ?? null,
          memory_heap_total_mb: latest?.memory_heap_total_mb ?? null,
          memory_external_mb: latest?.memory_external_mb ?? null,
          cpu_user_percent: latest?.cpu_user_percent ?? null,
          cpu_system_percent: latest?.cpu_system_percent ?? null,
          uptime_seconds: latest?.uptime_seconds ?? null,
          node_version: latest?.node_version ?? null,
          reported_at: latest?.reported_at ?? null,
          last_seen_minutes_ago: lastSeenMinutesAgo,
          is_potentially_down: isPotentiallyDown,
        };
      })
    );

    const withReports = instances.filter((i) => i.reported_at !== null);

    const summary = {
      total_instances: instances.length,
      reporting: withReports.length,
      healthy: withReports.filter((i) => i.status === "healthy").length,
      warning: withReports.filter((i) => i.status === "warning").length,
      unhealthy: withReports.filter((i) => i.status === "unhealthy").length,
      down: withReports.filter((i) => i.status === "down").length,
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
