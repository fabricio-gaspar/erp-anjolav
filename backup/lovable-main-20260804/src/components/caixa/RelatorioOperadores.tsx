import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts";
import { Download, Printer, Users, Trophy, TrendingUp, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useRelatorioOperadores } from "@/hooks/useRelatorioCaixa";
import { cn } from "@/lib/utils";

interface RelatorioOperadoresProps {
  startDate: Date;
  endDate: Date;
}

const chartConfig = {
  total_vendas: { label: "Vendas", color: "hsl(var(--primary))" },
  qtd_caixas: { label: "Caixas", color: "hsl(142, 76%, 36%)" },
};

export const RelatorioOperadores = ({ startDate, endDate }: RelatorioOperadoresProps) => {
  const { data: operadores = [], isLoading } = useRelatorioOperadores(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const stats = useMemo(() => {
    if (operadores.length === 0) {
      return {
        melhorVendedor: null,
        melhorPrecisao: null,
        totalOperadores: 0,
        totalVendas: 0,
      };
    }

    const ordenadoPorVendas = [...operadores].sort((a, b) => b.total_vendas - a.total_vendas);
    const ordenadoPorPrecisao = [...operadores].sort((a, b) => 
      Math.abs(a.media_diferenca) - Math.abs(b.media_diferenca)
    );

    return {
      melhorVendedor: ordenadoPorVendas[0],
      melhorPrecisao: ordenadoPorPrecisao[0],
      totalOperadores: operadores.length,
      totalVendas: operadores.reduce((acc, op) => acc + op.total_vendas, 0),
    };
  }, [operadores]);

  const chartData = useMemo(() => {
    return operadores.map((op) => ({
      name: op.operador.split(" ")[0], // Primeiro nome
      Vendas: op.total_vendas,
      Caixas: op.qtd_caixas * 1000, // Escala para visualização
    }));
  }, [operadores]);

  const handleExportCSV = () => {
    const headers = ["Operador", "Total Vendas", "Qtd Caixas", "Média Diferença", "Total Diferenças"];
    const rows = operadores.map((op) => [
      op.operador,
      op.total_vendas.toFixed(2),
      op.qtd_caixas,
      op.media_diferenca.toFixed(2),
      op.total_diferencas.toFixed(2),
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `operadores_${format(startDate, "yyyy-MM")}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Melhor Vendedor</p>
              <p className="text-lg font-bold truncate">
                {stats.melhorVendedor?.operador.split(" ")[0] || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(stats.melhorVendedor?.total_vendas || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Maior Precisão</p>
              <p className="text-lg font-bold truncate">
                {stats.melhorPrecisao?.operador.split(" ")[0] || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Dif. média: {formatCurrency(stats.melhorPrecisao?.media_diferenca || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Operadores</p>
              <p className="text-2xl font-bold">{stats.totalOperadores}</p>
              <p className="text-xs text-muted-foreground">no período</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-violet-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total Vendas</p>
              <p className="text-lg font-bold">{formatCurrency(stats.totalVendas)}</p>
              <p className="text-xs text-muted-foreground">todos operadores</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Ranking de Vendas por Operador</h3>
        {chartData.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Sem dados no período
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Detalhamento por Operador</h3>
        {operadores.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Total Vendas</TableHead>
                  <TableHead className="text-center">Caixas Fechados</TableHead>
                  <TableHead className="text-right">Média/Caixa</TableHead>
                  <TableHead className="text-right">Média Diferença</TableHead>
                  <TableHead className="text-right">Total Diferenças</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadores.map((op, index) => (
                  <TableRow key={op.operador}>
                    <TableCell>
                      {index === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                      {index === 1 && <span className="text-muted-foreground">2º</span>}
                      {index === 2 && <span className="text-muted-foreground">3º</span>}
                      {index > 2 && <span className="text-muted-foreground">{index + 1}º</span>}
                    </TableCell>
                    <TableCell className="font-medium">{op.operador}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(op.total_vendas)}</TableCell>
                    <TableCell className="text-center">{op.qtd_caixas}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(op.qtd_caixas > 0 ? op.total_vendas / op.qtd_caixas : 0)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right",
                      Math.abs(op.media_diferenca) < 10 
                        ? "text-emerald-600" 
                        : Math.abs(op.media_diferenca) < 50 
                          ? "text-amber-600" 
                          : "text-red-600"
                    )}>
                      {op.media_diferenca >= 0 ? "+" : ""}{formatCurrency(op.media_diferenca)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right",
                      op.total_diferencas >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {op.total_diferencas >= 0 ? "+" : ""}{formatCurrency(op.total_diferencas)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum operador com caixas fechados no período</p>
          </div>
        )}
      </Card>

      {/* Alertas de Precisão */}
      {operadores.filter((op) => Math.abs(op.media_diferenca) >= 50).length > 0 && (
        <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Atenção: Diferenças Elevadas</p>
              <p className="text-sm text-amber-700 mt-1">
                Os seguintes operadores apresentaram diferenças médias acima de R$ 50,00:
              </p>
              <ul className="mt-2 space-y-1">
                {operadores
                  .filter((op) => Math.abs(op.media_diferenca) >= 50)
                  .map((op) => (
                    <li key={op.operador} className="text-sm text-amber-700">
                      • {op.operador}: média de {formatCurrency(op.media_diferenca)} por caixa
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
