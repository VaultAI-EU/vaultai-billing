import { NextRequest, NextResponse } from "next/server";
import { authenticateOrganization } from "@/lib/auth";
import { db, usageReports } from "@/lib/db";
import { stripe, METER_EVENT_NAME } from "@/lib/stripe";
import { eq } from "drizzle-orm";

/**
 * POST /api/meter-events
 * 
 * Reçoit les rapports d'usage quotidiens depuis les instances VaultAI
 * et les forward vers Stripe Billing API
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const billingToken = authHeader.replace("Bearer ", "");
    const org = await authenticateOrganization(billingToken);

    if (!org) {
      return NextResponse.json(
        { error: "Invalid billing token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organization_id, user_count, deployment_type, timestamp } = body;

    // Validation
    if (!organization_id || typeof user_count !== "number" || user_count < 0) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    if (org.id !== organization_id) {
      return NextResponse.json(
        { error: "Organization ID mismatch" },
        { status: 403 }
      );
    }

    // Vérifier que l'organisation a un customer Stripe
    if (!org.stripe_customer_id) {
      return NextResponse.json(
        { error: "Organization not registered with Stripe" },
        { status: 400 }
      );
    }

    // Envoyer le meter event à Stripe
    let stripeMeterEventId: string | null = null;
    try {
      const meterEvent = await stripe.billing.meterEvents.create({
        event_name: METER_EVENT_NAME,
        payload: {
          stripe_customer_id: org.stripe_customer_id,
          value: user_count.toString(),
          // Dimensions optionnelles pour analytics
          deployment_type: deployment_type || org.deployment_type,
        },
        timestamp: timestamp 
          ? Math.floor(new Date(timestamp).getTime() / 1000)
          : Math.floor(Date.now() / 1000),
      }) as any;

      stripeMeterEventId = meterEvent.id;
    } catch (stripeError) {
      console.error("Error sending meter event to Stripe:", stripeError);
      // On continue quand même pour stocker le rapport localement
    }

    // Stocker le rapport localement pour analytics
    const [report] = await db
      .insert(usageReports)
      .values({
        organization_id: org.id,
        user_count,
        deployment_type: deployment_type || org.deployment_type,
        stripe_meter_event_id: stripeMeterEventId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      report_id: report.id,
      stripe_meter_event_id: stripeMeterEventId,
    });
  } catch (error) {
    console.error("Error processing meter event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

