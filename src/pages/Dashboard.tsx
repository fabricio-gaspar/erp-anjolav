import { AppLayout } from "@/components/layout/AppLayout";
import { KPICard } from "@/components/dashboard/KPICard";
import { FinanceCard } from "@/components/dashboard/FinanceCard";
import { ProductionBottleneck } from "@/components/dashboard/ProductionBottleneck";
import { ProcessingSummary, type ProcessingItem } from "@/components/dashboard/ProcessingSummary";
import { DailySchedule } from "@/components/dashboard/DailySchedule";
import { useRotasEntregaMutations } from "@/hooks/useRotasEntrega";
import { BillingClosuresCard } from "@/components/dashboard/BillingClosuresCard";
import { ContasVencendoCard } from "@/components/dashboard/ContasVencendoCard";
import { EstoqueBaixoCard } from "@/components/dashboard/EstoqueBaixoCard";
import { ContratosVencendoCard } from "@/components/dashboard/ContratosVencendoCard";
import { InadimplenciaCard } from "@/components/dashboard/InadimplenciaCard";
import { NFsPendentesCard } from "@/components/dashboard/NFsPendentesCard";
import { CaixaResumoCard } from "@/components/dashboard/CaixaResumoCard";
import { RolsLojaCard } from "@/components/dashboard/RolsLojaCard";
import { EventosDoDiaCard } from "@/components/dashboard/EventosDoDiaCard";
import { FeriasProximasCard } from "@/components/dashboard/FeriasProximasCard";
import { OperationalCosts } from "@/components/dashboard/OperationalCosts";
import {
  FileText,
  AlertCircle, 
  Users, 
  Shirt, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  ShoppingCart,
  ArrowDownCircle,
  DollarSign,
} from "lucide-react";
import { useMetricasProducao, useAgendaDia, useResumoProcessamento } from "@/hooks/useHistoricoProducao";
import { useMetricasProducaoAvancadas } from "@/hooks/useHistoricoProducaoResumo";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useTemPermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { useMetricasFinanceirasResumo } from "@/hooks/useMetricasFinanceiras";
import { useFaturas } from "@/hooks/useFaturas";
import { format, formatDistanceToNow, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const { data: metricasFin } = useMetricasFinanceirasResumo();
  const { metricas, isLoading: isLoadingMetricas } = useMetricasProducao();
  const { retiradas, entregas, isLoading: isLoadingAgenda } = useAgendaDia();
  const { osEmProcessamento, isLoading: isLoadingResumo } = useResumoProcessamento();
  const { data: metricasAvancadas } = useMetricasProducaoAvancadas();
  const { contas: contasPagar } = useContasPagar();
  const { data: caixaAberto } = useCaixaAberto();
  const { faturas } = useFaturas();
  const { createRota, addParada } = useRotasEntregaMutations();
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);

  const temFinanceiro = useTemPermissaoModulo("faturamento");
  const temContasPagar = useTemPermissaoModulo("contas_pagar");
  const temProducao = useTemPermissaoModulo("producao");
  const temAgenda = useTemPermissaoModulo("agenda");
  const temOrdens = useTemPermissaoModulo("ordens");
  const temClientes = useTemPermissaoModulo("clientes");
  const temProdutos = useTemPermissaoModulo("produtos");
  const temCaixa = useTemPermissaoModulo("caixa");

  const isLoading = isLoadingMetricas || isLoadingAgenda || isLoadingResumo;

  const handleGenerateRoute = async (tipo: "retirada" | "entrega") => {
    const hoje = new Date().toISOString().split("T")[0];
    const agendamentos = tipo === "retirada" ? retiradas : entregas;
    
    if (!agendamentos || agendamentos.length === 0) {
      toast.error("Nenhum agendamento para gerar rota");
      return;
    }

    setIsGeneratingRoute(true);
    try {
      // Get motorista from first agendamento that has one
      const motoristaId = (agendamentos.find((a: any) => (a as any).motorista_id) as any)?.motorista_id || null;

      // Create the route
      const rota = await createRota.mutateAsync({
        data: hoje,
        motorista_id: motoristaId,
        status: "planejada",
        observacoes: `Rota gerada automaticamente - ${tipo === "retirada" ? "Retiradas" : "Entregas"} do dia`,
      });

      // Create stops for each agendamento
      for (let i = 0; i < agendamentos.length; i++) {
        const ag = agendamentos[i] as any;
        await addParada.mutateAsync({
          rota_id: rota.id,
          ordem: i + 1,
          tipo: tipo,
          cliente_id: ag.cliente_id,
          agendamento_id: ag.id,
          observacoes: ag.observacoes || null,
        });
      }

      toast.success(`Rota de ${tipo === "retirada" ? "retiradas" : "entregas"} criada com ${agendamentos.length} parada(s)!`);
      navigate("/agenda");
    } catch (error: any) {
      toast.error("Erro ao gerar rota: " + error.message);
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const contasPendentes = contasPagar.filter((c) => c.status === "pendente");
  const totalContasPagar = contasPendentes.reduce((acc, c) => acc + Number(c.valor), 0);

  const faturasPendentes = (faturas || []).filter((f) => f.status === "pendente" || f.status === "nota_emitida" || f.status === "enviado");
  const totalContasReceber = faturasPendentes.reduce((acc, f) => acc + Number(f.valor_total), 0);

  const kpis = [
    ...(temOrdens ? [{
      title: "OS em Aberto",
      value: metricas?.osEmAberto || 0,
      icon: FileText,
      iconColor: "primary" as const,
    }] : []),
    ...(temAgenda ? [{
      title: "Entregas Atrasadas",
      value: metricas?.entregasAtrasadas || 0,
      icon: AlertCircle,
      iconColor: "destructive" as const,
    }] : []),
    ...(temClientes ? [{
      title: "Clientes Ativos",
      value: metricas?.clientesAtivos || 0,
      icon: Users,
      iconColor: "info" as const,
    }] : []),
    ...(temProducao ? [{
      title: "Peças Processadas Hoje",
      value: metricas?.pecasProcessadasHoje || 0,
      icon: Shirt,
      iconColor: "success" as const,
    }] : []),
    ...(temCaixa ? [{
      title: "Caixa",
      value: caixaAberto ? "Aberto" : "Fechado",
      icon: ShoppingCart,
      iconColor: caixaAberto ? "success" as const : "warning" as const,
    }] : []),
    ...(temCaixa && caixaAberto ? [{
      title: "Vendas Hoje",
      value: formatCurrency(caixaAberto.valor_vendas || 0),
      icon: TrendingUp,
      iconColor: "success" as const,
    }] : []),
    ...(temCaixa && caixaAberto ? [{
      title: "Sangrias",
      value: formatCurrency(caixaAberto.valor_sangrias || 0),
      icon: ArrowDownCircle,
      iconColor: "destructive" as const,
    }] : []),
    ...(temCaixa && caixaAberto ? [{
      title: "Saldo Esperado",
      value: formatCurrency(caixaAberto.valor_esperado || 0),
      icon: DollarSign,
      iconColor: "info" as const,
    }] : []),
  ];

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

  const processingItems: ProcessingItem[] = osEmProcessamento.slice(0, 5).map((os: any) => {
    const ultimoHistorico = os.historico?.[os.historico.length - 1];
    const tempoNaEtapa = ultimoHistorico
      ? formatDistanceToNow(new Date(ultimoHistorico.created_at), { locale: ptBR })
      : "-";

    let quantidadePecasHistorico = 0;
    (os.historico || []).forEach((h: any) => {
      const dados = h.dados_formulario || {};
      if (dados.quantidade_pecas) quantidadePecasHistorico = dados.quantidade_pecas;
    });

    let pecasItens = 0;
    let pesoEstimado = 0;
    let tempoTotalProcessoMin = 0;
    
    (os.itens || []).forEach((item: any) => {
      const qtd = Number(item.quantidade) || 0;
      pecasItens += qtd;
      if (item.produto?.peso_medio_kg) pesoEstimado += qtd * Number(item.produto.peso_medio_kg);
      if (item.produto?.tempo_processo_min) tempoTotalProcessoMin += qtd * Number(item.produto.tempo_processo_min);
    });

    const pecasFinal = quantidadePecasHistorico || pecasItens;

    let previsaoTexto: string | undefined;
    let dataPrevisaoCalc: Date | null = null;
    
    if (os.data_previsao_entrega) {
      dataPrevisaoCalc = new Date(os.data_previsao_entrega);
      previsaoTexto = format(dataPrevisaoCalc, "dd/MM", { locale: ptBR });
    } else if (os.data_retirada && tempoTotalProcessoMin > 0) {
      const dataRetirada = new Date(os.data_retirada);
      const horasProcesso = Math.ceil(tempoTotalProcessoMin / 60);
      const diasProcesso = Math.max(1, Math.ceil(horasProcesso / 8));
      dataPrevisaoCalc = new Date(dataRetirada);
      dataPrevisaoCalc.setDate(dataPrevisaoCalc.getDate() + diasProcesso);
      previsaoTexto = format(dataPrevisaoCalc, "dd/MM", { locale: ptBR }) + " (est.)";
    }

    let status: "on_time" | "delayed" | "at_risk" = "on_time";
    if (dataPrevisaoCalc) {
      const hoje = startOfDay(new Date());
      if (isBefore(dataPrevisaoCalc, hoje)) {
        status = "delayed";
      } else {
        const diffDias = Math.ceil((dataPrevisaoCalc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias <= 1) status = "at_risk";
      }
    }

    return {
      clientName: os.cliente?.razao_social || "Cliente",
      osNumero: os.numero,
      currentStage: etapaLabels[os.status] || os.status,
      timeInStage: tempoNaEtapa,
      expectedDate: previsaoTexto,
      status,
      quantidadePecas: pecasFinal || undefined,
      pesoKg: pesoEstimado > 0 ? Math.round(pesoEstimado * 10) / 10 : undefined,
    };
  });

  const retiradasAgenda = retiradas.map((r: any) => ({
    id: r.id,
    clientName: r.cliente?.razao_social || "Cliente",
    time: r.horario || undefined,
    status: r.status === "confirmado" ? ("completed" as const) : ("pending" as const),
  }));

  const entregasAgenda = entregas.map((e: any) => ({
    id: e.id,
    clientName: e.cliente?.razao_social || "Cliente",
    time: e.horario || undefined,
    status: e.pronto_entrega ? ("in_progress" as const) : ("pending" as const),
    prontoEntrega: e.pronto_entrega || false,
    osNumero: e.os_numero || null,
  }));

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
    <AppLayout title="Dashboard" subtitle={`Métricas e visão operacional - ${activeArea.charAt(0).toUpperCase() + activeArea.slice(1)}`}>
      <div className="space-y-6">
        {activeArea === "central" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             {/* Central specific summary would go here */}
          </div>
        )}
        {activeArea === "central" && metricasFin && (
          <div className="mb-3">
             <OperationalCosts 
               month={metricasFin.mes}
               revenue={metricasFin.receitas}
               expenses={metricasFin.despesas}
               profit={metricasFin.lucro}
               margin={metricasFin.margem}
             />
          </div>
        )}

        {/* KPIs */}
        {kpis.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Métricas Rápidas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
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
        )}

        {/* Financeiro & Alertas */}
        {(activeArea === "central" || activeArea === "industrial") && (temFinanceiro || temContasPagar || temProdutos || temClientes) && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Financeiro & Alertas</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {temFinanceiro && (
                <FinanceCard
                  title="Contas a Receber"
                  subtitle={`${faturasPendentes.length} pendentes`}
                  total={totalContasReceber}
                  icon={TrendingUp}
                  variant="receivable"
                  items={faturasPendentes.slice(0, 3).map((f) => ({
                    id: f.id,
                    status: f.data_vencimento && new Date(f.data_vencimento) < new Date() ? "vencida" as const : "a_vencer" as const,
                    clientName: f.cliente?.razao_social || "Cliente",
                    value: Number(f.valor_total),
                    dueDate: f.data_vencimento ? format(new Date(f.data_vencimento), "dd/MM", { locale: ptBR }) : "-",
                  }))}
                  onViewAll={() => navigate("/lancamentos?tab=faturas")}
                />
              )}
              {temFinanceiro && <InadimplenciaCard />}
              {temFinanceiro && <NFsPendentesCard />}
              {temFinanceiro && <BillingClosuresCard />}
              {temContasPagar && <ContasVencendoCard />}
              {temProdutos && <EstoqueBaixoCard />}
              {temClientes && <ContratosVencendoCard />}
            </div>
          </section>
        )}

        {/* Caixa PDV */}
        {activeArea === "residencial" && temCaixa && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Caixa PDV</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <CaixaResumoCard />
              <RolsLojaCard />
            </div>
          </section>
        )}

        {/* Eventos & Férias */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Lembretes & RH</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EventosDoDiaCard />
            <FeriasProximasCard />
          </div>
        </section>

        {/* Agenda do Dia */}
        {(activeArea === "industrial" || activeArea === "residencial") && temAgenda && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Agenda do Dia</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DailySchedule type="pickup" items={retiradasAgenda} count={retiradasAgenda.length} onGenerateRoute={() => handleGenerateRoute("retirada")} isGeneratingRoute={isGeneratingRoute} />
              <DailySchedule type="delivery" items={entregasAgenda} count={entregasAgenda.length} onGenerateRoute={() => handleGenerateRoute("entrega")} isGeneratingRoute={isGeneratingRoute} />
            </div>
          </section>
        )}

        {/* Gargalos + OS em Processamento */}
        {activeArea === "industrial" && temProducao && (
          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Produção</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <ProductionBottleneck
                items={bottleneckItems.length > 0 ? bottleneckItems : [{ stage: "Sem OS", osCount: 0, piecesCount: 0, avgTime: "-", percentage: 0 }]}
                recommendation={recommendation}
              />
              <ProcessingSummary
                items={
                  processingItems.length > 0
                    ? processingItems
                    : [{ clientName: "Nenhuma OS em processamento", currentStage: "-", timeInStage: "-", status: "on_time" as const }]
                }
              />
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
