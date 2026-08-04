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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, ReferenceLine, BarChart, Bar } from "recharts";
import { Download, Printer, AlertTriangle, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRelatorioDiferencas } from "@/hooks/useRelatorioCaixa";
import { cn } from "@/lib/utils";

interface RelatorioDiferencasProps {
  startDate: Date;
  endDate: Date;
}

const chartConfig = {
  diferenca: { label: "Diferença", color: "hsl(var(--primary))" },
};

export const RelatorioDiferencas = ({ startDate, endDate }: RelatorioDiferencasProps) => {
  const { data: diferencas = [], isLoading } = useRelatorioDiferencas(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const stats = useMemo(() => {
    if (diferencas.length === 0) {
      return {
        totalDiferenca: 0,
        mediaDiferenca: 0,
        caixasComSobra: 0,
        caixasComFalta: 0,
        caixasExatos: 0,
        maiorSobra: null,
        maiorFalta: null,
      };
    }

    const sobras = diferencas.filter((d) => d.diferenca > 0);
    const faltas = diferencas.filter((d) => d.diferenca < 0);
    const exatos = diferencas.filter((d) => d.diferenca === 0);

    return {
      totalDiferenca: diferencas.reduce((acc, d) => acc + d.diferenca, 0),
      mediaDiferenca: diferencas.reduce((acc, d) => acc + d.diferenca, 0) / diferencas.length,
      caixasComSobra: sobras.length,
      caixasComFalta: faltas.length,
      caixasExatos: exatos.length,
      maiorSobra: sobras.length > 0 ? sobras.sort((a, b) => b.diferenca - a.diferenca)[0] : null,
      maiorFalta: faltas.length > 0 ? faltas.sort((a, b) => a.diferenca - b.diferenca)[0] : null,
    };
  }, [diferencas]);

  const lineData = useMemo(() => {
    let acumulado = 0;
    return diferencas.map((d) => {
      acumulado += d.diferenca;
      return {
        data: format(parseISO(d.data), "dd/MM"),
        Diferença: d.diferenca,
        Acumulado: acumulado,
      };
    });
  }, [diferencas]);

  const barData = useMemo(() => {
    return diferencas.map((d) => ({
      data: format(parseISO(d.data), "dd/MM"),
      operador: d.operador.split(" ")[0],
      Diferença: d.diferenca,
      fill: d.diferenca >= 0 ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
    }));
  }, [diferencas]);

  const handleExportCSV = () => {
    const headers = ["Data", "Operador", "Valor Esperado", "Valor Contado", "Diferença", "Vendas"];
    const rows = diferencas.map((d) => [
      format(parseISO(d.data), "dd/MM/yyyy"),
      d.operador,
      d.valor_esperado.toFixed(2),
      d.valor_contado.toFixed(2),
      d.diferenca.toFixed(2),
      d.valor_vendas.toFixed(2),
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `diferencas_${format(startDate, "yyyy-MM")}.csv`;
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
        <Card className={cn(
          "p-4 border-l-4",
          stats.totalDiferenca >= 0 ? "border-l-emerald-500" : "border-l-red-500"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              stats.totalDiferenca >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
            )}>
              {stats.totalDiferenca >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Total Diferença</p>
              <p className={cn(
                "text-xl font-bold",
                stats.totalDiferenca >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {stats.totalDiferenca >= 0 ? "+" : ""}{formatCurrency(stats.totalDiferenca)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Caixas c/ Sobra</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.caixasComSobra}</p>
              <p className="text-xs text-muted-foreground">
                {diferencas.length > 0 ? ((stats.caixasComSobra / diferencas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Caixas c/ Falta</p>
              <p className="text-2xl font-bold text-red-600">{stats.caixasComFalta}</p>
              <p className="text-xs text-muted-foreground">
                {diferencas.length > 0 ? ((stats.caixasComFalta / diferencas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-muted">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Caixas Exatos</p>
              <p className="text-2xl font-bold">{stats.caixasExatos}</p>
              <p className="text-xs text-muted-foreground">
                {diferencas.length > 0 ? ((stats.caixasExatos / diferencas.length) * 100).toFixed(0) : 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Diferenças por Dia */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Diferenças por Caixa</h3>
          {barData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Bar 
                  dataKey="Diferença" 
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </Card>

        {/* Line Chart - Acumulado */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Diferença Acumulada</h3>
          {lineData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Acumulado" 
                  stroke="hsl(262, 83%, 58%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(262, 83%, 58%)" }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </Card>
      </div>

      {/* Alertas */}
      {stats.maiorFalta && Math.abs(stats.maiorFalta.diferenca) >= 50 && (
        <Card className="p-4 border-l-4 border-l-red-500 bg-red-50/50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Alerta: Falta Significativa</p>
              <p className="text-sm text-red-700 mt-1">
                Maior falta registrada: <strong>{formatCurrency(stats.maiorFalta.diferenca)}</strong> em{" "}
                {format(parseISO(stats.maiorFalta.data), "dd/MM/yyyy")} por {stats.maiorFalta.operador}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Histórico Completo de Diferenças</h3>
        {diferencas.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead className="text-right font-bold">Diferença</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diferencas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      {format(parseISO(d.data), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{d.operador}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.valor_vendas)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.valor_esperado)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(d.valor_contado)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      d.diferenca > 0 ? "text-emerald-600" : d.diferenca < 0 ? "text-red-600" : ""
                    )}>
                      {d.diferenca >= 0 ? "+" : ""}{formatCurrency(d.diferenca)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>TOTAL</TableCell>
                  <TableCell className={cn(
                    "text-right",
                    stats.totalDiferenca >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {stats.totalDiferenca >= 0 ? "+" : ""}{formatCurrency(stats.totalDiferenca)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma diferença registrada no período</p>
          </div>
        )}
      </Card>
    </div>
  );
};
