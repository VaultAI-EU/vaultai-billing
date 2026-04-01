"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  Heart,
  AlertTriangle,
  WifiOff,
  ArrowLeft,
  RefreshCw,
  Server,
  Cpu,
  MemoryStick,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

// ─── Types ────────────────────────────────────────────────

type OrgInfo = {
  id: string;
  name: string;
  subscription_status: string | null;
  hidden: boolean;
};

type HealthInstance = {
  instance_url: string;
  organizations: OrgInfo[];
  status: string;
  memory_rss_mb: number | null;
  memory_heap_used_mb: number | null;
  memory_heap_total_mb: number | null;
  memory_heap_limit_mb: number | null;
  memory_external_mb: number | null;
  cpu_user_percent: number | null;
  cpu_system_percent: number | null;
  uptime_seconds: number | null;
  node_version: string | null;
  reported_at: string | null;
  last_seen_minutes_ago: number | null;
  is_potentially_down: boolean;
};

type HealthResponse = {
  success: boolean;
  summary: {
    total_instances: number;
    reporting: number;
    healthy: number;
    warning: number;
    unhealthy: number;
    down: number;
  };
  instances: HealthInstance[];
};

type HealthReport = {
  memory_rss_mb: number;
  memory_heap_used_mb: number;
  memory_heap_total_mb: number;
  memory_heap_limit_mb: number | null;
  cpu_user_percent: number | null;
  cpu_system_percent: number | null;
  uptime_seconds: number;
  status: string;
  reported_at: string;
};

// ─── Helpers ──────────────────────────────────────────────

function formatUptime(seconds: number | null): string {
  if (seconds === null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatLastSeen(minutes: number | null): string {
  if (minutes === null) return "Jamais";
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Components ───────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "healthy":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Heart className="h-3 w-3 mr-1" />
          Sain
        </Badge>
      );
    case "warning":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Attention
        </Badge>
      );
    case "unhealthy":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Critique
        </Badge>
      );
    case "down":
      return (
        <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <WifiOff className="h-3 w-3 mr-1" />
          Hors ligne
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Inconnu
        </Badge>
      );
  }
}

function MemoryBar({
  used,
  total,
}: {
  used: number | null;
  total: number | null;
}) {
  if (used === null || total === null || total === 0) return <span>—</span>;
  const percent = Math.round((used / total) * 100);
  const color =
    percent > 90
      ? "bg-red-500"
      : percent > 70
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
        {used}/{total} MB ({percent}%)
      </span>
    </div>
  );
}

function InstanceGraphs({ instanceUrl }: { instanceUrl: string }) {
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/health/history?instance_url=${encodeURIComponent(instanceUrl)}&hours=${hours}`,
        { credentials: "include" }
      );
      if (!res.ok) return;
      const json = await res.json();
      setReports(json.reports || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [instanceUrl, hours]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Chargement des graphiques...
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Aucune donnee historique disponible
      </div>
    );
  }

  const chartData = reports.map((r) => ({
    time: formatTime(r.reported_at),
    fullTime: new Date(r.reported_at).toLocaleString("fr-FR"),
    heap_used: r.memory_heap_used_mb,
    heap_total: r.memory_heap_total_mb,
    heap_limit: r.memory_heap_limit_mb,
    rss: r.memory_rss_mb,
    cpu_user: r.cpu_user_percent ?? 0,
    cpu_system: r.cpu_system_percent ?? 0,
    cpu_total: (r.cpu_user_percent ?? 0) + (r.cpu_system_percent ?? 0),
    uptime_hours: Math.round((r.uptime_seconds / 3600) * 10) / 10,
  }));

  return (
    <div className="space-y-4 pt-4">
      {/* Time range selector */}
      <div className="flex gap-2 justify-end">
        {[1, 6, 12, 24, 48, 168].map((h) => (
          <Button
            key={h}
            variant={hours === h ? "default" : "outline"}
            size="sm"
            onClick={() => setHours(h)}
            className="text-xs"
          >
            {h < 24 ? `${h}h` : `${h / 24}j`}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Memory Chart */}
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MemoryStick className="h-4 w-4" />
              Memoire (MB)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullTime || ""
                  }
                  formatter={(value: any, name: any) => [
                    `${value} MB`,
                    name === "rss"
                      ? "RSS"
                      : name === "heap_used"
                        ? "Heap utilise"
                        : name === "heap_total"
                          ? "Heap alloue"
                          : "Limite V8",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) =>
                    value === "rss"
                      ? "RSS"
                      : value === "heap_used"
                        ? "Heap utilise"
                        : value === "heap_total"
                          ? "Heap alloue"
                          : "Limite V8"
                  }
                />
                {chartData[0]?.heap_limit && (
                  <ReferenceLine
                    y={chartData[0].heap_limit}
                    stroke="#ef4444"
                    strokeDasharray="8 4"
                    strokeWidth={1.5}
                    label={{ value: `Limite: ${chartData[0].heap_limit} MB`, position: "right", fontSize: 10, fill: "#ef4444" }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="heap_total"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.1}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="heap_used"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="rss"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CPU Chart */}
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              CPU (%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(0,0,0,0.8)",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.fullTime || ""
                  }
                  formatter={(value: any, name: any) => [
                    `${value}%`,
                    name === "cpu_user"
                      ? "CPU User"
                      : name === "cpu_system"
                        ? "CPU System"
                        : "CPU Total",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px" }}
                  formatter={(value) =>
                    value === "cpu_user"
                      ? "User"
                      : value === "cpu_system"
                        ? "System"
                        : "Total"
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cpu_total"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="cpu_user"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="cpu_system"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Uptime Chart - full width */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Uptime (heures)
          </CardTitle>
          <CardDescription className="text-xs">
            Un reset indique un redemarrage de l'instance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(0,0,0,0.8)",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "12px",
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullTime || ""
                }
                formatter={(value: any) => [`${value}h`, "Uptime"]}
              />
              <Line
                type="monotone"
                dataKey="uptime_hours"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function HealthDashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedInstance, setExpandedInstance] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/admin/health", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch health data");
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchHealth();
      const interval = setInterval(fetchHealth, 60000);
      return () => clearInterval(interval);
    }
  }, [session]);

  if (isPending || !session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Retour
                </a>
              </Button>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                Monitoring Instances
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  fetchHealth();
                }}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Rafraichir
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {session.user.email}
              </span>
              <Button variant="destructive" asChild>
                <a href="/api/auth/sign-out">Deconnexion</a>
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {loading ? "..." : data?.summary.total_instances ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4 text-green-600" />
                  Saines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {loading ? "..." : data?.summary.healthy ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">
                  {loading ? "..." : data?.summary.warning ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Critiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {loading ? "..." : data?.summary.unhealthy ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-gray-500" />
                  Hors ligne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-500">
                  {loading ? "..." : data?.summary.down ?? 0}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Instances Table with expandable graphs */}
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Instances
              </CardTitle>
              <CardDescription>
                Cliquez sur une instance pour voir les graphiques. Donnees
                rafraichies toutes les 5 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">
                  Chargement...
                </p>
              ) : !data?.instances.length ? (
                <p className="text-muted-foreground py-8 text-center">
                  Aucune instance trouvee
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Instance</TableHead>
                      <TableHead>Organisations</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Heap</TableHead>
                      <TableHead>RSS</TableHead>
                      <TableHead>CPU</TableHead>
                      <TableHead>Uptime</TableHead>
                      <TableHead>Derniere activite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.instances.map((instance) => (
                      <>
                        <TableRow
                          key={instance.instance_url}
                          className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                            instance.is_potentially_down ? "opacity-60" : ""
                          } ${
                            expandedInstance === instance.instance_url
                              ? "bg-gray-50 dark:bg-gray-700/30"
                              : ""
                          }`}
                          onClick={() =>
                            setExpandedInstance(
                              expandedInstance === instance.instance_url
                                ? null
                                : instance.instance_url
                            )
                          }
                        >
                          <TableCell className="w-8">
                            {expandedInstance === instance.instance_url ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={
                                instance.instance_url.startsWith("http")
                                  ? instance.instance_url
                                  : `https://${instance.instance_url}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {instance.instance_url}
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {instance.organizations
                                .filter((o) => !o.hidden)
                                .map((org) => (
                                  <Badge
                                    key={org.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {org.name}
                                  </Badge>
                                ))}
                              {instance.organizations.filter((o) => o.hidden)
                                .length > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-gray-400"
                                >
                                  +
                                  {
                                    instance.organizations.filter(
                                      (o) => o.hidden
                                    ).length
                                  }{" "}
                                  masquees
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={instance.status} />
                          </TableCell>
                          <TableCell>
                            <MemoryBar
                              used={instance.memory_heap_used_mb}
                              total={instance.memory_heap_limit_mb}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {instance.memory_rss_mb !== null
                              ? `${instance.memory_rss_mb} MB`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {instance.cpu_user_percent !== null
                              ? `${instance.cpu_user_percent + (instance.cpu_system_percent ?? 0)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatUptime(instance.uptime_seconds)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatLastSeen(instance.last_seen_minutes_ago)}
                          </TableCell>
                        </TableRow>
                        {expandedInstance === instance.instance_url && (
                          <TableRow
                            key={`${instance.instance_url}-graphs`}
                          >
                            <TableCell
                              colSpan={9}
                              className="p-4 bg-gray-50/50 dark:bg-gray-800/50"
                            >
                              <InstanceGraphs
                                instanceUrl={instance.instance_url}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
