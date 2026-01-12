import { AppLayout } from "@/components/layout/AppLayout";
import { SectionHeader } from "@/components/ui/section-header";
import { KPICard } from "@/components/dashboard/KPICard";
import { FinanceCard } from "@/components/dashboard/FinanceCard";
import { ProductionBottleneck } from "@/components/dashboard/ProductionBottleneck";
import { OperationalCosts } from "@/components/dashboard/OperationalCosts";
import { ProcessingSummary, type ProcessingItem } from "@/components/dashboard/ProcessingSummary";
import { DailySchedule } from "@/components/dashboard/DailySchedule";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  AlertCircle, 
  Users, 
  Shirt, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  Scale,
  Clock,
  User,
  Activity,
  BarChart3,
  Wallet,
  CalendarDays,
} from "lucide-react";
import { useMetricasProducao, useAgendaDia, useResumoProcessamento } from "@/hooks/useHistoricoProducao";
import { useMetricasProducaoAvancadas } from "@/hooks/useHistoricoProducaoResumo";
import { useContasPagar } from "@/hooks/useContasPagar";
import { format, formatDistanceToNow, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const etapaLabels: Record<string, string> = {
  retirada: "Retirado",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Pronto Entrega",
  entregue: "Entregue",
};

const Dashboard = () => {
  const { metricas, isLoading: isLoadingMetricas } = useMetricasProducao();
  const { retiradas, entregas, isLoading: isLoadingAgenda } = useAgendaDia();
  const { osEmProcessamento, isLoading: isLoadingResumo } = useResumoProcessamento();
  const { data: metricasAvancadas } = useMetricasProducaoAvancadas();
  const { contas: contasPagar } = useContasPagar();

  const isLoading = isLoadingMetricas || isLoadingAgenda || isLoadingResumo;

  // Calcular dados financeiros
  const contasPendentes = contasPagar.filter((c) => c.status === "pendente");
  const totalContasPagar = contasPendentes.reduce((acc, c) => acc + Number(c.valor), 0);

  // Preparar KPIs
  const kpis = [
    {
      title: "OS em Aberto",
      value: metricas?.osEmAberto || 0,
      icon: FileText,
      iconColor: "primary" as const,
    },
    {
      title: "Entregas Atrasadas",
      value: metricas?.entregasAtrasadas || 0,
      icon: AlertCircle,
      iconColor: "destructive" as const,
    },
    {
      title: "Clientes Ativos",
      value: metricas?.clientesAtivos || 0,
      icon: Users,
      iconColor: "info" as const,
    },
    {
      title: "Peças Processadas Hoje",
      value: metricas?.pecasProcessadasHoje || 0,
      icon: Shirt,
      iconColor: "success" as const,
    },
  ];

  // Preparar gargalos de produção
  const gargalos = metricas?.gargalos || {};
  const totalGargalos = Object.values(gargalos).reduce((a, b) => a + b, 0);
  const bottleneckItems = Object.entries(gargalos)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({
      stage: etapaLabels[stage] || stage,
      osCount: count,
      piecesCount: 0,
      avgTime: metricasAvancadas?.mediaTempoPorEtapa?.[stage] || "-",
      percentage: totalGargalos > 0 ? Math.round((count / totalGargalos) * 100) : 0,
    }))
    .sort((a, b) => b.osCount - a.osCount);

  // Preparar resumo de processamento com dados de histórico
  const processingItems: ProcessingItem[] = osEmProcessamento.slice(0, 5).map((os: any) => {
    const ultimoHistorico = os.historico?.[os.historico.length - 1];
    const tempoNaEtapa = ultimoHistorico
      ? formatDistanceToNow(new Date(ultimoHistorico.created_at), { locale: ptBR })
      : "-";

    // Extrair dados do histórico
    let quantidadePecas = 0;
    let pesoKg = 0;
    (os.historico || []).forEach((h: any) => {
      const dados = h.dados_formulario || {};
      if (dados.quantidade_pecas) quantidadePecas = dados.quantidade_pecas;
      if (dados.peso_total_kg) pesoKg = dados.peso_total_kg;
      if (dados.peso_final_kg) pesoKg = dados.peso_final_kg;
    });

    // Determinar status baseado na data de previsão
    let status: "on_time" | "delayed" | "at_risk" = "on_time";
    if (os.data_previsao_entrega) {
      const previsao = new Date(os.data_previsao_entrega);
      const hoje = startOfDay(new Date());
      if (isBefore(previsao, hoje)) {
        status = "delayed";
      } else {
        const diffDias = Math.ceil((previsao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias <= 1) {
          status = "at_risk";
        }
      }
    }

    return {
      clientName: os.cliente?.razao_social || "Cliente",
      osNumero: os.numero,
      currentStage: etapaLabels[os.status] || os.status,
      timeInStage: tempoNaEtapa,
      expectedDate: os.data_previsao_entrega
        ? format(new Date(os.data_previsao_entrega), "dd/MM", { locale: ptBR })
        : undefined,
      status,
      quantidadePecas: quantidadePecas || undefined,
      pesoKg: pesoKg || undefined,
    };
  });

  // Preparar agenda do dia
  const retiradasAgenda = retiradas.map((r: any) => ({
    id: r.id,
    clientName: r.cliente?.razao_social || "Cliente",
    time: r.horario || undefined,
    status: r.status === "confirmado" ? ("completed" as const) : ("pending" as const),
  }));

  const entregasAgenda = entregas.map((e: any) => ({
    id: e.id,
    clientName: e.cliente?.razao_social || "Cliente",
    time: undefined,
    status: "pending" as const,
  }));

  // Recomendação baseada em dados
  const maiorGargalo = bottleneckItems[0];
  const recommendation = maiorGargalo
    ? `A etapa "${maiorGargalo.stage}" está com ${maiorGargalo.osCount} OS. Considere realocar recursos ou priorizar esta fase.`
    : "Produção fluindo normalmente.";

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dashboard...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard" subtitle="Métricas e visão operacional">
      <div className="space-y-4">
        {/* Painel 1: KPIs */}
        <section className="content-panel">
          <SectionHeader icon={BarChart3} title="Métricas Rápidas" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
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

        {/* Painel 2: Financeiro + Produção */}
        <section className="content-panel">
          <SectionHeader icon={Wallet} title="Visão Financeira" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <FinanceCard
              title="Contas a Receber"
              subtitle="Em desenvolvimento"
              total={0}
              icon={TrendingUp}
              variant="receivable"
              items={[]}
            />
            <FinanceCard
              title="Contas a Pagar"
              subtitle={`${contasPendentes.length} pendentes`}
              total={totalContasPagar}
              icon={TrendingDown}
              variant="payable"
              items={contasPendentes.slice(0, 3).map((c) => ({
                id: c.id,
                status: new Date(c.vencimento) < new Date() ? "vencida" as const : "a_vencer" as const,
                clientName: c.fornecedor || c.descricao,
                value: Number(c.valor),
                dueDate: format(new Date(c.vencimento), "dd/MM", { locale: ptBR }),
              }))}
            />
          </div>

          <div className="section-divider" />

          <ProductionBottleneck
            items={bottleneckItems.length > 0 ? bottleneckItems : [{ stage: "Sem OS", osCount: 0, piecesCount: 0, avgTime: "-", percentage: 0 }]}
            recommendation={recommendation}
          />
        </section>

        {/* Painel 3: Operação */}
        <section className="content-panel">
          <SectionHeader icon={FileText} title="OS em Processamento" />
          <ProcessingSummary
            items={
              processingItems.length > 0
                ? processingItems
                : [{ clientName: "Nenhuma OS em processamento", currentStage: "-", timeInStage: "-", status: "on_time" as const }]
            }
          />

          <div className="section-divider" />

          <SectionHeader icon={CalendarDays} title="Agenda do Dia" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <DailySchedule type="pickup" items={retiradasAgenda} count={retiradasAgenda.length} />
            <DailySchedule type="delivery" items={entregasAgenda} count={entregasAgenda.length} />
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
