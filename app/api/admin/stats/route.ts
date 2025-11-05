import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, usageReports, user } from "@/lib/db";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

/**
 * GET /api/admin/stats
 *
 * Récupère les statistiques globales :
 * - Revenus passés (factures payées)
 * - Revenus futurs du mois en cours
 * - Nombre total d'utilisateurs
 * - Évolution dans le temps
 */
export async function GET(request: NextRequest) {
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

    // Récupérer les prix depuis Stripe pour calculer les revenus futurs
    const prices = await Promise.all([
      stripe.prices.retrieve(STRIPE_PRICES.MANAGED_CLOUD_MONTHLY),
      stripe.prices.retrieve(STRIPE_PRICES.MANAGED_CLOUD_YEARLY),
      stripe.prices.retrieve(STRIPE_PRICES.SELF_HOSTED_MONTHLY),
      stripe.prices.retrieve(STRIPE_PRICES.SELF_HOSTED_YEARLY),
    ]);

    const priceMap = {
      managedCloudMonthly: prices[0].unit_amount! / 100, // 45€
      managedCloudYearly: prices[1].unit_amount! / 100, // 425€
      selfHostedMonthly: prices[2].unit_amount! / 100, // 20€
      selfHostedYearly: prices[3].unit_amount! / 100, // 170€
    };

    // 1. Calculer les revenus passés (factures payées)
    // Exclure les organisations avec le tag "exclude_from_stats"
    const allOrgs = await db
      .select()
      .from(organizations)
      .where(
        sql`${organizations.stripe_customer_id} IS NOT NULL 
        AND (
          ${organizations.tags} IS NULL 
          OR NOT (${organizations.tags}::jsonb ? 'exclude_from_stats')
        )`
      );

    let totalPastRevenue = 0;
    for (const org of allOrgs) {
      try {
        const invoices = await stripe.invoices.list({
          customer: org.stripe_customer_id!,
          status: "paid",
          limit: 100,
        });
        totalPastRevenue += invoices.data.reduce(
          (sum, inv) => sum + inv.amount_paid / 100,
          0
        );
      } catch (error) {
        console.error(
          `[Stats] Error fetching invoices for org ${org.id}:`,
          error
        );
      }
    }

    // 2. Calculer les revenus futurs pour le mois prochain
    // On utilise le dernier user_count de chaque organisation active pour projeter le mois suivant
    // Exclure les organisations avec le tag "exclude_from_stats"
    const activeOrgsForFuture = await db
      .select()
      .from(organizations)
      .where(
        sql`${organizations.stripe_customer_id} IS NOT NULL 
        AND ${organizations.subscription_status} IN ('active', 'trial')
        AND (
          ${organizations.tags} IS NULL 
          OR NOT (${organizations.tags}::jsonb ? 'exclude_from_stats')
        )`
      );

    let totalFutureRevenue = 0;
    for (const org of activeOrgsForFuture) {
      // Récupérer le dernier rapport d'usage
      const [latestReport] = await db
        .select()
        .from(usageReports)
        .where(eq(usageReports.organization_id, org.id))
        .orderBy(desc(usageReports.reported_at))
        .limit(1);

      if (latestReport && org.deployment_type && org.billing_period) {
        // Calculer le prix par user selon le type
        let pricePerUser = 0;
        if (org.deployment_type === "managed-cloud") {
          pricePerUser =
            org.billing_period === "yearly"
              ? priceMap.managedCloudYearly / 12 // Prix mensuel équivalent pour annuel
              : priceMap.managedCloudMonthly;
        } else {
          pricePerUser =
            org.billing_period === "yearly"
              ? priceMap.selfHostedYearly / 12 // Prix mensuel équivalent pour annuel
              : priceMap.selfHostedMonthly;
        }

        // Revenu estimé pour le mois prochain (mois complet)
        const revenueForNextMonth = latestReport.user_count * pricePerUser;
        totalFutureRevenue += revenueForNextMonth;
      }
    }

    // 3. Nombre total d'utilisateurs (dernier rapport de chaque org active)
    // Exclure les organisations avec le tag "exclude_from_stats"
    const activeOrgs = await db
      .select()
      .from(organizations)
      .where(
        sql`${organizations.subscription_status} IN ('active', 'trial')
        AND (
          ${organizations.tags} IS NULL 
          OR NOT (${organizations.tags}::jsonb ? 'exclude_from_stats')
        )`
      );

    let totalUsers = 0;
    for (const org of activeOrgs) {
      const [latestReport] = await db
        .select()
        .from(usageReports)
        .where(eq(usageReports.organization_id, org.id))
        .orderBy(desc(usageReports.reported_at))
        .limit(1);

      if (latestReport) {
        totalUsers += latestReport.user_count;
      }
    }

    // 4. Évolution dans le temps (30 derniers jours)
    // On affiche seulement les revenus estimés basés sur l'usage, pas les factures payées
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const evolutionData = await db
      .select({
        date: sql<string>`DATE(${usageReports.reported_at})`,
        total_users: sql<number>`SUM(${usageReports.user_count})`,
        total_orgs: sql<number>`COUNT(DISTINCT ${usageReports.organization_id})`,
      })
      .from(usageReports)
      .innerJoin(
        organizations,
        eq(usageReports.organization_id, organizations.id)
      )
      .where(
        and(
          gte(usageReports.reported_at, thirtyDaysAgo),
          sql`${organizations.subscription_status} IN ('active', 'trial')
          AND (
            ${organizations.tags} IS NULL 
            OR NOT (${organizations.tags}::jsonb ? 'exclude_from_stats')
          )`
        )
      )
      .groupBy(sql`DATE(${usageReports.reported_at})`)
      .orderBy(sql`DATE(${usageReports.reported_at})`);

    // Calculer les revenus estimés par jour pour l'évolution (basés sur l'usage, pas les factures)
    const evolutionWithRevenue = await Promise.all(
      evolutionData.map(async (day) => {
        // Récupérer les rapports de ce jour
        const dayStart = new Date(day.date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day.date);
        dayEnd.setHours(23, 59, 59, 999);

        const dayReports = await db
          .select({
            organization_id: usageReports.organization_id,
            user_count: usageReports.user_count,
            deployment_type: usageReports.deployment_type,
          })
          .from(usageReports)
          .innerJoin(
            organizations,
            eq(usageReports.organization_id, organizations.id)
          )
          .where(
            and(
              gte(usageReports.reported_at, dayStart),
              lte(usageReports.reported_at, dayEnd),
              sql`${organizations.stripe_customer_id} IS NOT NULL`,
              sql`${organizations.subscription_status} IN ('active', 'trial')
              AND (
                ${organizations.tags} IS NULL 
                OR NOT (${organizations.tags}::jsonb ? 'exclude_from_stats')
              )`
            )
          );

        // Calculer le revenu journalier estimé basé sur l'usage
        let dailyRevenue = 0;
        const orgDayMap = new Map<
          string,
          {
            count: number;
            deployment_type: string;
            billing_period: string | null;
          }
        >();

        for (const report of dayReports) {
          if (!orgDayMap.has(report.organization_id)) {
            const [org] = await db
              .select()
              .from(organizations)
              .where(eq(organizations.id, report.organization_id))
              .limit(1);

            if (org && org.deployment_type && org.billing_period) {
              orgDayMap.set(report.organization_id, {
                count: report.user_count,
                deployment_type: report.deployment_type,
                billing_period: org.billing_period,
              });
            }
          }
        }

        for (const [orgId, data] of orgDayMap) {
          let pricePerUser = 0;
          if (data.deployment_type === "managed-cloud") {
            pricePerUser =
              data.billing_period === "yearly"
                ? priceMap.managedCloudYearly / 365 // Prix journalier pour annuel
                : priceMap.managedCloudMonthly / 30; // Prix journalier pour mensuel
          } else {
            pricePerUser =
              data.billing_period === "yearly"
                ? priceMap.selfHostedYearly / 365 // Prix journalier pour annuel
                : priceMap.selfHostedMonthly / 30; // Prix journalier pour mensuel
          }
          dailyRevenue += data.count * pricePerUser;
        }

        return {
          date: day.date,
          users: Number(day.total_users) || 0,
          organizations: Number(day.total_orgs) || 0,
          revenue: Math.round(dailyRevenue * 100) / 100,
        };
      })
    );

    return NextResponse.json({
      success: true,
      stats: {
        pastRevenue: Math.round(totalPastRevenue * 100) / 100,
        futureRevenue: Math.round(totalFutureRevenue * 100) / 100,
        totalUsers,
        totalOrganizations: activeOrgs.length,
        evolution: evolutionWithRevenue,
      },
    });
  } catch (error) {
    console.error("[Admin] Error fetching stats:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
