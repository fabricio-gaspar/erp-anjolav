import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { FinanceCard } from "@/components/dashboard/FinanceCard";
import { ProductionBottleneck } from "@/components/dashboard/ProductionBottleneck";
import { OperationalCosts } from "@/components/dashboard/OperationalCosts";
import { ProcessingSummary } from "@/components/dashboard/ProcessingSummary";
import { DailySchedule } from "@/components/dashboard/DailySchedule";
import { FileText, AlertCircle, Users, Shirt, TrendingUp, TrendingDown } from "lucide-react";

const Dashboard = () => {
  // Mock data
  const kpis = [
    { title: "OS em Aberto", value: 2, icon: FileText, iconColor: "primary" as const },
    { title: "Entregas Atrasadas", value: 0, icon: AlertCircle, iconColor: "destructive" as const },
    { title: "Clientes Ativos", value: 3, icon: Users, iconColor: "info" as const },
    { title: "Peças Processadas Hoje", value: 0, icon: Shirt, iconColor: "success" as const },
  ];

  const receivableItems = [
    {
      id: "1",
      status: "vencida" as const,
      clientName: "FABRICIO GASPAR",
      value: 5.00,
      dueDate: "04/01",
    },
  ];

  const bottleneckItems = [
    {
      stage: "retirado",
      osCount: 1,
      piecesCount: 0,
      avgTime: "68.8h",
      percentage: 100,
    },
  ];

  const processingItems = [
    {
      clientName: "FABRICIO GASPAR",
      currentStage: "Retirado",
      timeInStage: "68h 49m",
      expectedDate: undefined,
      status: "on_time" as const,
    },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* KPIs Section */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Métricas Rápidas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi.title}
                value={kpi.value}
                icon={kpi.icon}
                iconColor={kpi.iconColor}
              />
            ))}
          </div>
        </section>

        {/* Finance Cards */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FinanceCard
            title="Contas a Receber"
            subtitle="1 pendentes"
            total={5.00}
            icon={TrendingUp}
            variant="receivable"
            items={receivableItems}
          />
          <FinanceCard
            title="Contas a Pagar"
            subtitle="0 pendentes"
            total={0}
            icon={TrendingDown}
            variant="payable"
            items={[]}
          />
        </section>

        {/* Production & Costs */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProductionBottleneck
            items={bottleneckItems}
            recommendation="A etapa está com alto volume. Considere realocar recursos ou priorizar esta fase."
          />
          <OperationalCosts
            month="janeiro/2026"
            revenue={0}
            expenses={0}
            profit={0}
            margin={0}
          />
        </section>

        {/* Processing Summary */}
        <ProcessingSummary items={processingItems} />

        {/* Daily Schedule */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DailySchedule type="pickup" items={[]} count={0} />
          <DailySchedule type="delivery" items={[]} count={0} />
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
