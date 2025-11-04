import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, usageReports, user } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { stripe, METER_EVENT_NAME } from "@/lib/stripe";

/**
 * POST /api/admin/organizations/[id]/sync-meter-events
 *
 * Synchronise les rapports d'usage non envoyés vers Stripe
 * Envoie les meter events pour tous les rapports qui n'ont pas encore de stripe_meter_event_id
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

    // Vérifier que l'organisation est liée à Stripe
    if (!org.stripe_customer_id || !org.stripe_subscription_id) {
      return NextResponse.json(
        {
          error: "Organization is not linked to Stripe",
        },
        { status: 400 }
      );
    }

    console.log(
      `[Admin] Syncing meter events for organization ${org.name}...`
    );

    // Récupérer la subscription depuis Stripe pour obtenir le subscription_item_id
    let subscriptionItemId: string | null = null;
    try {
      const subscription = await stripe.subscriptions.retrieve(
        org.stripe_subscription_id
      );
      subscriptionItemId = subscription.items.data[0]?.id || null;

      if (!subscriptionItemId) {
        return NextResponse.json(
          { error: "Failed to get subscription item ID" },
          { status: 500 }
        );
      }
    } catch (stripeError) {
      console.error("[Admin] Error retrieving subscription:", stripeError);
      return NextResponse.json(
        { error: "Failed to retrieve subscription from Stripe" },
        { status: 500 }
      );
    }

    // Récupérer tous les rapports d'usage qui n'ont pas encore de stripe_meter_event_id
    const reportsToSync = await db
      .select()
      .from(usageReports)
      .where(
        and(
          eq(usageReports.organization_id, organizationId),
          isNull(usageReports.stripe_meter_event_id)
        )
      )
      .orderBy(usageReports.reported_at);

    if (reportsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No reports to sync",
        synced_count: 0,
      });
    }

    console.log(
      `[Admin] Found ${reportsToSync.length} reports to sync for ${org.name}`
    );

    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // Envoyer chaque rapport comme meter event
    for (const report of reportsToSync) {
      try {
        const payload: any = {
          value: report.user_count.toString(),
          stripe_subscription_item_id: subscriptionItemId,
        };

        if (report.deployment_type && report.deployment_type !== "unknown") {
          payload.deployment_type = report.deployment_type;
        }

        const meterEvent = await stripe.billing.meterEvents.create({
          event_name: METER_EVENT_NAME,
          payload,
          timestamp: Math.floor(report.reported_at.getTime() / 1000),
        }) as any;

        // Mettre à jour le rapport avec le meter_event_id
        await db
          .update(usageReports)
          .set({
            stripe_meter_event_id: meterEvent.id,
          })
          .where(eq(usageReports.id, report.id));

        syncedCount++;
        console.log(
          `[Admin] ✅ Synced report ${report.id}: ${report.user_count} users (${meterEvent.id})`
        );
      } catch (stripeError: any) {
        failedCount++;
        const errorMsg = `Report ${report.id}: ${stripeError.message}`;
        errors.push(errorMsg);
        console.error(`[Admin] ❌ Failed to sync report ${report.id}:`, {
          error: stripeError.message,
          code: stripeError.code,
        });
      }
    }

    console.log(
      `[Admin] ✅ Sync completed: ${syncedCount} synced, ${failedCount} failed`
    );

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} meter events to Stripe`,
      synced_count: syncedCount,
      failed_count: failedCount,
      total_reports: reportsToSync.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Admin] Error syncing meter events:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

