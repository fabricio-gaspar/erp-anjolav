import { useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { useAsaasCharges } from "@/hooks/useAsaas";
import {
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

const DashboardCobrancas = () => {
  const { data: charges = [], isLoading } = useAsaasCharges();

  const stats = useMemo(() => {
    const received = charges.filter(
      (c) => c.status === "RECEIVED" || c.status === "CONFIRMED"
    );
    const pending = charges.filter((c) => c.status === "PENDING");
    const overdue = charges.filter((c) => c.status === "OVERDUE");

    return {
      totalReceived: received.reduce((sum, c) => sum + Number(c.value), 0),
      totalPending: pending.reduce((sum, c) => sum + Number(c.value), 0),
      totalOverdue: overdue.reduce((sum, c) => sum + Number(c.value), 0),
      countReceived: received.length,
      countPending: pending.length,
      countOverdue: overdue.length,
      total: charges.reduce((sum, c) => sum + Number(c.value), 0),
    };
  }, [charges]);

  const timelineData = useMemo(() => {
    const monthlyData: Record<
      string,
      { month: string; recebido: number; pendente: number; vencido: number }
    > = {};

    charges.forEach((charge) => {
      const date = new Date(charge.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: monthLabel, recebido: 0, pendente: 0, vencido: 0 };
      }

      const value = Number(charge.value);
      if (charge.status === "RECEIVED" || charge.status === "CONFIRMED") {
        monthlyData[monthKey].recebido += value;
      } else if (charge.status === "OVERDUE") {
        monthlyData[monthKey].vencido += value;
      } else {
        monthlyData[monthKey].pendente += value;
      }
    });

    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);
  }, [charges]);

  const pieData = useMemo(() => {
    return [
      { name: "Recebido", value: stats.totalReceived, color: "hsl(var(--success))" },
      { name: "Pendente", value: stats.totalPending, color: "hsl(var(--warning))" },
      { name: "Vencido", value: stats.totalOverdue, color: "hsl(var(--destructive))" },
    ].filter((item) => item.value > 0);
  }, [stats]);

  const billingTypeData = useMemo(() => {
    const grouped: Record<string, { type: string; total: number; count: number }> = {};

    charges.forEach((charge) => {
      const type = charge.billing_type;
      if (!grouped[type]) {
        grouped[type] = { type: type === "BOLETO_PIX" ? "Boleto + PIX" : type, total: 0, count: 0 };
      }
      grouped[type].total += Number(charge.value);
      grouped[type].count += 1;
    });

    return Object.values(grouped);
  }, [charges]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <AppLayout title="Dashboard de Cobranças">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard de Cobranças">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Geral
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(stats.total)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {charges.length} cobranças
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recebido
                </p>
                <p className="text-2xl font-bold text-success mt-1">
                  {formatCurrency(stats.totalReceived)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.countReceived} cobranças
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pendente
                </p>
                <p className="text-2xl font-bold text-amber-600 mt-1">
                  {formatCurrency(stats.totalPending)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.countPending} cobranças
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vencido
                </p>
                <p className="text-2xl font-bold text-destructive mt-1">
                  {formatCurrency(stats.totalOverdue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.countOverdue} cobranças
                </p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Chart */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Evolução Mensal
            </h3>
            {timelineData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorPendente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorVencido" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(value)
                    }
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="recebido"
                    name="Recebido"
                    stroke="hsl(var(--success))"
                    fill="url(#colorRecebido)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="pendente"
                    name="Pendente"
                    stroke="#f59e0b"
                    fill="url(#colorPendente)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="vencido"
                    name="Vencido"
                    stroke="hsl(var(--destructive))"
                    fill="url(#colorVencido)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Pie Chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              Distribuição por Status
            </h3>
            {pieData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Billing Type Chart */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Por Forma de Pagamento</h3>
            {billingTypeData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={billingTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    tickFormatter={(value) =>
                      new Intl.NumberFormat("pt-BR", {
                        notation: "compact",
                        compactDisplay: "short",
                      }).format(value)
                    }
                  />
                  <YAxis type="category" dataKey="type" width={100} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    fill="hsl(var(--primary))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Últimas Cobranças</h3>
            <div className="space-y-3">
              {charges.slice(0, 5).map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{charge.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {charge.customer_name}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold">{formatCurrency(Number(charge.value))}</p>
                    <p
                      className={`text-xs ${
                        charge.status === "RECEIVED" || charge.status === "CONFIRMED"
                          ? "text-success"
                          : charge.status === "OVERDUE"
                          ? "text-destructive"
                          : "text-amber-600"
                      }`}
                    >
                      {charge.status === "RECEIVED" || charge.status === "CONFIRMED"
                        ? "Recebido"
                        : charge.status === "OVERDUE"
                        ? "Vencido"
                        : "Pendente"}
                    </p>
                  </div>
                </div>
              ))}
              {charges.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma cobrança registrada
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardCobrancas;
