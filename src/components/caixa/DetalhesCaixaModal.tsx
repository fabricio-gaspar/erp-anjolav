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
import { type ClosedCashRegister, useCaixaMovimentacoes } from "@/hooks/useCaixa";
import { CashReportError } from "@/components/caixa/CashReportError";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const categoriaMovimentacaoLabel: Record<string, string> = {
  DEPOSITO_BANCARIO: "Depósito bancário",
  PAGAMENTO_FORNECEDOR: "Pagamento a fornecedor",
  DESPESA_OPERACIONAL: "Despesa operacional",
  ENVIO_AO_COFRE: "Envio ao cofre",
  RETIRADA_PROPRIETARIO: "Retirada do proprietário",
  OUTROS: "Outro motivo",
};

const optionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

interface DetalhesCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixa: ClosedCashRegister | null;
}

export const DetalhesCaixaModal = ({ open, onOpenChange, caixa }: DetalhesCaixaModalProps) => {
  const {
    data: movimentacoes = [],
    isLoading,
    isError,
    refetch,
  } = useCaixaMovimentacoes(caixa?.id);

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
      OUTROS: 0,
    };

    movimentacoes
      .filter((m) => m.tipo === "VENDA")
      .forEach((m) => {
        const forma = (m.forma_pagamento || "DINHEIRO").toUpperCase();
        const formaConhecida = forma in totais ? forma as keyof typeof totais : "OUTROS";
        totais[formaConhecida] += Number(m.valor) || 0;
      });

    return totais;
  }, [movimentacoes]);

  const conferenciaFechamento = useMemo(() => {
    const resumo = caixa?.fechamento_resumo;
    if (!resumo || typeof resumo !== "object") return [];
    const formas = [
      ["Dinheiro", "dinheiro_esperado", "dinheiro_contado", "diferenca_dinheiro"],
      ["PIX", "pix_esperado", "pix_conferido", "diferenca_pix"],
      ["Cartão de crédito", "cartao_credito_esperado", "cartao_credito_conferido", "diferenca_cartao_credito"],
      ["Cartão de débito", "cartao_debito_esperado", "cartao_debito_conferido", "diferenca_cartao_debito"],
      ["Outras formas", "outros_esperado", "outros_conferido", "diferenca_outros"],
    ] as const;
    return formas.map(([nome, esperadoKey, contadoKey, diferencaKey]) => {
      const esperado = optionalNumber(resumo[esperadoKey]);
      const contado = optionalNumber(resumo[contadoKey]);
      const diferencaSalva = optionalNumber(resumo[diferencaKey]);
      return {
        nome,
        esperado,
        contado,
        diferenca: diferencaSalva ?? (esperado !== null && contado !== null ? contado - esperado : null),
      };
    }).filter((item) => item.esperado !== null || item.contado !== null);
  }, [caixa?.fechamento_resumo]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!caixa) return;
    
    const headers = ["Tipo", "Descrição", "Categoria", "Responsável pela retirada", "Referência", "Forma Pagamento", "Valor", "Ocorrida em", "Registrada em"];
    const rows = movimentacoes.map((m) => [
      m.tipo,
      m.descricao || "-",
      m.categoria ? categoriaMovimentacaoLabel[m.categoria] || m.categoria : "-",
      m.responsavel_nome || "-",
      m.referencia || "-",
      m.forma_pagamento || "-",
      Number(m.valor).toFixed(2),
      format(new Date(m.ocorrido_em || m.created_at), "dd/MM/yyyy HH:mm"),
      format(new Date(m.created_at), "dd/MM/yyyy HH:mm"),
    ]);

    const csvCell = (value: string) => {
      const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replace(/"/g, '""')}"`;
    };
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => csvCell(String(value ?? ""))).join(";"))
      .join("\r\n");
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

          {caixa.status === "FECHADO" && conferenciaFechamento.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-4 font-semibold">Conferência do fechamento</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {conferenciaFechamento.map((forma) => (
                  <div key={forma.nome} className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 font-medium">{forma.nome}</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Esperado</p>
                        <p>{forma.esperado === null ? "—" : formatCurrency(forma.esperado)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conferido</p>
                        <p>{forma.contado === null ? "—" : formatCurrency(forma.contado)}</p>
                      </div>
                    </div>
                    {forma.diferenca !== null && (
                      <p className={cn("mt-2 text-sm font-medium", Math.abs(forma.diferenca) < 0.01 ? "text-emerald-600" : "text-destructive")}>
                        Diferença: {forma.diferenca > 0 ? "+" : ""}{formatCurrency(forma.diferenca)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isLoading ? (
            <Card className="flex min-h-36 items-center justify-center" aria-label="Carregando movimentações do caixa">
              <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-primary" />
            </Card>
          ) : isError ? (
            <CashReportError onRetry={() => void refetch()} />
          ) : (
          <>
          {/* Totais por Forma de Pagamento */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Vendas por Forma de Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Wallet className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Outros</p>
                  <p className="font-bold">{formatCurrency(totaisPorFormaPagamento.OUTROS)}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Movimentações */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Movimentações ({movimentacoes.length})</h3>
            {movimentacoes.length > 0 ? (
              <div className="overflow-x-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição / auditoria</TableHead>
                      <TableHead>Forma Pgto</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Ocorrida em</TableHead>
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
                        <TableCell className="max-w-sm text-sm">
                          <p className="text-muted-foreground">{mov.descricao || "-"}</p>
                          {(mov.categoria || mov.responsavel_nome || mov.referencia) && (
                            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                              {mov.categoria && <p>Finalidade: {categoriaMovimentacaoLabel[mov.categoria] || mov.categoria}</p>}
                              {mov.responsavel_nome && <p>Retirado por: {mov.responsavel_nome}</p>}
                              {mov.referencia && <p>Referência: {mov.referencia}</p>}
                            </div>
                          )}
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
                          {format(new Date(mov.ocorrido_em || mov.created_at), "dd/MM HH:mm", { locale: ptBR })}
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
          </>
          )}

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
