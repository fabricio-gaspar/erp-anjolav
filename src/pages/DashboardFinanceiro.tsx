import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertCircle, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface MovimentacaoVencida {
  id: string;
  tipo: "fatura" | "despesa";
  descricao: string;
  cliente: string;
  dataVencimento: string;
  valor: number;
}

const mockMovimentacoes: MovimentacaoVencida[] = [
  {
    id: "1",
    tipo: "fatura",
    descricao: "Fatura NFS-e 1-202500000001488 - FABRICIO GASPAR",
    cliente: "FABRICIO GASPAR",
    dataVencimento: "03/01/2026",
    valor: 5.0,
  },
];

const DashboardFinanceiro = () => {
  // Mock data
  const saldoAtual = 0;
  const receitasTotais = 0;
  const despesasTotais = 0;
  const margemLucro = 0;

  const aReceberHoje = 5.0;
  const aReceberProximos7Dias = 0;
  const aPagarHoje = 0;
  const aPagarProximos7Dias = 0;

  const vencidas = 5.0;
  const vencidasCount = 1;
  const vencemHoje = 0;
  const vencemHojeCount = 0;
  const proximos7Dias = 0;
  const proximos7DiasCount = 0;

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  return (
    <AppLayout title="Dashboard Financeiro" subtitle="Visão geral de finanças e fluxo de caixa">
      <div className="space-y-4">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo Atual */}
          <Card className="p-4 border-l-4 border-l-primary">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              SALDO ATUAL
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {formatCurrency(saldoAtual)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Receitas - Despesas</p>
          </Card>

          {/* Receitas Totais */}
          <Card className="p-4 border-l-4 border-l-success">
            <p className="text-xs font-semibold uppercase tracking-wider text-success">
              RECEITAS TOTAIS
            </p>
            <p className="text-2xl font-bold text-success mt-1">
              {formatCurrency(receitasTotais)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Apenas Pagas (0)</p>
          </Card>

          {/* Despesas Totais */}
          <Card className="p-4 border-l-4 border-l-destructive">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
              DESPESAS TOTAIS
            </p>
            <p className="text-2xl font-bold text-destructive mt-1">
              {formatCurrency(despesasTotais)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Apenas Pagas (0)</p>
          </Card>

          {/* Margem de Lucro */}
          <Card className="p-4 border-l-4 border-l-violet-500">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              MARGEM DE LUCRO
            </p>
            <p className="text-2xl font-bold text-violet-600 mt-1">{margemLucro}%</p>
            <p className="text-xs text-muted-foreground mt-1">Rentabilidade</p>
          </Card>
        </div>

        {/* A Receber / A Pagar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A Receber */}
          <Card className="overflow-hidden">
            <div className="bg-success/10 border-b border-success/20 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-success">
                A RECEBER
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Vencidos / Hoje</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {formatCurrency(aReceberHoje)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Próximos 7 dias</span>
                <span className="text-sm font-semibold text-success">
                  {formatCurrency(aReceberProximos7Dias)}
                </span>
              </div>
            </div>
          </Card>

          {/* A Pagar */}
          <Card className="overflow-hidden">
            <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-destructive">
                A PAGAR
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Vencidos / Hoje</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {formatCurrency(aPagarHoje)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Próximos 7 dias</span>
                <span className="text-sm font-semibold text-destructive">
                  {formatCurrency(aPagarProximos7Dias)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Alert Banner */}
        {vencidasCount > 0 && (
          <Card className="bg-amber-50 border-amber-200 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  ⚠ Atenção: {vencidasCount} movimentações vencidas!
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Total vencido: <span className="font-semibold">{formatCurrency(vencidas)}</span>
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vencidas */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-muted-foreground">Vencidas</span>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatCurrency(vencidas)}</p>
            <p className="text-xs text-muted-foreground mt-1">{vencidasCount} lançamentos</p>
          </Card>

          {/* Vencem Hoje */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">Vencem Hoje</span>
            </div>
            <p className="text-2xl font-bold text-amber-500">{formatCurrency(vencemHoje)}</p>
            <p className="text-xs text-muted-foreground mt-1">{vencemHojeCount} lançamentos</p>
          </Card>

          {/* Próximos 7 Dias */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Próximos 7 Dias</span>
            </div>
            <p className="text-2xl font-bold text-primary">{formatCurrency(proximos7Dias)}</p>
            <p className="text-xs text-muted-foreground mt-1">{proximos7DiasCount} lançamentos</p>
          </Card>
        </div>

        {/* Movimentações Vencidas */}
        {mockMovimentacoes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <h3 className="font-semibold text-foreground">Movimentações Vencidas</h3>
            </div>

            <div className="space-y-2">
              {mockMovimentacoes.map((mov) => (
                <Card key={mov.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mt-0.5">
                        <TrendingUp className="w-4 h-4 text-success" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{mov.descricao}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mov.cliente} • {mov.dataVencimento}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-destructive">
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
