import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Calendar,
  Clock,
  Factory,
  FileText,
  LayoutDashboard,
  Scale,
  Store,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  createDefaultFinancialPeriod,
  useDashboardFinanceiro,
  type PeriodoFinanceiro,
  type SetorFinanceiro,
} from "@/hooks/useDashboardFinanceiro";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { FinanceiroWidgetState } from "@/components/financeiro/FinanceiroWidgetState";
import ContasReceberContent from "@/components/contas/ContasReceberContent";
import ContasPagarContent from "@/components/contas/ContasPagarContent";
import { ConciliacaoFinanceiraContent } from "@/components/financeiro/ConciliacaoFinanceiraContent";
import { FaturasTab } from "@/components/lancamentos/FaturasTab";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";

const setorLabels: Record<SetorFinanceiro, { title: string; subtitle: string }> = {
  todos: { title: "Dashboard Financeiro", subtitle: "Visão consolidada — Industrial + Doméstico" },
  industrial: { title: "Financeiro Industrial", subtitle: "Faturas e recebimentos do PDV — setor industrial" },
  loja: { title: "Financeiro Doméstico", subtitle: "Faturas e recebimentos do PDV — setor doméstico" },
};

const DashboardFinanceiro = () => {
  const { activeArea } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultSetor: SetorFinanceiro =
    activeArea === "industrial" ? "industrial" : activeArea === "residencial" ? "loja" : "todos";
  const [setorSelecionado, setSetorSelecionado] = useState<SetorFinanceiro>(defaultSetor);
  const [periodo, setPeriodo] = useState<PeriodoFinanceiro>(createDefaultFinancialPeriod);
  const [periodoDraft, setPeriodoDraft] = useState<PeriodoFinanceiro>(createDefaultFinancialPeriod);
  const setor = activeArea === "central" ? setorSelecionado : defaultSetor;
  const availableTabs = activeArea === "central"
    ? ["resumo", "receber", "pagar", "conciliacao", "faturamento"]
    : ["resumo", "receber", "conciliacao", "faturamento"];
  const requestedTab = searchParams.get("tab") ?? "resumo";
  const activeTab = availableTabs.includes(requestedTab) ? requestedTab : "resumo";
  const setActiveTab = (tab: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", tab);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    setSetorSelecionado(defaultSetor);
  }, [defaultSetor]);

  const {
    resultadoRegistrado, receitasTotais, receitasCount,
    despesasTotais, despesasCount, margemOperacionalRegistrada,
    aReceberVencido, aReceberHoje, aReceberProximos7Dias,
    aPagarVencido, aPagarHoje, aPagarProximos7Dias,
    vencidasTotal, vencidasCount, vencemHoje, vencemHojeCount,
    proximos7Dias, proximos7DiasCount, movimentacoesVencidas,
    receitasLoja, receitasLojaCount, isLoading, error, isRetrying,
    errorReference, retry,
  } = useDashboardFinanceiro(setor, periodo);

  const { title, subtitle } = setorLabels[setor];
  const draftPeriodDays = periodoDraft.inicio && periodoDraft.fim
    ? (new Date(`${periodoDraft.fim}T00:00:00Z`).getTime()
      - new Date(`${periodoDraft.inicio}T00:00:00Z`).getTime()) / 86_400_000
    : Number.NaN;
  const isDraftPeriodValid = Number.isFinite(draftPeriodDays)
    && draftPeriodDays >= 0
    && draftPeriodDays <= 366;

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); }
    catch { return dateStr; }
  };

  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="page-shell">
        <PageHeader
          eyebrow="Gestão financeira"
          title={setor === "todos" ? "Dashboard Financeiro" : title}
          description="Monitoramento de fluxo de caixa, receitas e despesas"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="tabs-scrollable">
            <TabsList className="page-tabs-list">
              <TabsTrigger value="resumo" className="page-tab-trigger gap-2">
                <LayoutDashboard className="h-4 w-4" /> Resumo
              </TabsTrigger>
              <TabsTrigger value="receber" className="page-tab-trigger gap-2">
                <TrendingUp className="h-4 w-4" /> A receber
              </TabsTrigger>
              {activeArea === "central" && (
                <TabsTrigger value="pagar" className="page-tab-trigger gap-2">
                  <WalletCards className="h-4 w-4" /> A pagar
                </TabsTrigger>
              )}
              <TabsTrigger value="conciliacao" className="page-tab-trigger gap-2">
                <Scale className="h-4 w-4" /> Conciliação
              </TabsTrigger>
              <TabsTrigger value="faturamento" className="page-tab-trigger gap-2">
                <FileText className="h-4 w-4" /> Faturamento
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="resumo" className="mt-0 space-y-4">
          <Card className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="financial-period-start">Período inicial</label>
              <Input
                id="financial-period-start"
                type="date"
                value={periodoDraft.inicio}
                onChange={(event) => setPeriodoDraft((current) => ({ ...current, inicio: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="financial-period-end">Período final</label>
              <Input
                id="financial-period-end"
                type="date"
                value={periodoDraft.fim}
                onChange={(event) => setPeriodoDraft((current) => ({ ...current, fim: event.target.value }))}
              />
            </div>
            <Button
              className="min-h-11"
              disabled={!isDraftPeriodValid}
              onClick={() => setPeriodo(periodoDraft)}
            >
              Aplicar período
            </Button>
          </Card>

        <div className="space-y-4">
        {/* Sector Toggle: only the Central panel can switch across sectors. */}
        {activeArea === "central" && (
          <Tabs value={setorSelecionado} onValueChange={(v) => setSetorSelecionado(v as SetorFinanceiro)}>
            <TabsList className="page-tabs-list">
              <TabsTrigger value="todos" className="page-tab-trigger text-xs">Todos</TabsTrigger>
              <TabsTrigger value="industrial" className="page-tab-trigger gap-1 text-xs">
                <Factory className="w-3.5 h-3.5" /> Industrial
              </TabsTrigger>
              <TabsTrigger value="loja" className="page-tab-trigger gap-1 text-xs">
                <Store className="w-3.5 h-3.5" /> Doméstico
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Top KPI Cards */}
        <FinanceiroWidgetState
          title="indicadores financeiros"
          isLoading={isLoading}
          error={error}
          errorReference={errorReference}
          isRetrying={isRetrying}
          onRetry={retry}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <Card className="p-3 sm:p-4 border-l-4 border-l-primary min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary truncate">RESULTADO REGISTRADO</p>
              <p className="text-lg sm:text-2xl font-black text-primary mt-1 truncate">{formatCurrency(resultadoRegistrado)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Recebimentos menos pagamentos registrados</p>
            </Card>

            <Card className="p-3 sm:p-4 border-l-4 border-l-success min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-success truncate">RECEITAS</p>
              <p className="text-lg sm:text-2xl font-black text-success mt-1 truncate">{formatCurrency(receitasTotais)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
                Faturas pagas + recebimentos do PDV ({receitasCount})
              </p>
            </Card>

            <Card className="p-3 sm:p-4 border-l-4 border-l-destructive min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-destructive truncate">DESPESAS</p>
              <p className="text-lg sm:text-2xl font-black text-destructive mt-1 truncate">{formatCurrency(despesasTotais)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Apenas Pagas ({despesasCount})</p>
            </Card>

            <Card className="p-3 sm:p-4 border-l-4 border-l-violet-500 min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-violet-600 truncate">MARGEM OPERACIONAL</p>
              <p className="text-lg sm:text-2xl font-black text-violet-600 mt-1">{margemOperacionalRegistrada}%</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Sobre valores efetivamente registrados</p>
            </Card>
          </div>
        </FinanceiroWidgetState>

        {/* Invoice/direct receipt breakdown across both sectors */}
        {setor === "todos" && receitasLojaCount > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2 mb-1">
                <Factory className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">RECEITA DE FATURAS</p>
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(receitasTotais - receitasLoja)}</p>
              <p className="text-xs text-muted-foreground">Faturas pagas ({receitasCount - receitasLojaCount})</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-orange-500">
              <div className="flex items-center gap-2 mb-1">
                <Store className="w-4 h-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">RECEITA DO PDV</p>
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(receitasLoja)}</p>
              <p className="text-xs text-muted-foreground">Vendas PDV ({receitasLojaCount})</p>
            </Card>
          </div>
        )}

        {/* A Receber / A Pagar */}
        <FinanceiroWidgetState
          title="vencimentos"
          isLoading={isLoading}
          error={error}
          errorReference={errorReference}
          isRetrying={isRetrying}
          onRetry={retry}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden">
              <div className="bg-success/10 border-b border-success/20 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-success">A RECEBER</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Vencidos / Hoje</p>
                    <p className="text-xl sm:text-3xl font-black text-foreground mt-1 truncate">{formatCurrency(aReceberVencido + aReceberHoje)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Próximos 7 dias</span>
                  <span className="text-sm font-semibold text-success">{formatCurrency(aReceberProximos7Dias)}</span>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-destructive">A PAGAR</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Vencidos / Hoje</p>
                    <p className="text-xl sm:text-3xl font-black text-foreground mt-1 truncate">{formatCurrency(aPagarVencido + aPagarHoje)}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Próximos 7 dias</span>
                  <span className="text-sm font-semibold text-destructive">{formatCurrency(aPagarProximos7Dias)}</span>
                </div>
              </div>
            </Card>
          </div>
        </FinanceiroWidgetState>

        <FinanceiroWidgetState
          title="alertas financeiros"
          isLoading={isLoading}
          error={error}
          errorReference={errorReference}
          isRetrying={isRetrying}
          onRetry={retry}
        >
          {/* Alert Banner */}
          {vencidasCount > 0 && (
            <Card className="bg-amber-50 border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Atenção: {vencidasCount} movimentações vencidas.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Total vencido: <span className="font-semibold">{formatCurrency(vencidasTotal)}</span>
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-sm font-medium text-muted-foreground">Vencidas</span>
              </div>
              <p className="text-2xl font-black text-destructive">{formatCurrency(vencidasTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">{vencidasCount} lançamentos</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-muted-foreground">Vencem Hoje</span>
              </div>
              <p className="text-2xl font-black text-amber-500">{formatCurrency(vencemHoje)}</p>
              <p className="text-xs text-muted-foreground mt-1">{vencemHojeCount} lançamentos</p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">Próximos 7 Dias</span>
              </div>
              <p className="text-2xl font-black text-primary">{formatCurrency(proximos7Dias)}</p>
              <p className="text-xs text-muted-foreground mt-1">{proximos7DiasCount} lançamentos</p>
            </Card>
          </div>

          {/* Movimentações Vencidas */}
          {movimentacoesVencidas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <h3 className="font-semibold text-foreground">Movimentações Vencidas</h3>
              </div>
              <div className="space-y-2">
                {movimentacoesVencidas.map((mov) => (
                  <Card key={mov.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 ${
                          mov.tipo === "fatura" ? "bg-success/10" : "bg-destructive/10"
                        }`}>
                          {mov.tipo === "fatura" ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{mov.descricao}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {mov.cliente} • {formatDate(mov.dataVencimento)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-lg font-black ${
                        mov.tipo === "fatura" ? "text-success" : "text-destructive"
                      }`}>
                        {formatCurrency(mov.valor)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </FinanceiroWidgetState>
        </div>
          </TabsContent>

          <TabsContent value="receber" className="mt-0">
            <ContasReceberContent />
          </TabsContent>

          {activeArea === "central" && (
            <TabsContent value="pagar" className="mt-0">
              <ContasPagarContent />
            </TabsContent>
          )}

          <TabsContent value="conciliacao" className="mt-0">
            <ConciliacaoFinanceiraContent />
          </TabsContent>

          <TabsContent value="faturamento" className="mt-0">
            <FaturasTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
