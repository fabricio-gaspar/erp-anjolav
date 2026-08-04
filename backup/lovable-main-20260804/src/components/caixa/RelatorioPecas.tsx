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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Download, Printer, Package, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRelatorioPecas } from "@/hooks/useRelatorioCaixa";
import { cn } from "@/lib/utils";

interface RelatorioPecasProps {
  startDate: Date;
  endDate: Date;
}

const chartConfig = {
  pecas_entrada: { label: "Entrada", color: "hsl(142, 76%, 36%)" },
  pecas_saida: { label: "Saída", color: "hsl(var(--primary))" },
  saldo: { label: "Saldo", color: "hsl(262, 83%, 58%)" },
};

export const RelatorioPecas = ({ startDate, endDate }: RelatorioPecasProps) => {
  const { data: relatorio = [], isLoading } = useRelatorioPecas(startDate, endDate);

  const totais = useMemo(() => {
    return relatorio.reduce(
      (acc, dia) => ({
        os_entrada: acc.os_entrada + dia.os_entrada,
        pecas_entrada: acc.pecas_entrada + dia.pecas_entrada,
        os_saida: acc.os_saida + dia.os_saida,
        pecas_saida: acc.pecas_saida + dia.pecas_saida,
        saldo: acc.saldo + dia.saldo,
      }),
      { os_entrada: 0, pecas_entrada: 0, os_saida: 0, pecas_saida: 0, saldo: 0 }
    );
  }, [relatorio]);

  const chartData = useMemo(() => {
    return relatorio.map((dia) => ({
      data: format(parseISO(dia.data), "dd/MM"),
      Entrada: dia.pecas_entrada,
      Saída: dia.pecas_saida,
    }));
  }, [relatorio]);

  const lineData = useMemo(() => {
    let acumulado = 0;
    return relatorio.map((dia) => {
      acumulado += dia.saldo;
      return {
        data: format(parseISO(dia.data), "dd/MM"),
        "Saldo Acumulado": acumulado,
      };
    });
  }, [relatorio]);

  const handleExportCSV = () => {
    const headers = ["Data", "OS Entrada", "Peças Entrada", "OS Saída", "Peças Saída", "Saldo"];
    const rows = relatorio.map((dia) => [
      format(parseISO(dia.data), "dd/MM/yyyy"),
      dia.os_entrada,
      dia.pecas_entrada,
      dia.os_saida,
      dia.pecas_saida,
      dia.saldo,
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pecas_${format(startDate, "yyyy-MM")}.csv`;
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
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Peças Entrada</p>
              <p className="text-2xl font-bold text-emerald-600">{totais.pecas_entrada.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{totais.os_entrada} OS</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Peças Saída</p>
              <p className="text-2xl font-bold text-primary">{totais.pecas_saida.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{totais.os_saida} OS</p>
            </div>
          </div>
        </Card>

        <Card className={cn(
          "p-4 border-l-4",
          totais.saldo >= 0 ? "border-l-violet-500" : "border-l-red-500"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              totais.saldo >= 0 ? "bg-violet-500/10" : "bg-red-500/10"
            )}>
              {totais.saldo >= 0 ? (
                <TrendingUp className="w-5 h-5 text-violet-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Saldo Período</p>
              <p className={cn(
                "text-2xl font-bold",
                totais.saldo >= 0 ? "text-violet-600" : "text-red-600"
              )}>
                {totais.saldo >= 0 ? "+" : ""}{totais.saldo.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">peças</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-muted">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Dias c/ Movimento</p>
              <p className="text-2xl font-bold">{relatorio.length}</p>
              <p className="text-xs text-muted-foreground">no período</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Entrada vs Saída */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Entrada vs Saída por Dia</h3>
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="Entrada" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="Saída" fill="hsl(var(--primary))" />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </Card>

        {/* Line Chart - Saldo Acumulado */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Saldo Acumulado</h3>
          {lineData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Saldo Acumulado" 
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

      {/* Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Detalhamento Diário de Peças</h3>
        {relatorio.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">OS Entrada</TableHead>
                  <TableHead className="text-right text-emerald-600">Peças Entrada</TableHead>
                  <TableHead className="text-right">OS Saída</TableHead>
                  <TableHead className="text-right text-primary">Peças Saída</TableHead>
                  <TableHead className="text-right font-bold">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.map((dia) => (
                  <TableRow key={dia.data}>
                    <TableCell className="font-medium">
                      {format(parseISO(dia.data), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">{dia.os_entrada}</TableCell>
                    <TableCell className="text-right text-emerald-600 font-medium">{dia.pecas_entrada}</TableCell>
                    <TableCell className="text-right">{dia.os_saida}</TableCell>
                    <TableCell className="text-right text-primary font-medium">{dia.pecas_saida}</TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      dia.saldo >= 0 ? "text-violet-600" : "text-red-600"
                    )}>
                      {dia.saldo >= 0 ? "+" : ""}{dia.saldo}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{totais.os_entrada}</TableCell>
                  <TableCell className="text-right text-emerald-600">{totais.pecas_entrada}</TableCell>
                  <TableCell className="text-right">{totais.os_saida}</TableCell>
                  <TableCell className="text-right text-primary">{totais.pecas_saida}</TableCell>
                  <TableCell className={cn(
                    "text-right",
                    totais.saldo >= 0 ? "text-violet-600" : "text-red-600"
                  )}>
                    {totais.saldo >= 0 ? "+" : ""}{totais.saldo}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhum movimento de peças no período selecionado</p>
          </div>
        )}
      </Card>
    </div>
  );
};
