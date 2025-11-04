import { NextRequest, NextResponse } from "next/server";
import { db, organizations, usageReports } from "@/lib/db";
import { eq } from "drizzle-orm";
import { authenticateRequest } from "@/lib/config";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/usage-report
 * 
 * Endpoint simplifié pour recevoir les rapports d'usage des instances VaultAI
 * 
 * Architecture:
 * - Authentification par token API universel (même pour toutes les instances)
 * - Pas de billing_token par organisation
 * - Le deployment_type est géré uniquement côté billing
 * - Création/mise à jour automatique de l'organisation
 * - Enregistrement du rapport d'usage
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification avec le token universel
    const authHeader = request.headers.get("authorization");
    if (!authenticateRequest(authHeader)) {
      console.error("[Usage Report] Unauthorized request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      organization_id,
      organization_name,
      instance_url,
      user_count,
      timestamp,
    } = body;

    // Validation
    if (!organization_id || !organization_name || user_count === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: organization_id, organization_name, user_count" },
        { status: 400 }
      );
    }

    console.log(`[Usage Report] Received report from ${organization_name} (${organization_id}): ${user_count} users`);

    // Vérifier si l'organisation existe déjà
    const [existingOrg] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organization_id))
      .limit(1);

    if (existingOrg) {
      // Mettre à jour l'organisation existante (nom et URL peuvent changer)
      await db
        .update(organizations)
        .set({
          name: organization_name,
          instance_url: instance_url || existingOrg.instance_url,
          updated_at: new Date(),
        })
        .where(eq(organizations.id, organization_id));
      
      console.log(`[Usage Report] Updated existing organization: ${organization_name}`);
    } else {
      // Créer une nouvelle organisation (statut "pending" jusqu'à liaison manuelle avec Stripe)
      await db
        .insert(organizations)
        .values({
          id: organization_id,
          name: organization_name,
          instance_url: instance_url || null,
          subscription_status: "pending", // En attente de liaison manuelle
          stripe_customer_id: null,
          stripe_subscription_id: null,
          deployment_type: null, // Sera défini manuellement par l'admin
          billing_period: null, // Sera défini manuellement par l'admin
        });
      
      console.log(`[Usage Report] Created new organization: ${organization_name} (pending manual setup)`);
    }

    // Si l'organisation est liée à Stripe, mettre à jour la quantité directement
    if (existingOrg?.stripe_customer_id && existingOrg?.stripe_subscription_id) {
      try {
        console.log(
          `[Usage Report] Organization linked to Stripe, updating subscription quantity to ${user_count} users...`
        );

        // Récupérer la subscription depuis Stripe pour obtenir le subscription_item_id
        let subscriptionItemId: string | null = null;
        try {
          const subscription = await stripe.subscriptions.retrieve(
            existingOrg.stripe_subscription_id
          );
          subscriptionItemId = subscription.items.data[0]?.id || null;

          if (subscriptionItemId) {
            // Mettre à jour la quantité directement sur le subscription_item
            await stripe.subscriptionItems.update(subscriptionItemId, {
              quantity: user_count,
            });

            console.log(
              `[Usage Report] ✅ Subscription quantity updated to ${user_count} users (item: ${subscriptionItemId})`
            );
          } else {
            console.error(
              "[Usage Report] No subscription item found for subscription"
            );
          }
        } catch (stripeError: any) {
          console.error(
            "[Usage Report] Error updating subscription quantity:",
            {
              error: stripeError.message,
              code: stripeError.code,
              user_count,
            }
          );
          // On continue quand même pour sauvegarder le rapport localement
        }
      } catch (stripeError: any) {
        console.error(
          "[Usage Report] Error updating subscription in Stripe:",
          {
            error: stripeError.message,
            code: stripeError.code,
            user_count,
          }
        );
        // On continue quand même pour sauvegarder le rapport localement
      }
    }

    // Enregistrer le rapport d'usage
    const [report] = await db
      .insert(usageReports)
      .values({
        organization_id,
        user_count,
        deployment_type: existingOrg?.deployment_type || "unknown",
        reported_at: timestamp ? new Date(timestamp) : new Date(),
        stripe_meter_event_id: null, // On n'utilise plus les meter events, on met à jour directement la quantité
      })
      .returning();

    console.log(`[Usage Report] ✅ Report saved for ${organization_name}: ${user_count} users`);

    return NextResponse.json({
      success: true,
      message: "Usage report received",
      report_id: report.id,
      organization_status: existingOrg ? 
        (existingOrg.stripe_customer_id ? "linked" : "pending") : 
        "pending",
    });
  } catch (error) {
    console.error("[Usage Report] Error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

