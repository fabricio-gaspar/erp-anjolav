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
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Download, Printer, DollarSign, CreditCard, Smartphone, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRelatorioMovimentacoes, useTotaisPeriodo } from "@/hooks/useRelatorioCaixa";
import { cn } from "@/lib/utils";

interface RelatorioMovimentacoesProps {
  startDate: Date;
  endDate: Date;
}

const COLORS = ["hsl(var(--primary))", "hsl(142, 76%, 36%)", "hsl(262, 83%, 58%)", "hsl(38, 92%, 50%)"];

const chartConfig = {
  dinheiro: { label: "Dinheiro", color: "hsl(var(--primary))" },
  pix: { label: "PIX", color: "hsl(142, 76%, 36%)" },
  cartao_credito: { label: "C. Crédito", color: "hsl(262, 83%, 58%)" },
  cartao_debito: { label: "C. Débito", color: "hsl(38, 92%, 50%)" },
};

export const RelatorioMovimentacoes = ({ startDate, endDate }: RelatorioMovimentacoesProps) => {
  const { data: relatorio = [], isLoading } = useRelatorioMovimentacoes(startDate, endDate);
  const { data: totais } = useTotaisPeriodo(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const pieData = useMemo(() => {
    if (!totais) return [];
    return [
      { name: "Dinheiro", value: totais.porFormaPagamento.dinheiro },
      { name: "PIX", value: totais.porFormaPagamento.pix },
      { name: "C. Crédito", value: totais.porFormaPagamento.cartao_credito },
      { name: "C. Débito", value: totais.porFormaPagamento.cartao_debito },
    ].filter((item) => item.value > 0);
  }, [totais]);

  const barData = useMemo(() => {
    return relatorio.map((dia) => ({
      data: format(parseISO(dia.data), "dd/MM"),
      Dinheiro: dia.dinheiro,
      PIX: dia.pix,
      "C. Crédito": dia.cartao_credito,
      "C. Débito": dia.cartao_debito,
    }));
  }, [relatorio]);

  const handleExportCSV = () => {
    const headers = ["Data", "Dinheiro", "PIX", "C. Crédito", "C. Débito", "Sangrias", "Reforços", "Total"];
    const rows = relatorio.map((dia) => [
      format(parseISO(dia.data), "dd/MM/yyyy"),
      dia.dinheiro.toFixed(2),
      dia.pix.toFixed(2),
      dia.cartao_credito.toFixed(2),
      dia.cartao_debito.toFixed(2),
      dia.sangrias.toFixed(2),
      dia.reforcos.toFixed(2),
      dia.total.toFixed(2),
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `movimentacoes_${format(startDate, "yyyy-MM")}.csv`;
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
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Dinheiro</p>
              <p className="text-lg font-bold">{formatCurrency(totais?.porFormaPagamento.dinheiro || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">PIX</p>
              <p className="text-lg font-bold">{formatCurrency(totais?.porFormaPagamento.pix || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-violet-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">C. Crédito</p>
              <p className="text-lg font-bold">{formatCurrency(totais?.porFormaPagamento.cartao_credito || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">C. Débito</p>
              <p className="text-lg font-bold">{formatCurrency(totais?.porFormaPagamento.cartao_debito || 0)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Distribuição por Forma de Pagamento</h3>
          {pieData.length > 0 ? (
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </Card>

        {/* Bar Chart */}
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold mb-4">Vendas por Dia e Forma de Pagamento</h3>
          {barData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px]">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="data" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="Dinheiro" stackId="a" fill={COLORS[0]} />
                <Bar dataKey="PIX" stackId="a" fill={COLORS[1]} />
                <Bar dataKey="C. Crédito" stackId="a" fill={COLORS[2]} />
                <Bar dataKey="C. Débito" stackId="a" fill={COLORS[3]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </Card>
      </div>

      {/* Table */}
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Detalhamento Diário</h3>
        {relatorio.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Dinheiro</TableHead>
                  <TableHead className="text-right">PIX</TableHead>
                  <TableHead className="text-right">C. Crédito</TableHead>
                  <TableHead className="text-right">C. Débito</TableHead>
                  <TableHead className="text-right text-red-600">Sangrias</TableHead>
                  <TableHead className="text-right text-emerald-600">Reforços</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.map((dia) => (
                  <TableRow key={dia.data}>
                    <TableCell className="font-medium">
                      {format(parseISO(dia.data), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(dia.dinheiro)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dia.pix)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dia.cartao_credito)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(dia.cartao_debito)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(dia.sangrias)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(dia.reforcos)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(dia.total)}</TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(totais?.porFormaPagamento.dinheiro || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totais?.porFormaPagamento.pix || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totais?.porFormaPagamento.cartao_credito || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totais?.porFormaPagamento.cartao_debito || 0)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(totais?.totalSangrias || 0)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{formatCurrency(totais?.totalReforcos || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totais?.totalVendas || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma movimentação no período selecionado</p>
          </div>
        )}
      </Card>
    </div>
  );
};
