import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Gift, Loader2, Plus, Receipt, Smartphone, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useApplyPdvCustomerCredit, usePdvCustomerCreditSummary, usePdvLoyaltySummary, useRecordPdvPayment, useRedeemPdvLoyalty } from "@/hooks/usePdvPayments";
import { createPdvIdempotencyKey, type PdvPaymentMethod } from "@/lib/pdvPayment";

const PAYMENT_METHODS = [
  { id: "DINHEIRO" as const, label: "Dinheiro", icon: Banknote },
  { id: "PIX" as const, label: "PIX", icon: Smartphone },
  { id: "CARTAO_DEBITO" as const, label: "Débito", icon: CreditCard },
  { id: "CARTAO_CREDITO" as const, label: "Crédito", icon: CreditCard },
  { id: "FIDELIDADE" as const, label: "Pontos", icon: Gift },
  { id: "CREDITO_CLIENTE" as const, label: "Crédito cliente", icon: Wallet },
];

type ReceiptPaymentMethod = PdvPaymentMethod | "FIDELIDADE";
type SplitReceiptMethod = Exclude<PdvPaymentMethod, "FIDELIDADE" | "CREDITO_CLIENTE">;

interface ReceberPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumero: string;
  osId: string;
  clienteId: string;
  clienteNome: string;
  valorTotal: number;
  valorPago: number;
  onSuccess?: () => void;
  canUseLoyalty?: boolean;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

export function ReceberPagamentoModal({
  open,
  onOpenChange,
  osNumero,
  osId,
  clienteId,
  clienteNome,
  valorTotal,
  valorPago,
  onSuccess,
  canUseLoyalty = false,
}: ReceberPagamentoModalProps) {
  const valorPendente = Math.max(0, Math.round((valorTotal - (valorPago || 0)) * 100) / 100);
  const [formaPagamento, setFormaPagamento] = useState<ReceiptPaymentMethod>("DINHEIRO");
  const [valorPagamento, setValorPagamento] = useState(formatNumberToCurrency(valorPendente));
  const [valorEntregue, setValorEntregue] = useState(formatNumberToCurrency(valorPendente));
  const [parcelas, setParcelas] = useState(1);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => createPdvIdempotencyKey("receipt"));
  const [formasAdicionais, setFormasAdicionais] = useState<Array<{ id: string; method: SplitReceiptMethod; amount: string; key: string }>>([]);
  const [pontosResgate, setPontosResgate] = useState(0);
  const { data: caixaAberto } = useCaixaAberto();
  const recordPayment = useRecordPdvPayment();
  const redeemLoyalty = useRedeemPdvLoyalty();
  const applyCustomerCredit = useApplyPdvCustomerCredit();
  const { data: customerCredit, isLoading: isLoadingCustomerCredit } = usePdvCustomerCreditSummary(
    clienteId,
    open && formaPagamento === "CREDITO_CLIENTE",
  );
  const { data: loyalty, isLoading: isLoadingLoyalty } = usePdvLoyaltySummary(osId, canUseLoyalty && open && formaPagamento === "FIDELIDADE");

  useEffect(() => {
    if (!open) return;
    const formatted = formatNumberToCurrency(valorPendente);
    setFormaPagamento("DINHEIRO");
    setValorPagamento(formatted);
    setValorEntregue(formatted);
    setParcelas(1);
    setPontosResgate(0);
    setPaymentIdempotencyKey(createPdvIdempotencyKey("receipt"));
    setFormasAdicionais([]);
  }, [open, valorPendente]);

  useEffect(() => {
    if (formaPagamento !== "CARTAO_CREDITO") setParcelas(1);
  }, [formaPagamento]);

  const amount = parseCurrencyToNumber(valorPagamento);
  const pagamentosCombinados = useMemo(() => formaPagamento !== "FIDELIDADE" && formaPagamento !== "CREDITO_CLIENTE"
    ? [{ method: formaPagamento as SplitReceiptMethod, amount, key: paymentIdempotencyKey }, ...formasAdicionais.map((row) => ({ method: row.method, amount: parseCurrencyToNumber(row.amount), key: row.key }))]
    : [], [amount, formaPagamento, formasAdicionais, paymentIdempotencyKey]);
  const totalCombinado = pagamentosCombinados.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const saldoAposEsteRecebimento = Math.max(0, Math.round((valorPendente - (formasAdicionais.length ? totalCombinado : (Number.isFinite(amount) ? amount : 0))) * 100) / 100);
  const tendered = parseCurrencyToNumber(valorEntregue);
  const change = formaPagamento === "DINHEIRO" && tendered >= amount
    ? Math.round((tendered - amount) * 100) / 100
    : 0;
  const canSubmit = useMemo(() => {
    if (!caixaAberto) return false;
    if (formaPagamento === "FIDELIDADE") {
      const valorResgate = Math.round((pontosResgate * Number(loyalty?.valorPorPonto ?? 0)) * 100) / 100;
      return canUseLoyalty && Boolean(loyalty?.programaAtivo)
        && Number.isInteger(pontosResgate)
        && pontosResgate >= Number(loyalty.pontosMinimosResgate)
        && pontosResgate <= Number(loyalty.saldoPontos)
        && valorResgate > 0
        && valorResgate <= valorPendente + 0.009;
    }
    if (formaPagamento === "CREDITO_CLIENTE") {
      return !isLoadingCustomerCredit
        && Number.isFinite(amount) && amount > 0 && amount <= valorPendente
        && amount <= Number(customerCredit?.saldo ?? 0) + 0.009;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > valorPendente) return false;
    if (formasAdicionais.some((row) => !Number.isFinite(parseCurrencyToNumber(row.amount)) || parseCurrencyToNumber(row.amount) <= 0)) return false;
    if (formasAdicionais.length && (totalCombinado > valorPendente + 0.009 || pagamentosCombinados.filter((row) => row.method === "PIX").length > 1)) return false;
    if (formaPagamento === "DINHEIRO" && tendered < amount) return false;
    return true;
  }, [amount, caixaAberto, canUseLoyalty, customerCredit?.saldo, formaPagamento, formasAdicionais, isLoadingCustomerCredit, loyalty, pagamentosCombinados, pontosResgate, tendered, totalCombinado, valorPendente]);

  const handleSubmit = async () => {
    if (!caixaAberto || !canSubmit) return;
    if (formasAdicionais.length) {
      const ordered = pagamentosCombinados;
      let recorded = 0;
      for (const payment of ordered) {
        try {
          await recordPayment.mutateAsync({
            orderId: osId,
            cashRegisterId: caixaAberto.id,
            moment: "RETIRADA",
            idempotencyKey: payment.key,
            payment: { method: payment.method, amount: payment.amount, amountReceived: payment.method === "DINHEIRO" ? payment.amount : undefined, installments: 1 },
          });
          recorded += payment.amount;
        } catch (error) {
          toast.error(`${recorded > 0 ? `${formatCurrency(recorded)} já foi registrado. ` : ""}Não foi possível registrar ${payment.method}: ${error instanceof Error ? error.message : "erro no serviço"}. Confira o histórico antes de tentar novamente.`);
          return;
        }
      }
      toast.success(`Recebimento de ${formatCurrency(recorded)} registrado em ${ordered.length} formas.`);
      onOpenChange(false);
      onSuccess?.();
      return;
    }
    if (formaPagamento === "FIDELIDADE") {
      try {
        const payment = await redeemLoyalty.mutateAsync({
          orderId: osId,
          cashRegisterId: caixaAberto.id,
          moment: "RETIRADA",
          points: pontosResgate,
          idempotencyKey: createPdvIdempotencyKey("loyalty"),
        });
        const value = Number(payment.redeemedValue ?? 0);
        toast.success(`${pontosResgate} pontos resgatados${value > 0 ? ` (${formatCurrency(value)})` : ""}`);
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao resgatar pontos");
      }
      return;
    }

    if (formaPagamento === "CREDITO_CLIENTE") {
      try {
        const payment = await applyCustomerCredit.mutateAsync({
          orderId: osId,
          cashRegisterId: caixaAberto.id,
          moment: "RETIRADA",
          amount,
          idempotencyKey: paymentIdempotencyKey,
        });
        toast.success(`Crédito de ${formatCurrency(amount)} aplicado. Saldo restante: ${formatCurrency(Number(payment.saldoCredito ?? 0))}`);
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao aplicar o crédito do cliente");
      }
      return;
    }

    try {
      await recordPayment.mutateAsync({
        orderId: osId,
        cashRegisterId: caixaAberto.id,
        moment: "RETIRADA",
        idempotencyKey: paymentIdempotencyKey,
        payment: {
          method: formaPagamento,
          amount,
          amountReceived: formaPagamento === "DINHEIRO" ? tendered : undefined,
          installments: formaPagamento === "CARTAO_CREDITO" ? parcelas : 1,
          brand: undefined,
          nsu: undefined,
          authorizationCode: undefined,
        },
      });
      toast.success(`Pagamento de ${formatCurrency(amount)} registrado com sucesso`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao registrar pagamento");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pdv-compact-dialog pdv-receive-payment-dialog border-strong bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Receber pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="pdv-receive-payment-body">
          <div className="pdv-receive-order rounded-lg bg-muted/50 p-2.5">
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">ROL</span><strong>{osNumero}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">Cliente</span><span className="truncate font-medium">{clienteNome}</span></div>
          </div>

          <div className="pdv-receive-totals grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/30 p-2 text-center">
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="font-semibold">{formatCurrency(valorTotal)}</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2 text-center">
              <p className="text-xs text-muted-foreground">Saldo pendente</p>
              <p className="font-bold text-destructive">{formatCurrency(valorPendente)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 rounded-lg border border-strong p-2 sm:grid-cols-3">
            <div className="text-center"><p className="text-xs text-muted-foreground">Já pago</p><strong>{formatCurrency(valorPago)}</strong></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">Nesta operação</p><strong>{formatCurrency(formasAdicionais.length ? totalCombinado : (Number.isFinite(amount) ? amount : 0))}</strong></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">{pagamentosCombinados.some((row) => row.method === "PIX") ? "Saldo após confirmar PIX" : "Saldo após receber"}</p><strong>{formatCurrency(saldoAposEsteRecebimento)}</strong></div>
          </div>

          <div className="pdv-receive-method-picker">
            <Label>Forma de pagamento</Label>
            <div className="pdv-receive-method-options">
              {PAYMENT_METHODS.filter((method) => method.id !== "FIDELIDADE" || canUseLoyalty).map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.id}
                    type="button"
                    variant={formaPagamento === method.id ? "default" : "outline"}
                    className="h-9 gap-1 px-2"
                    onClick={() => setFormaPagamento(method.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{method.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {formaPagamento !== "FIDELIDADE" && formaPagamento !== "CREDITO_CLIENTE" && (
            <div className="space-y-2 rounded-lg border border-strong p-2.5">
              {formasAdicionais.map((row, index) => (
                <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.8fr)_auto] items-end gap-2">
                  <div className="space-y-1"><Label>Outra forma</Label><select aria-label={`Forma adicional ${index + 1}`} className="h-9 w-full rounded-md border border-strong bg-background px-2 text-sm" value={row.method} onChange={(event) => setFormasAdicionais((rows) => rows.map((item) => item.id === row.id ? { ...item, method: event.target.value as SplitReceiptMethod } : item))}><option value="DINHEIRO">Dinheiro</option><option value="PIX">PIX</option><option value="CARTAO_CREDITO">Crédito</option><option value="CARTAO_DEBITO">Débito</option></select></div>
                  <div className="space-y-1"><Label>Valor</Label><CurrencyInput value={row.amount} onChange={(event) => setFormasAdicionais((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} className="h-9" /></div>
                  <Button type="button" size="icon" variant="outline" aria-label="Remover forma adicional" onClick={() => setFormasAdicionais((rows) => rows.filter((item) => item.id !== row.id))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
              <div className="flex items-center justify-between gap-2">
                <Button type="button" size="sm" variant="outline" disabled={formasAdicionais.length >= 3} onClick={() => setFormasAdicionais((rows) => [...rows, { id: crypto.randomUUID(), method: "PIX", amount: formatNumberToCurrency(0), key: createPdvIdempotencyKey("pix") }])}><Plus className="mr-1 h-4 w-4" />Adicionar forma</Button>
                {formasAdicionais.length > 0 && <span className="text-xs font-semibold">Total desta operação: {formatCurrency(totalCombinado)}</span>}
              </div>
              {formasAdicionais.length > 0 && <p className="text-xs text-muted-foreground">Confirme cada valor na maquininha antes de registrar. O Pix será lançado como recebido após sua confirmação manual. Saldo após esta operação: {formatCurrency(saldoAposEsteRecebimento)}.</p>}
            </div>
          )}

          {formaPagamento !== "FIDELIDADE" && (
            <div className="pdv-receive-amount space-y-1.5">
              <Label>Valor deste pagamento</Label>
              <CurrencyInput
                value={valorPagamento}
                onChange={(event) => {
                  setValorPagamento(event.target.value);
                  if (formaPagamento === "DINHEIRO") setValorEntregue(event.target.value);
                }}
                className="h-9 text-base font-semibold"
              />
            </div>
          )}

          {formaPagamento === "DINHEIRO" && (
            <div className="pdv-receive-cash grid gap-2 rounded-lg border border-success/30 bg-success/5 p-2 sm:grid-cols-2">
              <div>
                <Label>Valor entregue</Label>
                <CurrencyInput value={valorEntregue} onChange={(event) => setValorEntregue(event.target.value)} className="mt-1" />
              </div>
              <div className="flex flex-col items-center justify-center rounded-md bg-success/10 p-2">
                <span className="text-xs text-muted-foreground">Troco</span>
                <strong className="text-xl text-success">{formatCurrency(change)}</strong>
              </div>
            </div>
          )}

          {formaPagamento.startsWith("CARTAO_") && (
            <p className="pdv-receive-note rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
              Cartão registrado somente como forma de pagamento. Nenhum dado do cartão é solicitado ou armazenado.
            </p>
          )}

          {formaPagamento === "PIX" && (
            <div className="pdv-receive-note rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
              Confirme {formatCurrency(amount)} no Pix da maquininha; ao confirmar aqui, o valor será lançado no caixa e no financeiro. Este PDV não gera QR Code nem cobrança online.
            </div>
          )}

          {formaPagamento === "FIDELIDADE" && (
            <div className="pdv-receive-note space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center gap-2 font-medium text-primary"><Gift className="h-4 w-4" /> Fidelidade do cliente</div>
              {isLoadingLoyalty ? (
                <p className="text-sm text-muted-foreground">Consultando saldo de pontos...</p>
              ) : !loyalty?.programaAtivo ? (
                <p className="text-sm text-muted-foreground">O programa de fidelidade está desativado para esta empresa.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Saldo</span><p className="font-bold">{loyalty.saldoPontos} pontos</p></div>
                    <div><span className="text-muted-foreground">Conversão</span><p className="font-bold">{formatCurrency(Number(loyalty.valorPorPonto))}/ponto</p></div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="loyalty-points">Pontos para resgatar (mínimo {loyalty.pontosMinimosResgate})</Label>
                    <Input id="loyalty-points" type="number" min={loyalty.pontosMinimosResgate} max={loyalty.saldoPontos} value={pontosResgate || ""} onChange={(event) => setPontosResgate(Math.max(0, Math.floor(Number(event.target.value) || 0)))} />
                    <p className="text-xs text-muted-foreground">Desconto estimado: {formatCurrency(Math.min(valorPendente, pontosResgate * Number(loyalty.valorPorPonto)))}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {formaPagamento === "CREDITO_CLIENTE" && (
            <div className="pdv-receive-note rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-primary"><Wallet className="h-4 w-4" /> Saldo pré-pago disponível</span>
                <strong>{isLoadingCustomerCredit ? "Consultando…" : formatCurrency(Number(customerCredit?.saldo ?? 0))}</strong>
              </div>
              {Number(customerCredit?.saldo ?? 0) < amount && !isLoadingCustomerCredit && <p className="mt-2 text-destructive">O saldo disponível não cobre este valor.</p>}
              <p className="mt-2 text-xs text-muted-foreground">Este recebimento reduz o saldo do cliente; não cria uma nova entrada de dinheiro no caixa.</p>
            </div>
          )}

          {!caixaAberto && (
            <div className="pdv-receive-note rounded-lg border border-warning bg-warning/10 p-2 text-center text-xs font-medium text-warning">
              Não há caixa aberto para registrar o pagamento.
            </div>
          )}
        </div>

        <DialogFooter className="pdv-receive-payment-footer gap-2">
          <Button className="h-9" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="h-9" onClick={handleSubmit} disabled={!canSubmit || recordPayment.isPending || redeemLoyalty.isPending || applyCustomerCredit.isPending}>
            {(recordPayment.isPending || redeemLoyalty.isPending || applyCustomerCredit.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formaPagamento === "FIDELIDADE" ? "Resgatar pontos" : formaPagamento === "CREDITO_CLIENTE" ? "Aplicar crédito" : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
