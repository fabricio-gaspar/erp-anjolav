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
  Truck,
  Package,
  Calendar,
  ShieldCheck,
  Settings,
  Factory,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
      <div className="space-y-6">
        {/* Top Section with Main Title and Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2 w-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#10b981]">DADOS AO VIVO</span>
              <span className="text-[10px] font-bold text-slate-400/80 tracking-wide ml-1">ATUALIZADO ÀS {format(new Date(), "HH:mm")}</span>
            </div>
            <h1 className="text-[44px] font-black text-[#0f172a] tracking-[-0.05em] leading-[0.9] uppercase">Painel Central</h1>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <div className="flex p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "h-8 text-[11px] font-black uppercase tracking-wider px-5 rounded-lg transition-all",
                  activeArea === 'central' ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => navigate('/central')}
              >
                Central
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "h-8 text-[11px] font-black uppercase tracking-wider px-5 rounded-lg transition-all",
                  activeArea === 'industrial' ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => navigate('/industrial')}
              >
                Industrial
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "h-8 text-[11px] font-black uppercase tracking-wider px-5 rounded-lg transition-all",
                  activeArea === 'residencial' ? "bg-white text-[#0f172a] shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => navigate('/residencial')}
              >
                Residencial
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-10 px-5 gap-2 bg-white border-slate-200 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => window.location.reload()}>
              <Loader2 className={cn("w-4 h-4 text-slate-400", isLoading && "animate-spin")} />
              <span className="font-black text-[11px] uppercase tracking-wider text-slate-700">Sincronizar</span>
            </Button>
          </div>
        </div>

        {/* Main KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {temFinanceiro && (
            <KPICard
              title="FATURAMENTO DO MÊS"
              value={formatCurrency(metricasFin?.receitas || 0)}
              icon={DollarSign}
              iconColor="success"
              subtitle="FATURAS DO PERÍODO, SEM CANCELADAS"
            />
          )}
          {temOrdens && (
            <KPICard
              title="OPERAÇÕES EM ANDAMENTO"
              value={metricas?.osEmAberto || 0}
              icon={Shirt}
              iconColor="info"
              subtitle="0 INDUSTRIAL · 1 RESIDENCIAL"
            />
          )}
          {temAgenda && (
            <KPICard
              title="COLETAS DO DIA"
              value={retiradas.length}
              icon={Truck}
              iconColor="primary"
              subtitle="AGENDAMENTOS DE RETIRADA DE HOJE"
            />
          )}
          {temAgenda && (
            <KPICard
              title="ENTREGAS PENDENTES"
              value={entregas.length}
              icon={Package}
              iconColor="warning"
              subtitle="EXPEDIÇÃO OU PRAZO VENCIDO"
            />
          )}
          {temClientes && (
            <KPICard
              title="CLIENTES ATIVOS"
              value={metricas?.clientesAtivos || 0}
              icon={Users}
              iconColor="primary"
              subtitle="0 INDUSTRIAL · 1 RESIDENCIAL"
            />
          )}
          {temProducao && (
            <KPICard
              title="EFICIÊNCIA OPERACIONAL"
              value="—"
              icon={TrendingUp}
              iconColor="success"
              subtitle="SEM ENTREGAS CONCLUÍDAS NO MÊS"
            />
          )}
        </div>

        {/* Workspace Operations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Industrial Quick View */}
          <div className="bg-white p-7 border border-slate-200/60 rounded-[24px] shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-[#0f172a] tracking-tight uppercase">Industrial</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visão da operação industrial</p>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-2 font-bold py-1.5 px-4 rounded-lg shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Operação estável
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-10">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">OS HOJE</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">0</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">EM ANDAMENTO</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">0</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">COLETAS HOJE</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">{retiradas.filter((r:any) => r.origem === 'industrial').length}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">FATURAMENTO MÊS</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">R$ 0,00</p>
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
          <div className="bg-white p-7 border border-slate-200/60 rounded-[24px] shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-[#0f172a] tracking-tight uppercase">Residencial</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visão da operação residencial</p>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-2 font-bold py-1.5 px-4 rounded-lg shadow-sm">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Requer atenção
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-10">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">PEDIDOS HOJE</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">0</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">EM ANDAMENTO</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">1</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">COLETAS HOJE</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">{retiradas.filter((r:any) => r.origem === 'residencial').length}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">FATURAMENTO MÊS</p>
                <p className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-none">R$ 0,00</p>
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
        <div className="card-base p-6 shadow-md border-slate-200/60">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Riscos operacionais industriais</h3>
            <Button variant="link" className="p-0 h-auto text-primary font-bold text-sm" onClick={() => navigate('/industrial')}>
              Abrir gestão industrial →
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Factory className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[10.5px] font-extrabold text-emerald-700/60 uppercase tracking-[0.08em]">Disponibilidade</p>
                <p className="text-2xl font-bold text-emerald-700 tracking-tighter">98.4%</p>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-500 rounded-xl flex items-center justify-center shadow-lg shadow-slate-500/10">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[10.5px] font-extrabold text-slate-600/60 uppercase tracking-[0.08em]">Manutenção</p>
                <p className="text-2xl font-bold text-slate-700 tracking-tighter">2 Ativas</p>
              </div>
            </div>

            <div className="p-5 bg-sky-50 rounded-2xl border border-sky-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-[10.5px] font-extrabold text-sky-700/60 uppercase tracking-[0.08em]">Qualidade</p>
                <p className="text-2xl font-bold text-sky-700 tracking-tighter">99.2%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Novas operações por dia (Gráfico) */}
        <div className="card-base p-6 shadow-md border-slate-200/60">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Novas operações por dia</h3>
          </div>
          <div className="h-64 flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm">
              <TrendingUp className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-700">Sem novas operações nos últimos 7 dias</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm text-center px-6">
              O gráfico será preenchido automaticamente quando novas OS e pedidos forem registrados.
            </p>
          </div>
        </div>

        {/* Resumo consolidado de operações recentes */}
        <div className="card-base p-6 shadow-md border-slate-200/60">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Resumo consolidado de operações recentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Código</th>
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Cliente</th>
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Unidade</th>
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Status</th>
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Previsão</th>
                  <th className="pb-4 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-[0.08em]">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50/50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 text-sm font-bold text-slate-700">2026-000001</td>
                  <td className="py-4 text-sm font-medium text-slate-600">SILVANA MORAES - AIRBNB</td>
                  <td className="py-4 text-sm font-medium text-slate-600">Residencial</td>
                  <td className="py-4">
                    <Badge className="bg-sky-100 text-sky-700 border-none font-bold text-[10px] px-2 py-0.5">Recebido</Badge>
                  </td>
                  <td className="py-4 text-sm font-medium text-slate-600">20/07/2026</td>
                  <td className="py-4 text-sm font-black text-slate-900">R$ 24,00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section: Alerts, Agenda, Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="card-base p-6 shadow-md border-slate-200/60">
            <h3 className="text-xl font-extrabold text-slate-900 mb-8 tracking-tight">Alertas e pendências</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 shadow-sm">
                <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Pedidos residenciais com prazo vencido</p>
                  <p className="text-[11px] font-bold text-rose-600 mt-0.5">1 operação exige acompanhamento</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">Contas a pagar vencidas</p>
                  <p className="text-[11px] font-bold text-amber-600 mt-0.5">{contasPendentes.length > 0 ? `${contasPendentes.length} títulos financeiros estão vencidos` : 'Nenhum título vencido'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card-base p-6 shadow-md border-slate-200/60">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Agenda do dia</h3>
              <Button variant="link" className="p-0 h-auto text-primary font-bold text-sm" onClick={() => navigate('/central/agenda-eventos')}>
                Agenda →
              </Button>
            </div>
            <div className="h-40 flex flex-col items-center justify-center">
               <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                 <Calendar className="w-8 h-8 text-slate-300" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem eventos hoje</p>
            </div>
          </div>

          <div className="card-base p-6 shadow-md border-slate-200/60">
            <h3 className="text-xl font-extrabold text-slate-900 mb-8 tracking-tight">Ações rápidas</h3>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" className="h-24 flex-col gap-3 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group rounded-2xl" onClick={() => navigate('/industrial/ordens')}>
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-primary transition-colors">
                  <FileText className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">OS Industrial</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-3 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group rounded-2xl" onClick={() => navigate('/residencial/ordens')}>
                <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-purple-500 group-hover:text-white transition-colors" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Pedido Residencial</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-3 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group rounded-2xl" onClick={() => navigate('/industrial/agenda')}>
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                  <Truck className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Coleta Industrial</span>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-3 bg-slate-50/50 border-slate-200 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all group rounded-2xl" onClick={() => navigate('/residencial/caixa')}>
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                  <CreditCard className="w-5 h-5 text-amber-500 group-hover:text-white transition-colors" />
                </div>
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Abrir caixa</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
