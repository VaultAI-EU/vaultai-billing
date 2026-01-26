import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/config";
import { db, organizations } from "@/lib/db";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";

/**
 * GET /api/organizations/:id/invoices
 *
 * Récupère les factures Stripe (passées et à venir) pour une organisation.
 * Endpoint accessible aux instances VaultAI via le token universel.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;

    // Vérifier l'authentification avec le token universel
    const authHeader = request.headers.get("authorization");
    if (!authenticateRequest(authHeader)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Récupérer l'organisation
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json({
        success: true,
        invoices: { paid: [], pending: [] },
        message: "Organization not found in billing system",
      });
    }

    // Vérifier que l'organisation est liée à Stripe
    if (!org.stripe_customer_id) {
      return NextResponse.json({
        success: true,
        invoices: { paid: [], pending: [] },
        message: "Organization not linked to Stripe",
      });
    }

    // Récupérer les factures payées
    const paidInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      status: "paid",
      limit: 20,
    });

    // Récupérer les factures en attente (open)
    const openInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      status: "open",
      limit: 10,
    });

    // Récupérer les factures draft (à venir)
    const draftInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      status: "draft",
      limit: 5,
    });

    // Combiner open et draft pour "pending"
    const pendingInvoices = [...openInvoices.data, ...draftInvoices.data];

    // Formater les factures
    const formatInvoice = (invoice: any) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount_due: invoice.amount_due / 100,
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
    });

    console.log(
      `[Invoices] Fetched ${paidInvoices.data.length} paid, ${pendingInvoices.length} pending invoices for org ${org.id}`
    );

    return NextResponse.json({
      success: true,
      invoices: {
        paid: paidInvoices.data.map(formatInvoice),
        pending: pendingInvoices.map(formatInvoice),
      },
    });
  } catch (error) {
    console.error("[Invoices] Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
