import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertTriangle, CheckCircle, Clock3, Printer } from "lucide-react";
import { useFecharCaixa, Caixa, useResumoCaixa } from "@/hooks/useCaixa";
import { parseCurrencyToNumber } from "@/lib/currencyUtils";
import { cn } from "@/lib/utils";
import { createIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";
import { generateCashCloseReceiptHTML } from "@/lib/cashCloseReceipt";
import { printDocumentWhenReady, reservePrintWindow, writePrintDocument } from "@/lib/safePrint";

interface FecharCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
  caixa: Caixa;
}

interface ValoresEsperados {
  DINHEIRO: number;
  PIX: number;
  CARTAO_CREDITO: number;
  CARTAO_DEBITO: number;
  OUTROS: number;
}

const parseValue = (value: string) => parseCurrencyToNumber(value);

const calcularDiferenca = (contado: string, esperado: number) => {
  return parseValue(contado) - esperado;
};

export function FecharCaixaModal({
  open,
  onOpenChange,
  onClosed,
  caixa,
}: FecharCaixaModalProps) {
  const [valorDinheiro, setValorDinheiro] = useState("");
  const [valorPix, setValorPix] = useState("");
  const [valorCartaoCredito, setValorCartaoCredito] = useState("");
  const [valorCartaoDebito, setValorCartaoDebito] = useState("");
  const [valorOutros, setValorOutros] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const printAfterCloseRef = useRef(false);

  const fecharCaixa = useFecharCaixa();
  const { data: resumo, isLoading: resumoLoading, isError: resumoError, refetch: refetchResumo } = useResumoCaixa(caixa?.id, open);

  // Calculate expected values by payment method
  const valoresEsperados = useMemo<ValoresEsperados>(() => {
    const esperado: ValoresEsperados = {
      DINHEIRO: Number(resumo?.dinheiro ?? caixa?.valor_esperado ?? caixa?.valor_abertura ?? 0),
      PIX: Number(resumo?.pix ?? 0),
      CARTAO_CREDITO: Number(resumo?.cartaoCredito ?? 0),
      CARTAO_DEBITO: Number(resumo?.cartaoDebito ?? 0),
      OUTROS: Number(resumo?.outros ?? 0),
    };
    return esperado;
  }, [caixa, resumo]);

  useEffect(() => {
    if (!open) return;
    setValorDinheiro("");
    setValorPix("");
    setValorCartaoCredito("");
    setValorCartaoDebito("");
    setValorOutros("");
    setObservacoes("");
  }, [open]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const valoresInformados = [valorDinheiro, valorPix, valorCartaoCredito, valorCartaoDebito, valorOutros];
  const contagemCompleta = valoresInformados.every((value) => value.trim().length > 0);
  const contagemValida = valoresInformados.every((value) => Number.isFinite(parseValue(value)) && parseValue(value) >= 0);

  const diferencas = useMemo(() => {
    return {
      dinheiro: calcularDiferenca(valorDinheiro, valoresEsperados.DINHEIRO),
      pix: calcularDiferenca(valorPix, valoresEsperados.PIX),
      cartaoCredito: calcularDiferenca(valorCartaoCredito, valoresEsperados.CARTAO_CREDITO),
      cartaoDebito: calcularDiferenca(valorCartaoDebito, valoresEsperados.CARTAO_DEBITO),
      outros: calcularDiferenca(valorOutros, valoresEsperados.OUTROS),
    };
  }, [valorDinheiro, valorPix, valorCartaoCredito, valorCartaoDebito, valorOutros, valoresEsperados]);

  const diferencaTotal = useMemo(() => {
    if (!contagemCompleta) return 0;
    return diferencas.dinheiro + diferencas.pix + diferencas.cartaoCredito + diferencas.cartaoDebito + diferencas.outros;
  }, [contagemCompleta, diferencas]);

  const totalContado = useMemo(() => {
    if (!contagemCompleta) return 0;
    return parseValue(valorDinheiro) + parseValue(valorPix) +
           parseValue(valorCartaoCredito) + parseValue(valorCartaoDebito) + parseValue(valorOutros);
  }, [contagemCompleta, valorDinheiro, valorPix, valorCartaoCredito, valorCartaoDebito, valorOutros]);

  const totalEsperado = useMemo(() => {
    return valoresEsperados.DINHEIRO + valoresEsperados.PIX +
           valoresEsperados.CARTAO_CREDITO + valoresEsperados.CARTAO_DEBITO + valoresEsperados.OUTROS;
  }, [valoresEsperados]);

  const precisaJustificativa = contagemCompleta && Object.values(diferencas).some(
    (diferenca) => Math.abs(diferenca) > 0.009,
  );
  const resumoIndisponivel = !resumoLoading && !resumoError && !resumo;
  const resumoPendenciasDisponivel = typeof resumo?.pendenteRetirada === "number"
    && typeof resumo?.rolsPendentesRetirada === "number";
  const canSubmit = Boolean(resumo) && !resumoLoading && !resumoError && contagemCompleta && contagemValida && (!precisaJustificativa || observacoes.trim().length >= 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shouldPrint = printAfterCloseRef.current;
    printAfterCloseRef.current = false;
    const printWindow = shouldPrint
      ? reservePrintWindow("width=400,height=750,noopener,noreferrer")
      : null;
    if (shouldPrint && !printWindow) {
      toast.error("O navegador bloqueou a janela de impressão. Permita pop-ups e tente novamente.");
      return;
    }

    idempotencyKeyRef.current ??= createIdempotencyKey("cash-close");
    let fechamento: unknown;
    try {
      fechamento = await fecharCaixa.mutateAsync({
        caixa_id: caixa.id,
        valor_contado_dinheiro: parseValue(valorDinheiro),
        valor_contado_pix: parseValue(valorPix),
        valor_contado_cartao_credito: parseValue(valorCartaoCredito),
        valor_contado_cartao_debito: parseValue(valorCartaoDebito),
        valor_contado_outros: parseValue(valorOutros),
        observacoes: observacoes || undefined,
        idempotency_key: idempotencyKeyRef.current,
      });
    } catch {
      if (printWindow && !printWindow.closed) printWindow.close();
      return;
    }

    if (printWindow) {
      try {
        const returnedCloseDate = fechamento && typeof fechamento === "object" && "data_fechamento" in fechamento
          ? (fechamento as Record<string, unknown>).data_fechamento
          : null;
        const closedAt = typeof returnedCloseDate === "string" ? returnedCloseDate : new Date().toISOString();
        const html = generateCashCloseReceiptHTML({
          identifier: caixa.identificador_caixa || "Caixa principal",
          operator: caixa.operador,
          openedAt: resumo?.abertoEm ?? caixa.data_abertura,
          closedAt,
          openingFloat: Number(resumo?.fundoAbertura ?? caixa.valor_abertura ?? 0),
          sales: Number(resumo?.vendasLiquidas ?? 0),
          withdrawals: Number(resumo?.sangrias ?? 0),
          reinforcements: Number(resumo?.suprimentos ?? 0),
          pendingPickupAmount: Number(resumo?.pendenteRetirada ?? 0),
          pendingPickupOrders: Number(resumo?.rolsPendentesRetirada ?? 0),
          observations: observacoes,
          payments: [
            { label: "Dinheiro", expected: valoresEsperados.DINHEIRO, counted: parseValue(valorDinheiro) },
            { label: "PIX", expected: valoresEsperados.PIX, counted: parseValue(valorPix) },
            { label: "Cartão de crédito", expected: valoresEsperados.CARTAO_CREDITO, counted: parseValue(valorCartaoCredito) },
            { label: "Cartão de débito", expected: valoresEsperados.CARTAO_DEBITO, counted: parseValue(valorCartaoDebito) },
            { label: "Outras formas", expected: valoresEsperados.OUTROS, counted: parseValue(valorOutros) },
          ],
          totalExpected: totalEsperado,
          totalCounted: totalContado,
          totalDifference: diferencaTotal,
        });
        writePrintDocument(printWindow, html);
        if (!printDocumentWhenReady(printWindow)) {
          if (!printWindow.closed) printWindow.close();
          toast.error("O caixa foi fechado, mas o navegador não iniciou a impressão.");
        }
      } catch {
        if (!printWindow.closed) printWindow.close();
        toast.error("O caixa foi fechado, mas não foi possível preparar o cupom de conferência.");
      }
    }

    idempotencyKeyRef.current = null;
    onOpenChange(false);
    onClosed?.();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !fecharCaixa.isPending) {
      idempotencyKeyRef.current = null;
      printAfterCloseRef.current = false;
    }
    onOpenChange(nextOpen);
  };

  const renderDiferencaIndicator = (diferenca: number, pendente: boolean) => {
    if (pendente) return <span className="text-muted-foreground">Aguardando contagem</span>;
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar Caixa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {resumoLoading && <p role="status" className="text-sm text-muted-foreground">Atualizando o resumo transacional do caixa...</p>}
          {(resumoError || resumoIndisponivel) && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <span>{resumoError ? "Não foi possível conferir o caixa. O fechamento está bloqueado." : "Resumo do caixa indisponível. Atualize antes de fechar."}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchResumo()}>Tentar novamente</Button>
            </div>
          )}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Conte o dinheiro físico e confira PIX e cartões nos respectivos comprovantes/extratos. Informe R$ 0,00 nas formas sem movimento. O saldo de ROL para pagar na retirada aparece separado e não entra no caixa até o recebimento ser registrado.
          </div>
          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Operador</p>
                <p className="font-medium">{caixa?.operador}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Abertura</p>
                <p className="font-medium">{resumo?.abertoEm ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(resumo.abertoEm)) : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fundo de troco na abertura</p>
                <p className="font-medium">{formatCurrency(Number(resumo?.fundoAbertura ?? caixa?.valor_abertura ?? 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vendas já recebidas</p>
                <p className="font-medium text-emerald-600">{formatCurrency(Number(resumo?.vendasLiquidas ?? 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Recebido em dinheiro</p>
                <p className="font-medium">{typeof resumo?.dinheiroVendas === "number" ? formatCurrency(resumo.dinheiroVendas) : "resumo indisponível"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sangrias/Reforços</p>
                <p className="font-medium">
                  -{formatCurrency(Number(resumo?.sangrias ?? caixa?.valor_sangrias ?? 0))} / +{formatCurrency(Number(resumo?.suprimentos ?? caixa?.valor_reforcos ?? 0))}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">A receber na retirada: {resumoPendenciasDisponivel ? formatCurrency(resumo.pendenteRetirada) : "resumo indisponível"}</p>
                <p>{resumoPendenciasDisponivel ? `${resumo.rolsPendentesRetirada} ROL(s) desta abertura com saldo pendente. ` : "Atualize o sistema para consultar as pendências desta abertura. "}Esse valor não compõe o dinheiro esperado; entrará no caixa quando o pagamento for registrado.</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Dinheiro esperado = fundo de abertura + recebimentos em dinheiro − sangrias + reforços. PIX, crédito, débito e outras formas são conferidos separadamente.
            </p>
          </div>

          {/* Payment Method Inputs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contagem por Forma de Pagamento</h3>

            {/* Dinheiro */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label>Dinheiro (Contado)</Label>
                <CurrencyInput
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
                  {renderDiferencaIndicator(diferencas.dinheiro, !valorDinheiro.trim())}
                </div>
              </div>
            </div>

            {/* PIX */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label>PIX (Conferido)</Label>
                <CurrencyInput
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
                  {renderDiferencaIndicator(diferencas.pix, !valorPix.trim())}
                </div>
              </div>
            </div>

            {/* Cartão Crédito */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label>Cartão Crédito (Conferido)</Label>
                <CurrencyInput
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
                  {renderDiferencaIndicator(diferencas.cartaoCredito, !valorCartaoCredito.trim())}
                </div>
              </div>
            </div>

            {/* Cartão Débito */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label>Cartão Débito (Conferido)</Label>
                <CurrencyInput
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
                  {renderDiferencaIndicator(diferencas.cartaoDebito, !valorCartaoDebito.trim())}
                </div>
              </div>
            </div>

            {/* Outras formas */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-3 sm:grid-cols-3 sm:items-end">
              <div>
                <Label>Outras formas (Conferido)</Label>
                <CurrencyInput
                  value={valorOutros}
                  onChange={(e) => setValorOutros(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Esperado</Label>
                <p className="mt-1 py-2 px-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(valoresEsperados.OUTROS)}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Diferença</Label>
                <div className="mt-1 py-2 text-sm">
                  {renderDiferencaIndicator(diferencas.outros, !valorOutros.trim())}
                </div>
              </div>
            </div>
          </div>

          {/* Total Summary */}
          <div className={cn(
            "rounded-lg p-4",
            !contagemCompleta ? "bg-muted/30 border" : precisaJustificativa ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"
          )}>
            <div className="grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Contado</p>
                <p className="text-xl font-bold">{contagemCompleta ? formatCurrency(totalContado) : "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Esperado</p>
                <p className="text-xl font-bold">{formatCurrency(totalEsperado)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Diferença líquida</p>
                <p className={cn(
                  "text-xl font-bold",
                  precisaJustificativa ? "text-red-600" : "text-emerald-600"
                )}>
                  {contagemCompleta ? `${diferencaTotal >= 0 ? "+" : ""}${formatCurrency(diferencaTotal)}` : "—"}
                </p>
              </div>
            </div>
            
            {precisaJustificativa && (
              <div className="mt-3 text-center text-sm text-red-700">
                ⚠️ Há divergência em uma ou mais formas de pagamento; confira cada uma e justifique antes de fechar.
              </div>
            )}
            {!contagemCompleta && <p className="mt-3 text-center text-sm text-amber-700">Preencha todos os valores conferidos, inclusive com zero quando aplicável.</p>}
            {contagemCompleta && !contagemValida && <p role="alert" className="mt-3 text-center text-sm text-destructive">Os valores conferidos não podem ser negativos.</p>}
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label>Observações {precisaJustificativa ? "*" : "(opcional)"}</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={precisaJustificativa ? "Justifique a diferença (mínimo 5 caracteres)" : "Adicione observações sobre o fechamento..."}
              className="resize-none"
              maxLength={1000}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="outline" disabled={!canSubmit || fecharCaixa.isPending} onClick={() => { printAfterCloseRef.current = false; }}>
              {fecharCaixa.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Fechar caixa
            </Button>
            <Button type="submit" disabled={!canSubmit || fecharCaixa.isPending} onClick={() => { printAfterCloseRef.current = true; }}>
              {fecharCaixa.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Printer className="w-4 h-4 mr-2" />}
              Fechar e imprimir cupom
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
