import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { useFecharCaixa, Caixa, useCaixaMovimentacoes } from "@/hooks/useCaixa";
import { formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";

interface FecharCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixa: Caixa;
}

interface ValoresEsperados {
  DINHEIRO: number;
  PIX: number;
  CARTAO_CREDITO: number;
  CARTAO_DEBITO: number;
}

export function FecharCaixaModal({
  open,
  onOpenChange,
  caixa,
}: FecharCaixaModalProps) {
  const [valorDinheiro, setValorDinheiro] = useState("0");
  const [valorPix, setValorPix] = useState("0");
  const [valorCartaoCredito, setValorCartaoCredito] = useState("0");
  const [valorCartaoDebito, setValorCartaoDebito] = useState("0");
  const [observacoes, setObservacoes] = useState("");

  const fecharCaixa = useFecharCaixa();
  const { data: movimentacoes } = useCaixaMovimentacoes(caixa?.id);

  // Calculate expected values by payment method
  const valoresEsperados = useMemo<ValoresEsperados>(() => {
    const esperado: ValoresEsperados = {
      DINHEIRO: caixa?.valor_abertura || 0,
      PIX: 0,
      CARTAO_CREDITO: 0,
      CARTAO_DEBITO: 0,
    };

    movimentacoes?.forEach((mov) => {
      const formaPagamento = (mov.forma_pagamento || "DINHEIRO") as keyof ValoresEsperados;
      if (mov.tipo === "VENDA") {
        esperado[formaPagamento] += Number(mov.valor);
      } else if (mov.tipo === "SANGRIA") {
        esperado.DINHEIRO -= Number(mov.valor);
      } else if (mov.tipo === "REFORCO") {
        esperado.DINHEIRO += Number(mov.valor);
      }
    });

    return esperado;
  }, [caixa, movimentacoes]);

  useEffect(() => {
    if (open) {
      setValorDinheiro(formatNumberToCurrency(valoresEsperados.DINHEIRO));
      setValorPix(formatNumberToCurrency(valoresEsperados.PIX));
      setValorCartaoCredito(formatNumberToCurrency(valoresEsperados.CARTAO_CREDITO));
      setValorCartaoDebito(formatNumberToCurrency(valoresEsperados.CARTAO_DEBITO));
      setObservacoes("");
    }
  }, [open, valoresEsperados]);

  const parseValue = (value: string) => parseCurrencyToNumber(value);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calcularDiferenca = (contado: string, esperado: number) => {
    return parseValue(contado) - esperado;
  };

  const diferencas = useMemo(() => {
    return {
      dinheiro: calcularDiferenca(valorDinheiro, valoresEsperados.DINHEIRO),
      pix: calcularDiferenca(valorPix, valoresEsperados.PIX),
      cartaoCredito: calcularDiferenca(valorCartaoCredito, valoresEsperados.CARTAO_CREDITO),
      cartaoDebito: calcularDiferenca(valorCartaoDebito, valoresEsperados.CARTAO_DEBITO),
    };
  }, [valorDinheiro, valorPix, valorCartaoCredito, valorCartaoDebito, valoresEsperados]);

  const diferencaTotal = useMemo(() => {
    return diferencas.dinheiro + diferencas.pix + diferencas.cartaoCredito + diferencas.cartaoDebito;
  }, [diferencas]);

  const totalContado = useMemo(() => {
    return parseValue(valorDinheiro) + parseValue(valorPix) + 
           parseValue(valorCartaoCredito) + parseValue(valorCartaoDebito);
  }, [valorDinheiro, valorPix, valorCartaoCredito, valorCartaoDebito]);

  const totalEsperado = useMemo(() => {
    return valoresEsperados.DINHEIRO + valoresEsperados.PIX + 
           valoresEsperados.CARTAO_CREDITO + valoresEsperados.CARTAO_DEBITO;
  }, [valoresEsperados]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await fecharCaixa.mutateAsync({
      caixa_id: caixa.id,
      valor_contado_dinheiro: parseValue(valorDinheiro),
      valor_contado_pix: parseValue(valorPix),
      valor_contado_cartao_credito: parseValue(valorCartaoCredito),
      valor_contado_cartao_debito: parseValue(valorCartaoDebito),
      observacoes: observacoes || undefined,
    });
    
    onOpenChange(false);
  };

  const renderDiferencaIndicator = (diferenca: number) => {
    if (diferenca === 0) {
      return (
        <span className="flex items-center gap-1 text-emerald-600">
          <CheckCircle className="w-4 h-4" />
          Conferido
        </span>
      );
    }
    return (
      <span className={cn(
        "flex items-center gap-1",
        diferenca > 0 ? "text-emerald-600" : "text-red-600"
      )}>
        <AlertTriangle className="w-4 h-4" />
        {diferenca > 0 ? "+" : ""}{formatCurrency(diferenca)}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar Caixa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Operador</p>
                <p className="font-medium">{caixa?.operador}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Valor de Abertura</p>
                <p className="font-medium">{formatCurrency(caixa?.valor_abertura || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Vendas</p>
                <p className="font-medium text-emerald-600">{formatCurrency(caixa?.valor_vendas || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sangrias/Reforços</p>
                <p className="font-medium">
                  -{formatCurrency(caixa?.valor_sangrias || 0)} / +{formatCurrency(caixa?.valor_reforcos || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Method Inputs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contagem por Forma de Pagamento</h3>

            {/* Dinheiro */}
            <div className="grid grid-cols-3 gap-4 items-end p-3 rounded-lg border">
              <div>
                <Label>Dinheiro (Contado)</Label>
                <Input
                  type="text"
                  value={valorDinheiro}
                  onChange={(e) => setValorDinheiro(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Esperado</Label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(valoresEsperados.DINHEIRO)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Diferença</Label>
                <div className="mt-1 py-2 text-sm">
                  {renderDiferencaIndicator(diferencas.dinheiro)}
                </div>
              </div>
            </div>

            {/* PIX */}
            <div className="grid grid-cols-3 gap-4 items-end p-3 rounded-lg border">
              <div>
                <Label>PIX (Contado)</Label>
                <Input
                  type="text"
                  value={valorPix}
                  onChange={(e) => setValorPix(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Esperado</Label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(valoresEsperados.PIX)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Diferença</Label>
                <div className="mt-1 py-2 text-sm">
                  {renderDiferencaIndicator(diferencas.pix)}
                </div>
              </div>
            </div>

            {/* Cartão Crédito */}
            <div className="grid grid-cols-3 gap-4 items-end p-3 rounded-lg border">
              <div>
                <Label>Cartão Crédito (Contado)</Label>
                <Input
                  type="text"
                  value={valorCartaoCredito}
                  onChange={(e) => setValorCartaoCredito(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Esperado</Label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(valoresEsperados.CARTAO_CREDITO)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Diferença</Label>
                <div className="mt-1 py-2 text-sm">
                  {renderDiferencaIndicator(diferencas.cartaoCredito)}
                </div>
              </div>
            </div>

            {/* Cartão Débito */}
            <div className="grid grid-cols-3 gap-4 items-end p-3 rounded-lg border">
              <div>
                <Label>Cartão Débito (Contado)</Label>
                <Input
                  type="text"
                  value={valorCartaoDebito}
                  onChange={(e) => setValorCartaoDebito(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Esperado</Label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(valoresEsperados.CARTAO_DEBITO)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Diferença</Label>
                <div className="mt-1 py-2 text-sm">
                  {renderDiferencaIndicator(diferencas.cartaoDebito)}
                </div>
              </div>
            </div>
          </div>

          {/* Total Summary */}
          <div className={cn(
            "rounded-lg p-4",
            diferencaTotal === 0 ? "bg-emerald-50 border border-emerald-200" :
            diferencaTotal > 0 ? "bg-emerald-50 border border-emerald-200" :
            "bg-red-50 border border-red-200"
          )}>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Contado</p>
                <p className="text-xl font-bold">{formatCurrency(totalContado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Esperado</p>
                <p className="text-xl font-bold">{formatCurrency(totalEsperado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Diferença Total</p>
                <p className={cn(
                  "text-xl font-bold",
                  diferencaTotal === 0 ? "text-emerald-600" :
                  diferencaTotal > 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {diferencaTotal >= 0 ? "+" : ""}{formatCurrency(diferencaTotal)}
                </p>
              </div>
            </div>
            
            {diferencaTotal !== 0 && (
              <div className={cn(
                "mt-3 text-center text-sm",
                diferencaTotal > 0 ? "text-emerald-700" : "text-red-700"
              )}>
                {diferencaTotal > 0 
                  ? "⚠️ Sobra de caixa identificada" 
                  : "⚠️ Falta de caixa identificada"}
              </div>
            )}
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Adicione observações sobre o fechamento..."
              className="resize-none"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={fecharCaixa.isPending}>
              {fecharCaixa.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
