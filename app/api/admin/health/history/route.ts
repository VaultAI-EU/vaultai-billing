import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, healthReports, user } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";

/**
 * GET /api/admin/health/history?instance_url=xxx&hours=24
 *
 * Retourne l'historique des rapports de santé d'une instance pour les graphiques.
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
    const instanceUrl = searchParams.get("instance_url");
    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    if (!instanceUrl) {
      return NextResponse.json(
        { error: "instance_url parameter required" },
        { status: 400 }
      );
    }

    const reports = await db
      .select({
        memory_rss_mb: healthReports.memory_rss_mb,
        memory_heap_used_mb: healthReports.memory_heap_used_mb,
        memory_heap_total_mb: healthReports.memory_heap_total_mb,
        memory_heap_limit_mb: healthReports.memory_heap_limit_mb,
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
          eq(healthReports.instance_url, instanceUrl),
          gte(healthReports.reported_at, since)
        )
      )
      .orderBy(healthReports.reported_at);

    return NextResponse.json({
      success: true,
      instance_url: instanceUrl,
      reports,
    });
  } catch (error) {
    console.error("[Admin Health History] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
