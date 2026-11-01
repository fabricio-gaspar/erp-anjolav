import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CircleAlert,
  ClipboardPlus,
  DollarSign,
  Factory,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Shirt,
  ShoppingCart,
  Settings,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  endOfMonth,
  format,
  formatDistanceToNow,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import { BillingClosuresCard } from "@/components/dashboard/BillingClosuresCard";
import { CaixaResumoCard } from "@/components/dashboard/CaixaResumoCard";
import { ContasVencendoCard } from "@/components/dashboard/ContasVencendoCard";
import { DailySchedule } from "@/components/dashboard/DailySchedule";
import { EstoqueBaixoCard } from "@/components/dashboard/EstoqueBaixoCard";
import { EventosDoDiaCard } from "@/components/dashboard/EventosDoDiaCard";
import { FinanceCard, type FinanceItem } from "@/components/dashboard/FinanceCard";
import { InadimplenciaCard } from "@/components/dashboard/InadimplenciaCard";
import { KPICard } from "@/components/dashboard/KPICard";
import { MyDayActionList, type MyDayAction } from "@/components/dashboard/MyDayActionList";
import { NFsPendentesCard } from "@/components/dashboard/NFsPendentesCard";
import { ProcessingSummary, type ProcessingItem } from "@/components/dashboard/ProcessingSummary";
import { ProductionBottleneck } from "@/components/dashboard/ProductionBottleneck";
import { RolsLojaCard } from "@/components/dashboard/RolsLojaCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace, type WorkspaceArea } from "@/contexts/WorkspaceContext";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useFaturas } from "@/hooks/useFaturas";
import {
  useAgendaDia,
  useMetricasProducao,
  useResumoProcessamento,
} from "@/hooks/useHistoricoProducao";
import { useNavigationAccess, useTemPermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { resolverEstadoDashboard } from "@/lib/dashboardState";
import { invalidateDashboardQueries } from "@/lib/queryDefaults";
import { cn } from "@/lib/utils";

const etapaLabels: Record<string, string> = {
  retirada: "Retirado",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Pronto para entrega",
  entregue: "Entregue",
};

const areaLabels: Record<WorkspaceArea, { title: string; subtitle: string }> = {
  central: {
    title: "Painel Administrativo",
    subtitle: "Visão consolidada da empresa, das operações e dos acessos autorizados.",
  },
  industrial: {
    title: "Meu dia",
    subtitle: "Próximas ações da operação industrial.",
  },
  residencial: {
    title: "Meu dia",
    subtitle: "Próximas ações da loja e da operação doméstica.",
  },
};

const workspaceLabels: Record<WorkspaceArea, string> = {
  central: "Visão administrativa consolidada",
  industrial: "Operação industrial",
  residencial: "Operação doméstica",
};

interface DashboardKpi {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: "primary" | "success" | "warning" | "destructive" | "info";
  subtitle: string;
  context: string;
  onOpen?: () => void;
}

interface ProcessingOrder {
  numero?: string | null;
  status?: string | null;
  data_previsao_entrega?: string | null;
  data_retirada?: string | null;
  cliente?: { razao_social?: string | null } | null;
  historico?: Array<{
    created_at?: string | null;
    dados_formulario?: unknown;
  }> | null;
  itens?: Array<{
    quantidade?: number | string | null;
    produto?: {
      peso_medio_kg?: number | string | null;
      tempo_processo_min?: number | string | null;
    } | null;
  }> | null;
}

interface AgendaRecord {
  id: string;
  horario?: string | null;
  status?: string | null;
  pronto_entrega?: boolean | null;
  os_numero?: string | null;
  cliente?: { razao_social?: string | null } | null;
}

function asFiniteNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function readNumericField(value: unknown, field: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return asFiniteNumber((value as Record<string, unknown>)[field]);
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function getScheduleStatus(status: string | null | undefined) {
  if (status === "realizado") return "completed" as const;
  if (status === "confirmado" || status === "em_andamento") return "in_progress" as const;
  return "pending" as const;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeTenant, funcionario } = useAuth();
  const { activeArea } = useWorkspace();
  const { canAccessRoute } = useNavigationAccess();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const temFinanceiro = useTemPermissaoModulo("faturamento");
  const temContasPagar = useTemPermissaoModulo("contas_pagar");
  const temProducao = useTemPermissaoModulo("producao");
  const temAgenda = useTemPermissaoModulo("agenda");
  const temOrdens = useTemPermissaoModulo("ordens");
  const temClientes = useTemPermissaoModulo("clientes");
  const temProdutos = useTemPermissaoModulo("produtos");
  const temCaixa = useTemPermissaoModulo("caixa");

  const metricasEnabled = temOrdens || temAgenda || temClientes || temProducao;
  const contasEnabled = activeArea === "central" && temContasPagar;
  const caixaEnabled = activeArea !== "industrial" && temCaixa;
  const hoje = startOfDay(new Date());
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  const {
    metricas,
    isLoading: isLoadingMetricas,
    error: metricasError,
  } = useMetricasProducao(metricasEnabled);
  const {
    retiradas,
    entregas,
    isLoading: isLoadingAgenda,
    error: agendaError,
  } = useAgendaDia(temAgenda);
  const {
    osEmProcessamento,
    isLoading: isLoadingResumo,
    error: resumoError,
  } = useResumoProcessamento(temOrdens || temProducao);
  const {
    contas: contasPagar,
    isLoading: isLoadingContas,
    error: contasError,
  } = useContasPagar(contasEnabled);
  const {
    data: caixaAberto,
    isLoading: isLoadingCaixa,
    error: caixaError,
  } = useCaixaAberto(caixaEnabled);
  const {
    faturas,
    isLoading: isLoadingFaturas,
    error: faturasError,
  } = useFaturas(inicioMes, fimMes, temFinanceiro, true);

  const { loadingSources, failedSources } = resolverEstadoDashboard([
    {
      label: "indicadores operacionais",
      enabled: metricasEnabled,
      isLoading: isLoadingMetricas,
      hasError: Boolean(metricasError),
    },
    {
      label: "agenda",
      enabled: temAgenda,
      isLoading: isLoadingAgenda,
      hasError: Boolean(agendaError),
    },
    {
      label: "produção",
      enabled: temOrdens || temProducao,
      isLoading: isLoadingResumo,
      hasError: Boolean(resumoError),
    },
    {
      label: "contas a pagar",
      enabled: contasEnabled,
      isLoading: isLoadingContas,
      hasError: Boolean(contasError),
    },
    {
      label: "caixa",
      enabled: caixaEnabled,
      isLoading: isLoadingCaixa,
      hasError: Boolean(caixaError),
    },
    {
      label: "faturamento",
      enabled: temFinanceiro,
      isLoading: isLoadingFaturas,
      hasError: Boolean(faturasError),
    },
  ]);

  const faturasValidas = faturas.filter(
    (fatura) => String(fatura.status) !== "cancelado" && fatura.status_pagamento !== "cancelado",
  );
  const faturasDoMes = faturasValidas.filter(
    (fatura) => fatura.periodo_inicio <= fimMes && fatura.periodo_fim >= inicioMes,
  );
  const totalFaturadoMes = faturasDoMes.reduce(
    (total, fatura) => total + asFiniteNumber(fatura.valor_total),
    0,
  );

  const faturasPendentes = faturasValidas.filter(
    (fatura) => fatura.status_pagamento !== "pago" && fatura.status !== "pago",
  );
  const totalContasReceber = faturasPendentes.reduce(
    (total, fatura) => total + Math.max(
      0,
      asFiniteNumber(fatura.valor_total) - asFiniteNumber(fatura.valor_pago),
    ),
    0,
  );
  const receberItems: FinanceItem[] = faturasPendentes.map((fatura) => {
    const vencimento = parseDate(fatura.data_vencimento ?? fatura.periodo_fim);
    return {
      id: fatura.id,
      status: vencimento && isBefore(startOfDay(vencimento), hoje) ? "vencida" : "a_vencer",
      clientName: fatura.cliente?.razao_social || "Cliente sem nome",
      value: Math.max(
        0,
        asFiniteNumber(fatura.valor_total) - asFiniteNumber(fatura.valor_pago),
      ),
      dueDate: vencimento ? format(vencimento, "dd/MM/yyyy") : "Sem vencimento",
    };
  });

  const contasPendentes = contasPagar.filter((conta) =>
    ["pendente", "parcial"].includes(conta.status),
  );
  const totalContasPagar = contasPendentes.reduce(
    (total, conta) =>
      total + Math.max(0, asFiniteNumber(conta.valor) - asFiniteNumber(conta.valor_pago)),
    0,
  );
  const pagarItems: FinanceItem[] = contasPendentes.map((conta) => {
    const vencimento = parseDate(conta.vencimento);
    return {
      id: conta.id,
      status:
        vencimento && isBefore(startOfDay(vencimento), hoje)
          ? "vencida"
          : "a_vencer",
      clientName: conta.fornecedor || conta.descricao,
      value: Math.max(0, asFiniteNumber(conta.valor) - asFiniteNumber(conta.valor_pago)),
      dueDate: vencimento ? format(vencimento, "dd/MM/yyyy") : "Sem vencimento",
    };
  });

  const financePath = `/${activeArea}/financeiro`;
  const ordersPath = activeArea === "central" ? null : `/${activeArea}/ordens`;
  const productionPath = activeArea === "central" ? null : `/${activeArea}/producao`;
  const cashPath = activeArea === "central" ? null : `/${activeArea}/caixa`;
  const clientsPath = activeArea === "central" ? null : `/${activeArea}/clientes`;
  const agendaPath =
    activeArea === "central" ? "/central/agenda-eventos" : `/${activeArea}/agenda`;
  const dashboardContext = `${workspaceLabels[activeArea]} · ${activeTenant?.name ?? "Empresa ativa"}`;
  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const openOrdersSummary = ordersPath
    ? () => navigate(`${ordersPath}?status=abertas`)
    : () => scrollToSection("dashboard-production");
  const openOverdueOrders = ordersPath
    ? () => navigate(`${ordersPath}?prazo=atrasado`)
    : () => scrollToSection("dashboard-production");
  const openAgendaSummary = activeArea === "central"
    ? () => scrollToSection("dashboard-agenda")
    : () => navigate(agendaPath);

  const kpis: DashboardKpi[] = [
    ...(temFinanceiro && !faturasError && !isLoadingFaturas
      ? [{
          title: "Faturas do mês",
          value: totalFaturadoMes.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          icon: DollarSign,
          iconColor: "success" as const,
          subtitle: "Períodos que abrangem o mês atual",
          context: `Mês atual · ${workspaceLabels[activeArea]}`,
          onOpen: () => navigate(`${financePath}?tab=faturamento`),
        }]
      : []),
    ...(temOrdens && !metricasError && !isLoadingMetricas
      ? [{
          title: "ROLs em aberto",
          value: metricas?.osEmAberto ?? 0,
          icon: FileText,
          iconColor: "primary" as const,
          subtitle: "Sem entregues e canceladas",
          context: `Agora · ${workspaceLabels[activeArea]}`,
          onOpen: openOrdersSummary,
        }]
      : []),
    ...(temOrdens && !metricasError && !isLoadingMetricas
      ? [{
          title: "Entregas atrasadas",
          value: metricas?.entregasAtrasadas ?? 0,
          icon: AlertCircle,
          iconColor: "destructive" as const,
          subtitle: "Prazo anterior a hoje",
          context: `Até hoje · ${workspaceLabels[activeArea]}`,
          onOpen: openOverdueOrders,
        }]
      : []),
    ...(temClientes && !metricasError && !isLoadingMetricas
      ? [{
          title: "Clientes ativos",
          value: metricas?.clientesAtivos ?? 0,
          icon: Users,
          iconColor: "info" as const,
          subtitle: "Com ROLs nos últimos 30 dias",
          context: `Últimos 30 dias · ${workspaceLabels[activeArea]}`,
          onOpen: clientsPath ? () => navigate(clientsPath) : undefined,
        }]
      : []),
    ...(temProducao && !metricasError && !isLoadingMetricas
      ? [{
          title: "Peças registradas hoje",
          value: metricas?.pecasProcessadasHoje ?? 0,
          icon: Shirt,
          iconColor: "success" as const,
          subtitle: "Quantidade inserida em itens de ROL",
          context: `Hoje · ${workspaceLabels[activeArea]}`,
          onOpen: productionPath ? () => navigate(productionPath) : () => scrollToSection("dashboard-production"),
        }]
      : []),
    ...(temAgenda && !agendaError && !isLoadingAgenda
      ? [
          {
            title: "Retiradas do dia",
            value: retiradas.length,
            icon: Truck,
            iconColor: "primary" as const,
            subtitle: "Agendamentos no escopo atual",
            context: `Hoje · ${workspaceLabels[activeArea]}`,
            onOpen: activeArea === "central"
              ? () => scrollToSection("dashboard-agenda")
              : () => navigate(`${agendaPath}?tipo=retirada`),
          },
          {
            title: "Entregas do dia",
            value: entregas.length,
            icon: Package,
            iconColor: "warning" as const,
            subtitle: "Agendadas ou prontas para entrega",
            context: `Hoje · ${workspaceLabels[activeArea]}`,
            onOpen: activeArea === "central"
              ? () => scrollToSection("dashboard-agenda")
              : () => navigate(`${agendaPath}?tipo=entrega`),
          },
        ]
      : []),
    ...(caixaEnabled && !caixaError && !isLoadingCaixa
      ? [{
          title: "Caixa da loja",
          value: caixaAberto ? "Aberto" : "Fechado",
          icon: ShoppingCart,
          iconColor: caixaAberto ? ("success" as const) : ("warning" as const),
          subtitle: caixaAberto ? "Sessão de caixa em andamento" : "Nenhuma sessão aberta",
          context: `Sessão atual · ${workspaceLabels[activeArea]}`,
          onOpen: cashPath ? () => navigate(cashPath) : undefined,
        }]
      : []),
  ];

  const gargalos = metricas?.gargalos ?? {};
  const totalGargalos = Object.values(gargalos).reduce((total, count) => total + count, 0);
  const bottleneckItems = Object.entries(gargalos)
    .filter(([, count]) => count > 0)
    .map(([stage, count]) => ({
      stage: etapaLabels[stage] || stage,
      osCount: count,
      piecesCount: 0,
      avgTime: "N/D",
      percentage: totalGargalos > 0 ? Math.round((count / totalGargalos) * 100) : 0,
    }))
    .sort((a, b) => b.osCount - a.osCount);

  const processingItems: ProcessingItem[] = (osEmProcessamento as unknown as ProcessingOrder[])
    .slice(0, 5)
    .map((ordem) => {
      const historico = ordem.historico ?? [];
      const ultimoHistorico = historico.reduce<(typeof historico)[number] | null>(
        (latest, entry) => {
          if (!latest) return entry;
          return String(entry.created_at) > String(latest.created_at) ? entry : latest;
        },
        null,
      );
      const inicioEtapa = parseDate(ultimoHistorico?.created_at);
      const tempoNaEtapa = inicioEtapa
        ? formatDistanceToNow(inicioEtapa, { locale: ptBR })
        : "Não registrado";

      const quantidadeHistorico = historico.reduce(
        (quantity, entry) =>
          readNumericField(entry.dados_formulario, "quantidade_pecas") || quantity,
        0,
      );
      const itens = ordem.itens ?? [];
      const quantidadeItens = itens.reduce(
        (total, item) => total + asFiniteNumber(item.quantidade),
        0,
      );
      const pesoEstimado = itens.reduce(
        (total, item) =>
          total + asFiniteNumber(item.quantidade) * asFiniteNumber(item.produto?.peso_medio_kg),
        0,
      );
      const tempoProcessoMin = itens.reduce(
        (total, item) =>
          total + asFiniteNumber(item.quantidade) * asFiniteNumber(item.produto?.tempo_processo_min),
        0,
      );

      let previsao = parseDate(ordem.data_previsao_entrega);
      let previsaoEstimada = false;
      if (!previsao && ordem.data_retirada && tempoProcessoMin > 0) {
        const retirada = parseDate(ordem.data_retirada);
        if (retirada) {
          previsao = new Date(retirada);
          previsao.setDate(previsao.getDate() + Math.max(1, Math.ceil(tempoProcessoMin / 480)));
          previsaoEstimada = true;
        }
      }

      let status: ProcessingItem["status"] = "on_time";
      if (previsao) {
        const diasRestantes = Math.ceil(
          (startOfDay(previsao).getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000),
        );
        if (diasRestantes < 0) status = "delayed";
        else if (diasRestantes <= 1) status = "at_risk";
      }

      return {
        clientName: ordem.cliente?.razao_social || "Cliente sem nome",
        osNumero: ordem.numero || undefined,
        currentStage: etapaLabels[String(ordem.status)] || String(ordem.status || "Não informado"),
        timeInStage: tempoNaEtapa,
        expectedDate: previsao
          ? `${format(previsao, "dd/MM")}${previsaoEstimada ? " (estimada)" : ""}`
          : undefined,
        status,
        quantidadePecas: quantidadeHistorico || quantidadeItens || undefined,
        pesoKg: pesoEstimado > 0 ? Math.round(pesoEstimado * 10) / 10 : undefined,
      };
    });

  const retiradasAgenda = (retiradas as unknown as AgendaRecord[]).map((retirada) => ({
    id: retirada.id,
    clientName: retirada.cliente?.razao_social || "Cliente sem nome",
    time: retirada.horario || undefined,
    status: getScheduleStatus(retirada.status),
  }));

  const entregasAgenda = (entregas as unknown as AgendaRecord[]).map((entrega) => ({
    id: entrega.id,
    clientName: entrega.cliente?.razao_social || "Cliente sem nome",
    time: entrega.horario || undefined,
    status: entrega.pronto_entrega ? ("in_progress" as const) : getScheduleStatus(entrega.status),
    prontoEntrega: Boolean(entrega.pronto_entrega),
    osNumero: entrega.os_numero || null,
  }));

  const productionAttentionCount = processingItems.filter(
    (item) => item.status === "delayed" || item.status === "at_risk",
  ).length;
  const agendaPendingCount = [...retiradasAgenda, ...entregasAgenda].filter(
    (item) => item.status !== "completed",
  ).length;
  const overdueReceivablesCount = receberItems.filter((item) => item.status === "vencida").length;
  const overduePayablesCount = pagarItems.filter((item) => item.status === "vencida").length;
  const overdueFinancialCount = overdueReceivablesCount + overduePayablesCount;
  const myDayActions: MyDayAction[] = [
    ...(
      temOrdens
      && !metricasError
      && !isLoadingMetricas
      && (metricas?.entregasAtrasadas ?? 0) > 0
        ? [{
            id: "overdue-orders",
            title: "Pedidos com prazo vencido",
            value: metricas?.entregasAtrasadas ?? 0,
            description: "Revise a promessa, o bloqueio atual e a próxima ação de cada pedido.",
            context: `Até hoje · ${workspaceLabels[activeArea]}`,
            actionLabel: "Revisar",
            icon: AlertCircle,
            tone: "danger" as const,
            onOpen: openOverdueOrders,
          }]
        : []
    ),
    ...(
      temProducao
      && !resumoError
      && !isLoadingResumo
      && productionAttentionCount > 0
        ? [{
            id: "production-risk",
            title: "Produção em risco",
            value: productionAttentionCount,
            description: "Pedidos atrasados ou com entrega prevista até amanhã precisam de priorização.",
            context: `Agora · ${workspaceLabels[activeArea]}`,
            actionLabel: "Priorizar",
            icon: Factory,
            tone: "warning" as const,
            onOpen: productionPath
              ? () => navigate(productionPath)
              : () => scrollToSection("dashboard-production"),
          }]
        : []
    ),
    ...(
      temAgenda
      && !agendaError
      && !isLoadingAgenda
      && agendaPendingCount > 0
        ? [{
            id: "agenda-pending",
            title: "Paradas pendentes hoje",
            value: agendaPendingCount,
            description: "Retiradas, entregas agendadas e pedidos prontos ainda aguardam execução.",
            context: `Hoje · ${workspaceLabels[activeArea]}`,
            actionLabel: "Organizar",
            icon: CalendarDays,
            tone: "info" as const,
            onOpen: openAgendaSummary,
          }]
        : []
    ),
    ...(
      temFinanceiro
      && !faturasError
      && !isLoadingFaturas
      && (!contasEnabled || (!contasError && !isLoadingContas))
      && overdueFinancialCount > 0
        ? [{
            id: "financial-overdue",
            title: "Títulos vencidos",
            value: overdueFinancialCount,
            description: `${overdueReceivablesCount} a receber e ${overduePayablesCount} a pagar exigem acompanhamento.`,
            context: `Até hoje · ${workspaceLabels[activeArea]}`,
            actionLabel: "Conciliar",
            icon: Banknote,
            tone: "danger" as const,
            onOpen: () => navigate(financePath),
          }]
        : []
    ),
    ...(
      cashPath
      && caixaEnabled
      && !caixaError
      && !isLoadingCaixa
      && !caixaAberto
        ? [{
            id: "cash-closed",
            title: "Caixa ainda fechado",
            value: "Fechado",
            description: "Abra uma sessão antes de registrar qualquer movimentação em dinheiro.",
            context: `Sessão atual · ${workspaceLabels[activeArea]}`,
            actionLabel: "Abrir caixa",
            icon: ShoppingCart,
            tone: "warning" as const,
            onOpen: () => navigate(cashPath),
          }]
        : []
    ),
  ];

  const quickActions = [
    ...(activeArea === "central" && canAccessRoute("/residencial/caixa")
      ? [{ label: "PDV Doméstico", icon: ShoppingCart, onOpen: () => navigate("/pdv/domestico") }]
      : []),
    ...(activeArea === "central" && canAccessRoute("/industrial/caixa")
      ? [{ label: "PDV Industrial", icon: Factory, onOpen: () => navigate("/pdv/industrial") }]
      : []),
    ...(activeArea === "central" && canAccessRoute("/central/configuracoes")
      ? [{ label: "Configurar sistema", icon: Settings, onOpen: () => navigate("/central/configuracoes") }]
      : []),
    ...(ordersPath && temOrdens
      ? [{ label: "Novo pedido", icon: ClipboardPlus, onOpen: () => navigate(`${ordersPath}?novo=1`) }]
      : []),
    ...(cashPath && temCaixa
      ? [{ label: "PDV / Caixa", icon: ShoppingCart, onOpen: () => navigate(cashPath) }]
      : []),
    ...(productionPath && temProducao
      ? [{ label: "Produção", icon: Factory, onOpen: () => navigate(productionPath) }]
      : []),
    ...(temAgenda
      ? [{ label: activeArea === "central" ? "Agenda administrativa" : "Agenda", icon: CalendarDays, onOpen: () => navigate(agendaPath) }]
      : []),
    ...(temFinanceiro
      ? [{ label: "Financeiro", icon: DollarSign, onOpen: () => navigate(financePath) }]
      : []),
  ].slice(0, 5);

  const maiorGargalo = bottleneckItems[0];
  const recommendation = maiorGargalo
    ? `A etapa “${maiorGargalo.stage}” concentra ${maiorGargalo.osCount} ROLs abertas.`
    : "Nenhuma ROL aberta foi identificada no escopo atual.";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await invalidateDashboardQueries(queryClient);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppLayout title={areaLabels[activeArea].title} subtitle={areaLabels[activeArea].subtitle}>
      <div className="page-shell !space-y-4">
        <PageHeader
          eyebrow={activeArea === "central" ? "Gestão integrada" : "Rotina operacional"}
          title={areaLabels[activeArea].title}
          description={`${areaLabels[activeArea].subtitle} ${format(hoje, "EEEE, dd 'de' MMMM", { locale: ptBR })}.`}
          actions={(
            <Button
              variant="outline"
              className="w-full shrink-0 gap-2 sm:w-auto"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              {isRefreshing ? "Atualizando" : "Atualizar"}
            </Button>
          )}
        />

        <section className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 shadow-sm sm:p-5" aria-label="Contexto e ações rápidas">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {funcionario?.nome ? `Olá, ${funcionario.nome.split(" ")[0]}.` : "Olá."} O que precisa avançar agora?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{dashboardContext}</p>
            </div>
            {quickActions.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      type="button"
                      variant="outline"
                      className="min-h-11 justify-start gap-2 bg-card/80 sm:justify-center"
                      onClick={action.onOpen}
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {(loadingSources.length > 0 || failedSources.length > 0) && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border p-4 text-sm",
              failedSources.length > 0
                ? "border-destructive/30 bg-destructive/5"
                : "border-primary/20 bg-primary/5",
            )}
            role={failedSources.length > 0 ? "alert" : "status"}
            aria-live="polite"
          >
            {failedSources.length > 0 ? (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" />
            )}
            <div className="min-w-0 flex-1">
              {failedSources.length > 0 ? (
                <>
                  <p className="font-semibold text-destructive">Algumas fontes não puderam ser atualizadas.</p>
                  <p className="mt-1 text-muted-foreground">
                    Dados indisponíveis: {failedSources.join(", ")}. Os indicadores afetados foram ocultados para não exibir zero como resultado real.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">
                  Atualizando: {loadingSources.join(", ")}. Os demais dados continuam disponíveis.
                </p>
              )}
            </div>
            {failedSources.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                Tentar novamente
              </Button>
            )}
          </div>
        )}

        <MyDayActionList
          actions={myDayActions}
          isLoading={loadingSources.length > 0 && myDayActions.length === 0}
        />

        {kpis.length > 0 ? (
          <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <KPICard key={kpi.title} {...kpi} />
            ))}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Nenhum indicador adicional está disponível para as permissões deste usuário.
          </div>
        )}

        {(temFinanceiro || contasEnabled) && (
          <section id="dashboard-finance" aria-label="Resumo financeiro" className="scroll-mt-24 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {temFinanceiro && !faturasError && !isLoadingFaturas && (
              <FinanceCard
                title="Contas a receber"
                subtitle="Faturas não pagas no escopo atual"
                total={totalContasReceber}
                icon={DollarSign}
                variant="receivable"
                items={receberItems}
                onViewAll={() => navigate(`${financePath}?tab=receber`)}
              />
            )}
            {contasEnabled && !contasError && !isLoadingContas && (
              <FinanceCard
                title="Contas a pagar"
                subtitle="Saldo pendente de títulos"
                total={totalContasPagar}
                icon={ShoppingCart}
                variant="payable"
                items={pagarItems}
                onViewAll={() => navigate("/central/financeiro?tab=pagar")}
              />
            )}
          </section>
        )}

        {(temOrdens || temProducao) && !resumoError && !isLoadingResumo && (
          <section id="dashboard-production" aria-label="Produção" className="scroll-mt-24 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {!metricasError && !isLoadingMetricas && (
              <ProductionBottleneck items={bottleneckItems} recommendation={recommendation} />
            )}
            <ProcessingSummary items={processingItems} />
            {ordersPath && (
              <div className="flex justify-end xl:col-span-2">
                <Button variant="link" onClick={() => navigate(ordersPath)}>
                  Abrir ordens no escopo atual →
                </Button>
              </div>
            )}
          </section>
        )}

        {temAgenda && !agendaError && !isLoadingAgenda && (
          <section id="dashboard-agenda" aria-label="Agenda do dia" className="scroll-mt-24 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <DailySchedule type="pickup" items={retiradasAgenda} count={retiradasAgenda.length} />
            <DailySchedule type="delivery" items={entregasAgenda} count={entregasAgenda.length} />
            <div className="flex justify-end xl:col-span-2">
              <Button variant="link" onClick={() => navigate(agendaPath)}>
                Abrir agenda →
              </Button>
            </div>
          </section>
        )}

        <section aria-label="Acompanhamentos" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {activeArea === "central" && temFinanceiro && <BillingClosuresCard />}
          {activeArea === "central" && temContasPagar && <ContasVencendoCard />}
          {activeArea === "central" && temAgenda && <EventosDoDiaCard />}
          {activeArea === "industrial" && temProdutos && <EstoqueBaixoCard />}
          {temFinanceiro && <InadimplenciaCard />}
          {temFinanceiro && <NFsPendentesCard />}
          {activeArea === "residencial" && temCaixa && <CaixaResumoCard />}
          {activeArea === "residencial" && temOrdens && <RolsLojaCard />}
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
