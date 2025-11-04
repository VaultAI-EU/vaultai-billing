"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

type Organization = {
  id: string;
  name: string;
  instance_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  deployment_type: string | null;
  billing_period: string | null;
  subscription_status: string;
  admin_email: string | null;
  created_at: Date;
};

type OrganizationsResponse = {
  summary: {
    total: number;
    linked: number;
    pending: number;
  };
  organizations: {
    linked: Organization[];
    pending: Organization[];
  };
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [orgsData, setOrgsData] = useState<OrganizationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session?.user) {
      fetchOrganizations();
    }
  }, [session]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/organizations", {
        credentials: "include", // Inclure les cookies pour l'authentification
      });
      if (!response.ok) {
        throw new Error("Failed to fetch organizations");
      }
      const data = await response.json();
      setOrgsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const allOrgs = [
    ...(orgsData?.organizations.linked || []),
    ...(orgsData?.organizations.pending || []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Dashboard Billing
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {session.user.email}
              </span>
              <Button variant="destructive" asChild>
                <a href="/api/auth/sign-out">Déconnexion</a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-base">Organisations</CardTitle>
                <CardDescription>Total des organisations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {orgsData?.summary.total || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-base">Liées à Stripe</CardTitle>
                <CardDescription>Organisations configurées</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {orgsData?.summary.linked || 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-base">En attente</CardTitle>
                <CardDescription>À configurer</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {orgsData?.summary.pending || 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {error && (
            <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="pt-6">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Organisations</CardTitle>
                  <CardDescription>
                    Liste de toutes les organisations et leur statut
                  </CardDescription>
                </div>
                <Button onClick={fetchOrganizations} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {allOrgs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Aucune organisation trouvée
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Facturation</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allOrgs.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">
                          {org.name}
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {org.instance_url || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              org.stripe_customer_id ? "default" : "secondary"
                            }
                            className={
                              org.stripe_customer_id
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            }
                          >
                            {org.stripe_customer_id ? "Liée" : "En attente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-gray-600 dark:text-gray-400">
                          {org.billing_period === "yearly"
                            ? "Annuel"
                            : org.billing_period === "monthly"
                              ? "Mensuel"
                              : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="link" asChild>
                            <a href={`/dashboard/organizations/${org.id}`}>
                              Voir détails
                            </a>
                          </Button>
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
    </div>
  );
}
