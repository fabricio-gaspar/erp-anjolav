import { AppLayout } from "@/components/layout/AppLayout";
import { Wallet, TrendingUp, TrendingDown, Percent, AlertCircle, Clock, Calendar, Loader2 } from "lucide-react";
import { useDashboardFinanceiro } from "@/hooks/useDashboardFinanceiro";
import { FinanceiroKPI } from "@/components/financeiro/FinanceiroKPI";
import { FinanceiroResumoCard } from "@/components/financeiro/FinanceiroResumoCard";
import { MovimentacaoVencidaItem } from "@/components/financeiro/MovimentacaoVencidaItem";

const DashboardFinanceiro = () => {
  const {
    saldoAtual, receitasTotais, receitasCount,
    despesasTotais, despesasCount, margemLucro,
    aReceberVencido, aReceberHoje, aReceberProximos7Dias,
    aPagarVencido, aPagarHoje, aPagarProximos7Dias,
    vencidasTotal, vencidasCount,
    vencemHoje, vencemHojeCount,
    proximos7Dias, proximos7DiasCount,
    movimentacoesVencidas, isLoading,
  } = useDashboardFinanceiro();

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  if (isLoading) {
    return (
      <AppLayout title="Dashboard Financeiro" subtitle="Visão geral de finanças">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard Financeiro" subtitle="Visão geral de finanças e fluxo de caixa">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FinanceiroKPI label="Saldo Atual" value={fmt(saldoAtual)} subtitle="Receitas - Despesas" icon={Wallet} color="text-primary" />
          <FinanceiroKPI label="Receitas" value={fmt(receitasTotais)} subtitle={`${receitasCount} pagas`} icon={TrendingUp} color="text-emerald-500" />
          <FinanceiroKPI label="Despesas" value={fmt(despesasTotais)} subtitle={`${despesasCount} pagas`} icon={TrendingDown} color="text-destructive" />
          <FinanceiroKPI label="Margem" value={`${margemLucro}%`} subtitle="Rentabilidade" icon={Percent} color="text-primary" />
        </div>

        {/* A Receber / A Pagar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <FinanceiroResumoCard
            title="A Receber"
            icon={TrendingUp}
            iconColor="text-emerald-500"
            items={[
              { label: "Vencido", value: fmt(aReceberVencido), bold: aReceberVencido > 0 },
              { label: "Vence hoje", value: fmt(aReceberHoje), bold: aReceberHoje > 0 },
              { label: "Próximos 7 dias", value: fmt(aReceberProximos7Dias) },
            ]}
          />
          <FinanceiroResumoCard
            title="A Pagar"
            icon={TrendingDown}
            iconColor="text-destructive"
            items={[
              { label: "Vencido", value: fmt(aPagarVencido), bold: aPagarVencido > 0 },
              { label: "Vence hoje", value: fmt(aPagarHoje), bold: aPagarHoje > 0 },
              { label: "Próximos 7 dias", value: fmt(aPagarProximos7Dias) },
            ]}
          />
        </div>

        {/* Alertas rápidos */}
        {(vencidasCount > 0 || vencemHojeCount > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {vencidasCount > 0 && (
              <div className="flex items-center gap-2.5 bg-destructive/5 border border-destructive/15 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <div>
                  <p className="text-xs font-medium text-destructive">{vencidasCount} vencidas</p>
                  <p className="text-[11px] text-muted-foreground">{fmt(vencidasTotal)}</p>
                </div>
              </div>
            )}
            {vencemHojeCount > 0 && (
              <div className="flex items-center gap-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-600">{vencemHojeCount} vencem hoje</p>
                  <p className="text-[11px] text-muted-foreground">{fmt(vencemHoje)}</p>
                </div>
              </div>
            )}
            {proximos7DiasCount > 0 && (
              <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary">{proximos7DiasCount} em 7 dias</p>
                  <p className="text-[11px] text-muted-foreground">{fmt(proximos7Dias)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Movimentações Vencidas */}
        {movimentacoesVencidas.length > 0 && (
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-foreground">Movimentações Vencidas</span>
            </div>
            <div>
              {movimentacoesVencidas.map((mov) => (
                <MovimentacaoVencidaItem
                  key={mov.id}
                  tipo={mov.tipo}
                  descricao={mov.descricao}
                  cliente={mov.cliente}
                  dataVencimento={mov.dataVencimento}
                  valor={mov.valor}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardFinanceiro;
