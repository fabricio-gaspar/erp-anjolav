import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Printer, 
  Download, 
  Clock, 
  User, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Smartphone,
  CreditCard,
  ArrowDown,
  ArrowUp
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Caixa, useCaixaMovimentacoes } from "@/hooks/useCaixa";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface DetalhesCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixa: Caixa | null;
}

export const DetalhesCaixaModal = ({ open, onOpenChange, caixa }: DetalhesCaixaModalProps) => {
  const { data: movimentacoes = [], isLoading } = useCaixaMovimentacoes(caixa?.id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totaisPorFormaPagamento = useMemo(() => {
    const totais = {
      DINHEIRO: 0,
      PIX: 0,
      CARTAO_CREDITO: 0,
      CARTAO_DEBITO: 0,
    };

    movimentacoes
      .filter((m) => m.tipo === "VENDA")
      .forEach((m) => {
        const forma = (m.forma_pagamento || "DINHEIRO") as keyof typeof totais;
        totais[forma] += Number(m.valor) || 0;
      });

    return totais;
  }, [movimentacoes]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!caixa) return;
    
    const headers = ["Tipo", "Descrição", "Forma Pagamento", "Valor", "Data/Hora"];
    const rows = movimentacoes.map((m) => [
      m.tipo,
      m.descricao || "-",
      m.forma_pagamento || "-",
      Number(m.valor).toFixed(2),
      format(new Date(m.created_at), "dd/MM/yyyy HH:mm"),
    ]);

    const csvContent = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `caixa_${format(new Date(caixa.data_fechamento || caixa.data_abertura), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  if (!caixa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes do Caixa</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Operador</span>
              </div>
              <p className="font-semibold mt-1">{caixa.operador}</p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Abertura</span>
              </div>
              <p className="font-semibold mt-1">
                {format(new Date(caixa.data_abertura), "dd/MM HH:mm", { locale: ptBR })}
              </p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>Fechamento</span>
              </div>
              <p className="font-semibold mt-1">
                {caixa.data_fechamento 
                  ? format(new Date(caixa.data_fechamento), "dd/MM HH:mm", { locale: ptBR })
                  : "-"}
              </p>
            </Card>

            <Card className="p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span>Status</span>
              </div>
              <Badge variant={caixa.status === "ABERTO" ? "default" : "secondary"} className="mt-1">
                {caixa.status}
              </Badge>
            </Card>
          </div>

          {/* Resumo Financeiro */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Resumo Financeiro</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Abertura</p>
                <p className="text-lg font-bold">{formatCurrency(Number(caixa.valor_abertura))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Vendas</p>
                <p className="text-lg font-bold text-emerald-600">{formatCurrency(Number(caixa.valor_vendas))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Reforços</p>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(Number(caixa.valor_reforcos))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sangrias</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(Number(caixa.valor_sangrias))}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Esperado</p>
                <p className="text-xl font-bold">{formatCurrency(Number(caixa.valor_esperado))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Contado</p>
                <p className="text-xl font-bold">{formatCurrency(Number(caixa.valor_contado) || 0)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Diferença</p>
                <p className={cn(
                  "text-xl font-bold flex items-center gap-1",
                  Number(caixa.diferenca) >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {Number(caixa.diferenca) >= 0 ? (
                    <TrendingUp className="w-5 h-5" />
                  ) : (
                    <TrendingDown className="w-5 h-5" />
                  )}
                  {Number(caixa.diferenca) >= 0 ? "+" : ""}{formatCurrency(Number(caixa.diferenca) || 0)}
                </p>
              </div>
            </div>
          </Card>

          {/* Totais por Forma de Pagamento */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Vendas por Forma de Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Wallet className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Dinheiro</p>
                  <p className="font-bold">{formatCurrency(totaisPorFormaPagamento.DINHEIRO)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">PIX</p>
                  <p className="font-bold">{formatCurrency(totaisPorFormaPagamento.PIX)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <CreditCard className="w-5 h-5 text-violet-600" />
                <div>
                  <p className="text-xs text-muted-foreground">C. Crédito</p>
                  <p className="font-bold">{formatCurrency(totaisPorFormaPagamento.CARTAO_CREDITO)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">C. Débito</p>
                  <p className="font-bold">{formatCurrency(totaisPorFormaPagamento.CARTAO_DEBITO)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Movimentações */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Movimentações ({movimentacoes.length})</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : movimentacoes.length > 0 ? (
              <div className="overflow-x-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Forma Pgto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>
                          {mov.tipo === "VENDA" && <ArrowDown className="w-4 h-4 text-emerald-600" />}
                          {mov.tipo === "SANGRIA" && <ArrowUp className="w-4 h-4 text-red-600" />}
                          {mov.tipo === "REFORCO" && <ArrowDown className="w-4 h-4 text-blue-600" />}
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            mov.tipo === "VENDA" ? "default" : 
                            mov.tipo === "SANGRIA" ? "destructive" : 
                            "secondary"
                          }>
                            {mov.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {mov.descricao || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mov.forma_pagamento?.replace("_", " ") || "-"}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          mov.tipo === "VENDA" && "text-emerald-600",
                          mov.tipo === "SANGRIA" && "text-red-600",
                          mov.tipo === "REFORCO" && "text-blue-600"
                        )}>
                          {mov.tipo === "SANGRIA" ? "-" : "+"}{formatCurrency(Number(mov.valor))}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {format(new Date(mov.created_at), "HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma movimentação registrada
              </p>
            )}
          </Card>

          {/* Observações */}
          {caixa.observacoes && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Observações</h3>
              <p className="text-sm text-muted-foreground">{caixa.observacoes}</p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
