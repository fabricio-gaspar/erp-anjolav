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
    <AppLayout title="Dashboard" subtitle="Visão consolidada e auditável das operações industrial e residencial.">
      <div className="space-y-5">
        {/* Top Section with Main Title and Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-success">Dados ao Vivo</span>
              <span className="text-[10px] text-slate-400">Atualizado às {format(new Date(), "HH:mm")}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Painel Central</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex p-1 bg-slate-100 rounded-lg">
              <Button 
                variant={activeArea === 'central' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn("h-8 text-xs px-4 rounded-md", activeArea === 'central' && "bg-white shadow-sm")}
                onClick={() => navigate('/central')}
              >
                Central
              </Button>
              <Button 
                variant={activeArea === 'industrial' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn("h-8 text-xs px-4 rounded-md", activeArea === 'industrial' && "bg-white shadow-sm")}
                onClick={() => navigate('/industrial')}
              >
                Industrial
              </Button>
              <Button 
                variant={activeArea === 'residencial' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn("h-8 text-xs px-4 rounded-md", activeArea === 'residencial' && "bg-white shadow-sm")}
                onClick={() => navigate('/residencial')}
              >
                Residencial
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-10 px-4 gap-2 bg-white" onClick={() => window.location.reload()}>
              <Loader2 className={cn("w-4 h-4", isLoading && "animate-spin")} />
              <span className="font-semibold text-slate-700">Atualizar dados</span>
            </Button>
          </div>
        </div>

        {/* Main KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {temFinanceiro && (
            <KPICard
              title="FATURAMENTO ESTIMADO"
              value={formatCurrency(metricasFin?.receitas || 0)}
              icon={DollarSign}
              iconColor="primary"
              trend={{ value: "12% vs mês ant.", direction: "up" }}
            />
          )}
          {temOrdens && (
            <KPICard
              title="OPERAÇÕES ATIVAS"
              value={metricas?.osEmAberto || 0}
              icon={FileText}
              iconColor="info"
              subtitle={`${metricas?.osEmAberto || 0} industrial · 0 residencial`}
            />
          )}
          {temAgenda && (
            <KPICard
              title="COLETAS AGENDADAS"
              value={retiradas.length}
              icon={Truck}
              iconColor="success"
              subtitle="Agendamentos de retirada hoje"
            />
          )}
          {temAgenda && (
            <KPICard
              title="ENTREGAS PENDENTES"
              value={entregas.length}
              icon={Package}
              iconColor="warning"
              subtitle="Expedição ou prazo vencendo"
            />
          )}
          {temClientes && (
            <KPICard
              title="CLIENTES ATIVOS"
              value={metricas?.clientesAtivos || 0}
              icon={Users}
              iconColor="primary"
              subtitle={`${metricas?.clientesAtivos || 0} industrial · 0 residencial`}
            />
          )}
          {temProducao && (
            <KPICard
              title="EFICIÊNCIA OPERACIONAL"
              value="--"
              icon={TrendingUp}
              iconColor="info"
              subtitle="Sem entregas concluídas hoje"
            />
          )}
        </div>

        {/* Workspace Operations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Industrial Quick View */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Industrial</h3>
                <p className="text-xs text-slate-400 mt-0.5">Visão rápida da operação industrial</p>
              </div>
              <Badge variant="outline" className="bg-success/5 text-success border-success/20 gap-1.5 font-bold py-1 px-3">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Operação estável
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OS hoje</p>
                <p className="text-2xl font-bold text-slate-900">0</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em andamento</p>
                <p className="text-2xl font-bold text-slate-900">0</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coletas hoje</p>
                <p className="text-2xl font-bold text-slate-900">{retiradas.filter((r:any) => r.origem === 'industrial').length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento mês</p>
                <p className="text-2xl font-bold text-slate-900">R$ 0,00</p>
              </div>
            </div>

            <div className="h-32 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
              <p className="text-sm text-slate-400">Sem novas operações nos últimos 7 dias</p>
            </div>

            <Button 
              variant="link" 
              className="mt-4 p-0 h-auto text-primary font-bold gap-1 text-sm ml-auto block"
              onClick={() => navigate('/industrial')}
            >
              Abrir painel industrial →
            </Button>
          </div>

          {/* Residencial Quick View */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Residencial</h3>
                <p className="text-xs text-slate-400 mt-0.5">Visão rápida da operação residencial</p>
              </div>
              <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20 gap-1.5 font-bold py-1 px-3">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                Requer atenção
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pedidos hoje</p>
                <p className="text-2xl font-bold text-slate-900">0</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Em andamento</p>
                <p className="text-2xl font-bold text-slate-900">1</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Coletas hoje</p>
                <p className="text-2xl font-bold text-slate-900">{retiradas.filter((r:any) => r.origem === 'residencial').length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento mês</p>
                <p className="text-2xl font-bold text-slate-900">R$ 0,00</p>
              </div>
            </div>

            <div className="h-32 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center">
              <p className="text-sm text-slate-400">Sem novas operações nos últimos 7 dias</p>
            </div>

            <Button 
              variant="link" 
              className="mt-4 p-0 h-auto text-primary font-bold gap-1 text-sm ml-auto block"
              onClick={() => navigate('/residencial')}
            >
              Abrir painel residencial →
            </Button>
          </div>
        </div>

        {/* Riscos Operacionais */}
        <div className="card-base p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Riscos operacionais industriais</h3>
            <Button variant="link" className="p-0 h-auto text-primary font-bold text-sm" onClick={() => navigate('/industrial')}>
              Abrir gestão industrial →
            </Button>
          </div>
          
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-700">Dados industriais indisponíveis</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Não foi possível consultar máquinas, manutenção e qualidade neste momento.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Alerts, Agenda, Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-base p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Alertas e pendências</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-destructive/5 rounded-xl border border-destructive/10">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Pedidos residenciais com prazo vencido</p>
                  <p className="text-xs text-slate-500 mt-1">1 operação exige acompanhamento</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-warning/5 rounded-xl border border-warning/10">
                <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Contas a pagar vencidas</p>
                  <p className="text-xs text-slate-500 mt-1">{contasPendentes.filter(c => isBefore(new Date(c.data_vencimento), new Date())).length} faturas pendentes</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Agenda do dia</h3>
              <Button variant="link" className="p-0 h-auto text-primary font-bold text-sm" onClick={() => navigate('/central/agenda-eventos')}>
                Agenda administrativa →
              </Button>
            </div>
            <div className="h-40 flex flex-col items-center justify-center">
               <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                 <Calendar className="w-6 h-6 text-slate-300" />
               </div>
               <p className="text-xs text-slate-400">Sem eventos administrativos agendados para hoje</p>
            </div>
          </div>

          <div className="card-base p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Ações rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-20 flex-col gap-2 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-md transition-all group rounded-xl">
                <FileText className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-700">OS Industrial</span>
              </Button>
              <Button variant="outline" className="h-20 flex-col gap-2 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-md transition-all group rounded-xl">
                <ShoppingCart className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-700">Pedido Residencial</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
  );
};

export default Dashboard;
