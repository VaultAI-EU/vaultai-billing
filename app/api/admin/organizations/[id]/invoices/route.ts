import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db, organizations, user } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/admin/organizations/[id]/invoices
 *
 * Récupère les factures Stripe (passées et à venir) pour une organisation
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
    if (!org.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        invoices: [],
        upcoming_invoice: null,
        message: "Organization not linked to Stripe",
      });
    }

    // Récupérer les factures passées
    const pastInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      status: "paid",
      limit: 50,
    });

    // Récupérer les factures en attente (draft, open, uncollectible)
    const pendingInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      status: "open",
      limit: 50,
    });

    // Récupérer la prochaine facture à venir (upcoming invoice)
    let upcomingInvoice = null;
    if (org.stripe_subscription_id) {
      try {
        // Utiliser la méthode correcte pour récupérer la facture à venir
        const upcomingInvoices = await stripe.invoices.list({
          customer: org.stripe_customer_id,
          subscription: org.stripe_subscription_id,
          status: "draft",
          limit: 1,
        });
        
        if (upcomingInvoices.data.length > 0) {
          upcomingInvoice = upcomingInvoices.data[0];
        } else {
          // Essayer de récupérer via l'API preview
          try {
            const subscription = await stripe.subscriptions.retrieve(
              org.stripe_subscription_id
            );
            // Si on a une facture en cours de préparation, elle sera dans les invoices drafts
            // Sinon, on peut essayer de créer une preview
            const preview = await stripe.invoices.upcoming({
              customer: org.stripe_customer_id,
              subscription: org.stripe_subscription_id,
            });
            upcomingInvoice = preview;
          } catch (previewError: any) {
            // Si pas de facture à venir (ex: période d'essai), ignorer l'erreur
            if (previewError.code !== "invoice_upcoming_none") {
              console.error("[Invoices] Error retrieving upcoming invoice:", previewError);
            }
          }
        }
      } catch (error: any) {
        // Si pas de facture à venir (ex: période d'essai), ignorer l'erreur
        if (error.code !== "invoice_upcoming_none") {
          console.error("[Invoices] Error retrieving upcoming invoice:", error);
        }
      }
    }

    // Formater les factures pour la réponse
    const formatInvoice = (invoice: any) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount_due: invoice.amount_due / 100, // Convertir de centimes en euros
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency.toUpperCase(),
      created: new Date(invoice.created * 1000).toISOString(),
      due_date: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString()
        : null,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      line_items: invoice.lines?.data?.map((line: any) => ({
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity,
        period: {
          start: line.period?.start
            ? new Date(line.period.start * 1000).toISOString()
            : null,
          end: line.period?.end
            ? new Date(line.period.end * 1000).toISOString()
            : null,
        },
      })) || [],
    });

    return NextResponse.json({
      success: true,
      invoices: {
        paid: pastInvoices.data.map(formatInvoice),
        pending: pendingInvoices.data.map(formatInvoice),
      },
      upcoming_invoice: upcomingInvoice ? formatInvoice(upcomingInvoice) : null,
    });
  } catch (error) {
    console.error("[Admin] Error fetching invoices:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

