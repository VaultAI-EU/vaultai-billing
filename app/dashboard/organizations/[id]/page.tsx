"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Settings, Unlink, FileText, ExternalLink, Pencil } from "lucide-react";

type Organization = {
  id: string;
  name: string;
  display_name: string | null;
  tags: string[];
  instance_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  deployment_type: string | null;
  billing_period: string | null;
  subscription_status: string;
  admin_email: string | null;
  trial_end: Date | null;
  created_at: Date;
  updated_at: Date;
};

type UsageReport = {
  id: string;
  user_count: number;
  deployment_type: string;
  reported_at: Date;
  stripe_meter_event_id: string | null;
};

type Invoice = {
  id: string;
  number: string | null;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: string;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  line_items: Array<{
    description: string | null;
    amount: number;
    quantity: number | null;
    period: {
      start: string | null;
      end: string | null;
    };
  }>;
};

type OrganizationDetails = {
  organization: Organization;
  statistics: {
    total_reports: number;
    latest_report: {
      user_count: number;
      reported_at: Date;
    } | null;
    avg_users: number;
    max_users: number;
  };
  reports: UsageReport[];
};

type InvoicesData = {
  invoices: {
    paid: Invoice[];
    pending: Invoice[];
  };
  upcoming_invoice: Invoice | null;
};

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<OrganizationDetails | null>(null);
  const [invoicesData, setInvoicesData] = useState<InvoicesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStripeSetup, setShowStripeSetup] = useState(false);
  const [stripeForm, setStripeForm] = useState({
    admin_email: "",
    deployment_type: "on-premise" as "on-premise" | "managed-cloud",
    billing_period: "monthly" as "monthly" | "yearly",
    trial_days: 4,
  });
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showDisplayNameEdit, setShowDisplayNameEdit] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [updatingDisplayName, setUpdatingDisplayName] = useState(false);
  const [showTagsEdit, setShowTagsEdit] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [updatingTags, setUpdatingTags] = useState(false);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    params.then((p) => setOrgId(p.id));
  }, [params]);

  useEffect(() => {
    if (session?.user && orgId) {
      fetchOrganization();
      fetchInvoices();
    }
  }, [session, orgId]);

  const fetchOrganization = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        credentials: "include", // Inclure les cookies pour l'authentification
      });
      if (!response.ok) {
        throw new Error("Failed to fetch organization");
      }
      const data = await response.json();
      setOrgData(data);
      setDisplayName(data.organization.display_name || "");
      setTags(data.organization.tags || []);
      if (data.organization.admin_email) {
        setStripeForm((prev) => ({
          ...prev,
          admin_email: data.organization.admin_email || "",
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    if (!orgId) return;
    try {
      setLoadingInvoices(true);
      const response = await fetch(`/api/admin/organizations/${orgId}/invoices`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch invoices");
      }
      const data = await response.json();
      setInvoicesData(data);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      // Ne pas bloquer l'affichage si les factures échouent
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleLinkToStripe = async () => {
    if (!orgId) return;
    try {
      setLinking(true);
      const response = await fetch(`/api/admin/organizations/${orgId}/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Inclure les cookies pour l'authentification
        body: JSON.stringify(stripeForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to link to Stripe");
      }

      const data = await response.json();
      setShowStripeSetup(false);
      await fetchOrganization(); // Refresh data
      await fetchInvoices(); // Refresh invoices
      alert("Organisation liée à Stripe avec succès !");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la liaison");
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkFromStripe = async () => {
    if (!orgId) return;
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer le lien avec Stripe ? La subscription sera annulée."
      )
    ) {
      return;
    }

    try {
      setUnlinking(true);
      const response = await fetch(
        `/api/admin/organizations/${orgId}/unlink`,
        {
          method: "POST",
          credentials: "include", // Inclure les cookies pour l'authentification
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unlink from Stripe");
      }

      await fetchOrganization(); // Refresh data
      setInvoicesData(null); // Clear invoices data
      alert("Lien avec Stripe supprimé avec succès !");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Erreur lors de la suppression du lien"
      );
    } finally {
      setUnlinking(false);
    }
  };

  const handleUpdateTags = async () => {
    if (!orgId) return;
    try {
      setUpdatingTags(true);
      const response = await fetch(
        `/api/admin/organizations/${orgId}/tags`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ tags }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tags");
      }

      await fetchOrganization();
      setShowTagsEdit(false);
      setNewTag("");
      alert("Tags mis à jour avec succès !");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour"
      );
    } finally {
      setUpdatingTags(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleUpdateDisplayName = async () => {
    if (!orgId) return;
    try {
      setUpdatingDisplayName(true);
      const response = await fetch(
        `/api/admin/organizations/${orgId}/display-name`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            display_name: displayName.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update display name");
      }

      await fetchOrganization();
      setShowDisplayNameEdit(false);
      alert("Nom d'affichage mis à jour avec succès !");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour"
      );
    } finally {
      setUpdatingDisplayName(false);
    }
  };

  const handleUpdateQuantity = async () => {
    if (!orgId || !orgData) return;
    
    // Utiliser le dernier rapport d'usage ou demander à l'utilisateur
    const latestUserCount = orgData.statistics.latest_report?.user_count || 0;
    const quantity = prompt(
      `Entrez le nombre d'utilisateurs à facturer:`,
      latestUserCount.toString()
    );

    if (!quantity || isNaN(Number(quantity)) || Number(quantity) < 0) {
      return;
    }

    const quantityNum = Number(quantity);

    if (
      !confirm(
        `Mettre à jour la quantité de la subscription Stripe à ${quantityNum} utilisateurs ?`
      )
    ) {
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch(
        `/api/admin/organizations/${orgId}/update-quantity`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ quantity: quantityNum }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update quantity");
      }

      const data = await response.json();
      await fetchOrganization(); // Refresh data
      await fetchInvoices(); // Refresh invoices
      
      alert(`✅ Quantité mise à jour avec succès : ${data.quantity} utilisateurs`);
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Erreur lors de la mise à jour"
      );
    } finally {
      setSyncing(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!session?.user || !orgData) {
    return null;
  }

  const org = orgData.organization;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" asChild>
              <Link href="/dashboard" className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au dashboard
              </Link>
            </Button>
          </div>

          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  {org.display_name || org.name}
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisplayNameEdit(true)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Modifier le nom d'affichage"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              {org.display_name && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Nom original: {org.name}
                </p>
              )}
              {org.instance_url && (
                <p className="text-gray-600 dark:text-gray-400 mb-2">{org.instance_url}</p>
              )}
              {org.tags && org.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {org.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tag === "exclude_from_stats" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowTagsEdit(true);
                  setTags(org.tags || []);
                }}
                className="mt-2"
              >
                <Settings className="h-4 w-4 mr-2" />
                Gérer les tags
              </Button>
            </div>
            <div className="flex gap-2">
              {!org.stripe_customer_id ? (
                <Button onClick={() => setShowStripeSetup(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurer Stripe
                </Button>
              ) : (
                <>
                       <Button
                         onClick={handleUpdateQuantity}
                         disabled={syncing}
                         variant="outline"
                       >
                         <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                         {syncing ? "Mise à jour..." : "Mettre à jour la quantité"}
                       </Button>
                  <Button
                    onClick={handleUnlinkFromStripe}
                    disabled={unlinking}
                    variant="destructive"
                  >
                    <Unlink className="h-4 w-4 mr-2" />
                    {unlinking ? "Suppression..." : "Supprimer le lien Stripe"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {error && (
            <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Statistiques */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm">Rapports totaux</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {orgData.statistics.total_reports}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm">Utilisateurs moyens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {orgData.statistics.avg_users}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm">Utilisateurs max</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {orgData.statistics.max_users}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm">Dernier rapport</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                  {orgData.statistics.latest_report?.user_count || "-"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Informations Stripe */}
          <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle>Informations Stripe</CardTitle>
              <CardDescription>
                Détails de la configuration Stripe pour cette organisation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Statut
                  </Label>
                  <div className="mt-2">
                    <Badge
                      variant={org.stripe_customer_id ? "default" : "secondary"}
                      className={
                        org.stripe_customer_id
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                      }
                    >
                      {org.stripe_customer_id ? "Liée" : "Non liée"}
                    </Badge>
                  </div>
                </div>
                {org.stripe_customer_id && (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Customer ID
                      </Label>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                        {org.stripe_customer_id}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Subscription ID
                      </Label>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                        {org.stripe_subscription_id || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Type de déploiement
                      </Label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {org.deployment_type || "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                        Période de facturation
                      </Label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {org.billing_period === "yearly"
                          ? "Annuel"
                          : org.billing_period === "monthly"
                            ? "Mensuel"
                            : "-"}
                      </p>
                    </div>
                    {org.trial_end && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                          Fin d'essai
                        </Label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {new Date(org.trial_end).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Factures Stripe */}
          {org.stripe_customer_id && (
            <Card className="mb-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Factures Stripe</CardTitle>
                    <CardDescription>
                      Factures passées, en attente et à venir
                    </CardDescription>
                  </div>
                  <Button
                    onClick={fetchInvoices}
                    variant="outline"
                    size="sm"
                    disabled={loadingInvoices}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingInvoices ? "animate-spin" : ""}`} />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Chargement des factures...
                  </div>
                ) : invoicesData ? (
                  <div className="space-y-6">
                    {/* Facture à venir */}
                    {invoicesData.upcoming_invoice && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Facture à venir
                        </h3>
                        <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {invoicesData.upcoming_invoice.number || "Facture à venir"}
                              </p>
                              {invoicesData.upcoming_invoice.period_start && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Période:{" "}
                                  {new Date(invoicesData.upcoming_invoice.period_start).toLocaleDateString("fr-FR")}
                                  {" - "}
                                  {invoicesData.upcoming_invoice.period_end &&
                                    new Date(invoicesData.upcoming_invoice.period_end).toLocaleDateString("fr-FR")}
                                </p>
                              )}
                              {invoicesData.upcoming_invoice.due_date && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Échéance:{" "}
                                  {new Date(invoicesData.upcoming_invoice.due_date).toLocaleDateString("fr-FR")}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {invoicesData.upcoming_invoice.amount_due.toFixed(2)} {invoicesData.upcoming_invoice.currency}
                              </p>
                              <Badge className="mt-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                À venir
                              </Badge>
                            </div>
                          </div>
                          {invoicesData.upcoming_invoice.line_items.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Détails:
                              </p>
                              {invoicesData.upcoming_invoice.line_items.map((item, idx) => (
                                <div key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                                  {item.description || "Ligne de facturation"}
                                  {item.quantity && item.quantity > 1 && (
                                    <span className="ml-2">× {item.quantity}</span>
                                  )}
                                  <span className="ml-2 font-medium">
                                    {item.amount.toFixed(2)} {invoicesData.upcoming_invoice!.currency}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Factures en attente */}
                    {invoicesData.invoices.pending.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Factures en attente ({invoicesData.invoices.pending.length})
                        </h3>
                        <div className="space-y-3">
                          {invoicesData.invoices.pending.map((invoice) => (
                            <div
                              key={invoice.id}
                              className="border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {invoice.number || invoice.id.slice(0, 12) + "..."}
                                  </p>
                                  {invoice.due_date && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      Échéance: {new Date(invoice.due_date).toLocaleDateString("fr-FR")}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right flex items-center gap-3">
                                  <div>
                                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                      {invoice.amount_due.toFixed(2)} {invoice.currency}
                                    </p>
                                    <Badge className="mt-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                      En attente
                                    </Badge>
                                  </div>
                                  {invoice.hosted_invoice_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                    >
                                      <a
                                        href={invoice.hosted_invoice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Factures payées */}
                    {invoicesData.invoices.paid.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                          Factures payées ({invoicesData.invoices.paid.length})
                        </h3>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Facture</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Période</TableHead>
                                <TableHead className="text-right">Montant</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {invoicesData.invoices.paid.map((invoice) => (
                                <TableRow key={invoice.id}>
                                  <TableCell className="font-medium">
                                    {invoice.number || invoice.id.slice(0, 12) + "..."}
                                  </TableCell>
                                  <TableCell className="text-gray-600 dark:text-gray-400">
                                    {new Date(invoice.created).toLocaleDateString("fr-FR")}
                                  </TableCell>
                                  <TableCell className="text-gray-600 dark:text-gray-400">
                                    {invoice.period_start && invoice.period_end ? (
                                      <>
                                        {new Date(invoice.period_start).toLocaleDateString("fr-FR", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                        {" - "}
                                        {new Date(invoice.period_end).toLocaleDateString("fr-FR", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </>
                                    ) : (
                                      "-"
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {invoice.amount_paid.toFixed(2)} {invoice.currency}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      {invoice.hosted_invoice_url && (
                                        <Button variant="link" size="sm" asChild>
                                          <a
                                            href={invoice.hosted_invoice_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                          >
                                            <ExternalLink className="h-4 w-4 mr-1" />
                                            Voir
                                          </a>
                                        </Button>
                                      )}
                                      {invoice.invoice_pdf && (
                                        <Button variant="link" size="sm" asChild>
                                          <a
                                            href={invoice.invoice_pdf}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                          >
                                            <FileText className="h-4 w-4 mr-1" />
                                            PDF
                                          </a>
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {/* Aucune facture */}
                    {!invoicesData.upcoming_invoice &&
                      invoicesData.invoices.pending.length === 0 &&
                      invoicesData.invoices.paid.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          Aucune facture disponible
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Erreur lors du chargement des factures
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Rapports d'usage */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Rapports d'usage</CardTitle>
                  <CardDescription>
                    Historique des rapports d'usage quotidiens
                  </CardDescription>
                </div>
                <Button onClick={fetchOrganization} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orgData.reports.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucun rapport d'usage trouvé
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Utilisateurs</TableHead>
                      <TableHead>Type de déploiement</TableHead>
                      <TableHead>Stripe Event ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgData.reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          {new Date(report.reported_at).toLocaleString("fr-FR")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {report.user_count}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {report.deployment_type}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                          {report.stripe_meter_event_id || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Edit Tags */}
      <Dialog open={showTagsEdit} onOpenChange={setShowTagsEdit}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Gérer les tags
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Ajoutez des tags pour organiser vos organisations. Le tag <strong>"exclude_from_stats"</strong> exclut cette organisation des analyses de revenus.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tags" className="text-gray-700 dark:text-gray-300">
                Tags actuels
              </Label>
              <div className="flex flex-wrap gap-2 p-3 border border-gray-300 dark:border-gray-600 rounded-md min-h-[60px]">
                {tags.length === 0 ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Aucun tag
                  </span>
                ) : (
                  tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={tag === "exclude_from_stats" ? "destructive" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_tag" className="text-gray-700 dark:text-gray-300">
                Ajouter un tag
              </Label>
              <div className="flex gap-2">
                <Input
                  id="new_tag"
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="exclude_from_stats, investor, dev, prod..."
                  className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
                <Button onClick={addTag} variant="outline">
                  Ajouter
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tags suggérés: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">exclude_from_stats</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">investor</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">dev</code>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">prod</code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowTagsEdit(false);
                setTags(org.tags || []);
                setNewTag("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateTags}
              disabled={updatingTags}
            >
              {updatingTags ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Edit Display Name */}
      <Dialog open={showDisplayNameEdit} onOpenChange={setShowDisplayNameEdit}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Modifier le nom d'affichage
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Définissez un nom personnalisé pour cette organisation. Laissez vide pour utiliser le nom original.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="display_name" className="text-gray-700 dark:text-gray-300">
                Nom d'affichage
              </Label>
              <Input
                id="display_name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={org.name}
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Nom original: {org.name}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDisplayNameEdit(false);
                setDisplayName(org.display_name || "");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpdateDisplayName}
              disabled={updatingDisplayName}
            >
              {updatingDisplayName ? "Mise à jour..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Setup Stripe */}
      <Dialog open={showStripeSetup} onOpenChange={setShowStripeSetup}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Configurer Stripe pour {org.display_name || org.name}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Liez cette organisation à un customer Stripe et créez une subscription.
              L'email indiqué sera utilisé comme contact principal pour les factures Stripe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin_email" className="text-gray-700 dark:text-gray-300">
                Email du contact facturation *
              </Label>
              <Input
                id="admin_email"
                type="email"
                value={stripeForm.admin_email}
                onChange={(e) =>
                  setStripeForm({ ...stripeForm, admin_email: e.target.value })
                }
                placeholder="billing@client.com"
                required
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Email du contact chez le client qui recevra les factures et notifications Stripe
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deployment_type" className="text-gray-700 dark:text-gray-300">
                Type de déploiement *
              </Label>
              <Select
                value={stripeForm.deployment_type}
                onValueChange={(value) =>
                  setStripeForm({
                    ...stripeForm,
                    deployment_type: value as "on-premise" | "managed-cloud",
                  })
                }
              >
                <SelectTrigger
                  id="deployment_type"
                  className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="on-premise" className="text-gray-900 dark:text-white">
                    On-premise
                  </SelectItem>
                  <SelectItem value="managed-cloud" className="text-gray-900 dark:text-white">
                    Managed Cloud
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing_period" className="text-gray-700 dark:text-gray-300">
                Période de facturation *
              </Label>
              <Select
                value={stripeForm.billing_period}
                onValueChange={(value) =>
                  setStripeForm({
                    ...stripeForm,
                    billing_period: value as "monthly" | "yearly",
                  })
                }
              >
                <SelectTrigger
                  id="billing_period"
                  className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectItem value="monthly" className="text-gray-900 dark:text-white">
                    Mensuel
                  </SelectItem>
                  <SelectItem value="yearly" className="text-gray-900 dark:text-white">
                    Annuel
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trial_days" className="text-gray-700 dark:text-gray-300">
                Jours d'essai (défaut: 4)
              </Label>
              <Input
                id="trial_days"
                type="number"
                value={stripeForm.trial_days}
                onChange={(e) =>
                  setStripeForm({
                    ...stripeForm,
                    trial_days: parseInt(e.target.value) || 4,
                  })
                }
                min="0"
                max="30"
                className="bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowStripeSetup(false)}
              disabled={linking}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Annuler
            </Button>
            <Button
              onClick={handleLinkToStripe}
              disabled={linking || !stripeForm.admin_email}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {linking ? "Liaison..." : "Lier à Stripe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
