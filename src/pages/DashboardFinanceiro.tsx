import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, AlertCircle, Clock, Calendar, Loader2, Factory, Store } from "lucide-react";
import { useDashboardFinanceiro, type SetorFinanceiro } from "@/hooks/useDashboardFinanceiro";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const setorLabels: Record<SetorFinanceiro, { title: string; subtitle: string }> = {
  todos: { title: "Dashboard Financeiro", subtitle: "Visão consolidada — Industrial + Loja" },
  industrial: { title: "Financeiro — Industrial", subtitle: "Receitas de faturamento (clientes industriais)" },
  loja: { title: "Financeiro — Loja", subtitle: "Receitas do Caixa PDV (clientes residenciais)" },
};

const DashboardFinanceiro = () => {
  const [setor, setSetor] = useState<SetorFinanceiro>("todos");
  const {
    saldoAtual, receitasTotais, receitasCount,
    despesasTotais, despesasCount, margemLucro,
    aReceberVencido, aReceberHoje, aReceberProximos7Dias,
    aPagarVencido, aPagarHoje, aPagarProximos7Dias,
    vencidasTotal, vencidasCount, vencemHoje, vencemHojeCount,
    proximos7Dias, proximos7DiasCount, movimentacoesVencidas,
    receitasLoja, receitasLojaCount, isLoading,
  } = useDashboardFinanceiro(setor);

  const { title, subtitle } = setorLabels[setor];

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;
  const formatDate = (dateStr: string) => {
    try { return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR }); }
    catch { return dateStr; }
  };

  if (isLoading) {
    return (
      <AppLayout title={title} subtitle={subtitle}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando dados financeiros...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {/* Sector Toggle */}
        <Tabs value={setor} onValueChange={(v) => setSetor(v as SetorFinanceiro)}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="todos" className="text-xs">Todos</TabsTrigger>
            <TabsTrigger value="industrial" className="text-xs gap-1">
              <Factory className="w-3.5 h-3.5" /> Industrial
            </TabsTrigger>
            <TabsTrigger value="loja" className="text-xs gap-1">
              <Store className="w-3.5 h-3.5" /> Loja
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="p-3 sm:p-4 border-l-4 border-l-primary min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary truncate">SALDO ATUAL</p>
            <p className="text-lg sm:text-2xl font-black text-primary mt-1 truncate">{formatCurrency(saldoAtual)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Receitas - Despesas</p>
          </Card>

          <Card className="p-3 sm:p-4 border-l-4 border-l-success min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-success truncate">RECEITAS</p>
            <p className="text-lg sm:text-2xl font-black text-success mt-1 truncate">{formatCurrency(receitasTotais)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">
              {setor === "todos" ? `Faturas + Caixa (${receitasCount})` :
               setor === "industrial" ? `Faturas pagas (${receitasCount})` :
               `Vendas PDV (${receitasCount})`}
            </p>
          </Card>

          <Card className="p-3 sm:p-4 border-l-4 border-l-destructive min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-destructive truncate">DESPESAS</p>
            <p className="text-lg sm:text-2xl font-black text-destructive mt-1 truncate">{formatCurrency(despesasTotais)}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Apenas Pagas ({despesasCount})</p>
          </Card>

          <Card className="p-3 sm:p-4 border-l-4 border-l-violet-500 min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-violet-600 truncate">MARGEM LUCRO</p>
            <p className="text-lg sm:text-2xl font-black text-violet-600 mt-1">{margemLucro}%</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 hidden sm:block">Rentabilidade</p>
          </Card>
        </div>

        {/* Loja breakdown when viewing "todos" */}
        {setor === "todos" && receitasLojaCount > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2 mb-1">
                <Factory className="w-4 h-4 text-blue-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">RECEITA INDUSTRIAL</p>
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(receitasTotais - receitasLoja)}</p>
              <p className="text-xs text-muted-foreground">Faturas pagas ({receitasCount - receitasLojaCount})</p>
            </Card>
            <Card className="p-4 border-l-4 border-l-orange-500">
              <div className="flex items-center gap-2 mb-1">
                <Store className="w-4 h-4 text-orange-500" />
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">RECEITA LOJA</p>
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(receitasLoja)}</p>
              <p className="text-xs text-muted-foreground">Vendas PDV ({receitasLojaCount})</p>
            </Card>
          </div>
        )}

        {/* A Receber / A Pagar */}
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

        {/* Alert Banner */}
        {vencidasCount > 0 && (
          <Card className="bg-amber-50 border-amber-200 p-4 dark:bg-amber-900/20 dark:border-amber-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  ⚠ Atenção: {vencidasCount} movimentações vencidas!
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
      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
