import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CircleAlert,
  DollarSign,
  FileText,
  Loader2,
  Package,
  RefreshCw,
  Shirt,
  ShoppingCart,
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
import { NFsPendentesCard } from "@/components/dashboard/NFsPendentesCard";
import { ProcessingSummary, type ProcessingItem } from "@/components/dashboard/ProcessingSummary";
import { ProductionBottleneck } from "@/components/dashboard/ProductionBottleneck";
import { RolsLojaCard } from "@/components/dashboard/RolsLojaCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useWorkspace, type WorkspaceArea } from "@/contexts/WorkspaceContext";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useFaturas } from "@/hooks/useFaturas";
import {
  useAgendaDia,
  useMetricasProducao,
  useResumoProcessamento,
} from "@/hooks/useHistoricoProducao";
import { useTemPermissaoModulo } from "@/hooks/usePermissoesUsuario";
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
    title: "Painel Central",
    subtitle: "Visão consolidada das operações autorizadas.",
  },
  industrial: {
    title: "Painel Industrial",
    subtitle: "Indicadores restritos à operação industrial.",
  },
  residencial: {
    title: "Painel Residencial",
    subtitle: "Indicadores restritos à operação residencial e loja.",
  },
};

interface DashboardKpi {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: "primary" | "success" | "warning" | "destructive" | "info";
  subtitle: string;
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
  const { activeArea } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

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
  } = useFaturas(undefined, undefined, temFinanceiro);

  const isLoading =
    isLoadingMetricas ||
    isLoadingAgenda ||
    isLoadingResumo ||
    isLoadingContas ||
    isLoadingCaixa ||
    isLoadingFaturas;

  const failedSources = [
    metricasError && "indicadores operacionais",
    agendaError && "agenda",
    resumoError && "produção",
    contasError && "contas a pagar",
    caixaError && "caixa",
    faturasError && "faturamento",
  ].filter((source): source is string => Boolean(source));

  const hoje = startOfDay(new Date());
  const inicioMes = format(startOfMonth(hoje), "yyyy-MM-dd");
  const fimMes = format(endOfMonth(hoje), "yyyy-MM-dd");

  const faturasValidas = faturas.filter((fatura) => String(fatura.status) !== "cancelado");
  const faturasDoMes = faturasValidas.filter(
    (fatura) => fatura.periodo_inicio <= fimMes && fatura.periodo_fim >= inicioMes,
  );
  const totalFaturadoMes = faturasDoMes.reduce(
    (total, fatura) => total + asFiniteNumber(fatura.valor_total),
    0,
  );

  const faturasPendentes = faturasValidas.filter((fatura) => fatura.status !== "pago");
  const totalContasReceber = faturasPendentes.reduce(
    (total, fatura) => total + asFiniteNumber(fatura.valor_total),
    0,
  );
  const receberItems: FinanceItem[] = faturasPendentes.map((fatura) => {
    const vencimento = parseDate(fatura.data_vencimento ?? fatura.periodo_fim);
    return {
      id: fatura.id,
      status: vencimento && isBefore(startOfDay(vencimento), hoje) ? "vencida" : "a_vencer",
      clientName: fatura.cliente?.razao_social || "Cliente sem nome",
      value: asFiniteNumber(fatura.valor_total),
      dueDate: vencimento ? format(vencimento, "dd/MM/yyyy") : "Sem vencimento",
    };
  });

  const contasPendentes = contasPagar.filter((conta) =>
    ["pendente", "parcial", "vencido"].includes(conta.status),
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
        conta.status === "vencido" || (vencimento && isBefore(startOfDay(vencimento), hoje))
          ? "vencida"
          : "a_vencer",
      clientName: conta.fornecedor || conta.descricao,
      value: Math.max(0, asFiniteNumber(conta.valor) - asFiniteNumber(conta.valor_pago)),
      dueDate: vencimento ? format(vencimento, "dd/MM/yyyy") : "Sem vencimento",
    };
  });

  const kpis: DashboardKpi[] = [
    ...(temFinanceiro && !faturasError
      ? [{
          title: "Faturas do mês",
          value: totalFaturadoMes.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
          icon: DollarSign,
          iconColor: "success" as const,
          subtitle: "Períodos que abrangem o mês atual",
        }]
      : []),
    ...(temOrdens && !metricasError
      ? [{
          title: "OS em aberto",
          value: metricas?.osEmAberto ?? 0,
          icon: FileText,
          iconColor: "primary" as const,
          subtitle: "Sem entregues e canceladas",
        }]
      : []),
    ...(temAgenda && !metricasError
      ? [{
          title: "Entregas atrasadas",
          value: metricas?.entregasAtrasadas ?? 0,
          icon: AlertCircle,
          iconColor: "destructive" as const,
          subtitle: "Prazo anterior a hoje",
        }]
      : []),
    ...(temClientes && !metricasError
      ? [{
          title: "Clientes ativos",
          value: metricas?.clientesAtivos ?? 0,
          icon: Users,
          iconColor: "info" as const,
          subtitle: "Com OS nos últimos 30 dias",
        }]
      : []),
    ...(temProducao && !metricasError
      ? [{
          title: "Peças registradas hoje",
          value: metricas?.pecasProcessadasHoje ?? 0,
          icon: Shirt,
          iconColor: "success" as const,
          subtitle: "Quantidade inserida em itens de OS",
        }]
      : []),
    ...(temAgenda && !agendaError
      ? [
          {
            title: "Retiradas do dia",
            value: retiradas.length,
            icon: Truck,
            iconColor: "primary" as const,
            subtitle: "Agendamentos no escopo atual",
          },
          {
            title: "Entregas do dia",
            value: entregas.length,
            icon: Package,
            iconColor: "warning" as const,
            subtitle: "Agendadas ou prontas para entrega",
          },
        ]
      : []),
    ...(caixaEnabled && !caixaError
      ? [{
          title: "Caixa da loja",
          value: caixaAberto ? "Aberto" : "Fechado",
          icon: ShoppingCart,
          iconColor: caixaAberto ? ("success" as const) : ("warning" as const),
          subtitle: caixaAberto ? "Sessão de caixa em andamento" : "Nenhuma sessão aberta",
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

  const maiorGargalo = bottleneckItems[0];
  const recommendation = maiorGargalo
    ? `A etapa “${maiorGargalo.stage}” concentra ${maiorGargalo.osCount} OS abertas.`
    : "Nenhuma OS aberta foi identificada no escopo atual.";

  const financePath = `/${activeArea}/financeiro`;
  const ordersPath = activeArea === "central" ? null : `/${activeArea}/ordens`;
  const agendaPath =
    activeArea === "central" ? "/central/agenda-eventos" : `/${activeArea}/agenda`;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries();
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout title={areaLabels[activeArea].title} subtitle={areaLabels[activeArea].subtitle}>
        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados autorizados…</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={areaLabels[activeArea].title} subtitle={areaLabels[activeArea].subtitle}>
      <div className="space-y-5 sm:space-y-8">
        <section className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Dados persistidos · última atualização {format(lastUpdated, "HH:mm")}
            </p>
            <h1 className="px-1 text-3xl font-black uppercase leading-none tracking-tight text-slate-900 sm:text-5xl">
              {areaLabels[activeArea].title}
            </h1>
          </div>

          <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1">
            <div className="flex shrink-0 rounded-xl border border-slate-200/50 bg-slate-100/80 p-1">
              {(["central", "industrial", "residencial"] as const).map((area) => (
                <Button
                  key={area}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 rounded-lg px-3 text-[11px] font-black uppercase tracking-wider transition-all sm:px-5",
                    activeArea === area
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                  onClick={() => navigate(`/${area}`)}
                  aria-current={activeArea === area ? "page" : undefined}
                >
                  {area === "central" ? "Central" : area === "industrial" ? "Industrial" : "Residencial"}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 shrink-0 gap-2 bg-white px-4"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              <span className="text-[11px] font-black uppercase tracking-wider">
                {isRefreshing ? "Atualizando" : "Atualizar"}
              </span>
            </Button>
          </div>
        </section>

        {failedSources.length > 0 && (
          <div
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
            role="alert"
          >
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Algumas fontes não puderam ser atualizadas.</p>
              <p className="mt-1 text-muted-foreground">
                Dados indisponíveis: {failedSources.join(", ")}. Os indicadores afetados foram ocultados para não exibir zero como resultado real.
              </p>
            </div>
          </div>
        )}

        {kpis.length > 0 ? (
          <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
          <section aria-label="Resumo financeiro" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {temFinanceiro && !faturasError && (
              <FinanceCard
                title="Contas a receber"
                subtitle="Faturas não pagas no escopo atual"
                total={totalContasReceber}
                icon={DollarSign}
                variant="receivable"
                items={receberItems}
                onViewAll={() => navigate(financePath)}
              />
            )}
            {contasEnabled && !contasError && (
              <FinanceCard
                title="Contas a pagar"
                subtitle="Saldo pendente de títulos"
                total={totalContasPagar}
                icon={ShoppingCart}
                variant="payable"
                items={pagarItems}
                onViewAll={() => navigate("/central/contas")}
              />
            )}
          </section>
        )}

        {(temOrdens || temProducao) && !resumoError && (
          <section aria-label="Produção" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {!metricasError && (
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

        {temAgenda && !agendaError && (
          <section aria-label="Agenda do dia" className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <DailySchedule type="pickup" items={retiradasAgenda} count={retiradasAgenda.length} />
            <DailySchedule type="delivery" items={entregasAgenda} count={entregasAgenda.length} />
            <div className="flex justify-end xl:col-span-2">
              <Button variant="link" onClick={() => navigate(agendaPath)}>
                Abrir agenda →
              </Button>
            </div>
          </section>
        )}

        <section aria-label="Acompanhamentos" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
