import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { parseCurrencyToNumber } from "@/lib/currencyUtils";
import { createPdvIdempotencyKey } from "@/lib/pdvPayment";
import { useSubtractPdvCustomerCredit, useTopUpPdvCustomerCredit, type PdvCustomerCreditSummary } from "@/hooks/usePdvPayments";

type CreditMethod = "DINHEIRO" | "CARTAO_CREDITO" | "CARTAO_DEBITO";

interface CreditoClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; name: string };
  cashRegisterId: string | null;
  canReceivePayments: boolean;
  summary?: PdvCustomerCreditSummary;
  isLoadingSummary?: boolean;
  mode?: "add" | "subtract";
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

export function CreditoClienteModal({
  open,
  onOpenChange,
  client,
  cashRegisterId,
  canReceivePayments,
  summary,
  isLoadingSummary = false,
  mode = "add",
}: CreditoClienteModalProps) {
  const [amountText, setAmountText] = useState("");
  const [receivedText, setReceivedText] = useState("");
  const [method, setMethod] = useState<CreditMethod>("DINHEIRO");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => createPdvIdempotencyKey("credit"));
  const topUpCredit = useTopUpPdvCustomerCredit();
  const subtractCredit = useSubtractPdvCustomerCredit();

  const amount = parseCurrencyToNumber(amountText);
  const receivedAmount = parseCurrencyToNumber(receivedText);
  const change = method === "DINHEIRO" && receivedAmount >= amount ? receivedAmount - amount : 0;
  const cardPayment = method.startsWith("CARTAO_");

  useEffect(() => {
    if (!open) return;
    setAmountText("");
    setReceivedText("");
    setMethod("DINHEIRO");
    setReason("");
    setIdempotencyKey(createPdvIdempotencyKey("credit"));
  }, [open, client.id]);

  useEffect(() => {
    if (method === "DINHEIRO" && mode === "add") setReceivedText(amountText);
  }, [amountText, method, mode]);

  const blockReason = useMemo(() => {
    if (!canReceivePayments || !cashRegisterId) return "É necessário ter permissão e caixa aberto para lançar crédito.";
    if (!Number.isFinite(amount) || amount <= 0) return "Informe um valor maior que zero.";
    if (mode === "subtract") {
      if (amount > Number(summary?.saldo ?? 0) + 0.009) return "O valor supera o crédito disponível.";
      if (reason.trim().length < 5) return "Informe o motivo do abatimento.";
      return null;
    }
    if (method === "DINHEIRO" && (!Number.isFinite(receivedAmount) || receivedAmount < amount)) return "O valor recebido deve cobrir o crédito lançado.";
    return null;
  }, [amount, canReceivePayments, cashRegisterId, method, mode, reason, receivedAmount, summary?.saldo]);

  const handleSubmit = async () => {
    if (blockReason || !cashRegisterId) return;
    if (mode === "subtract") {
      try {
        const result = await subtractCredit.mutateAsync({ clientId: client.id, cashRegisterId, amount, reason: reason.trim(), idempotencyKey });
        toast.success(`Crédito abatido. Novo saldo: ${formatCurrency(result.saldo)}`);
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível abater o crédito");
      }
      return;
    }
    try {
      const result = await topUpCredit.mutateAsync({
        clientId: client.id,
        cashRegisterId,
        amount,
        amountReceived: method === "DINHEIRO" ? receivedAmount : amount,
        method,
        brand: undefined,
        nsu: undefined,
        authorizationCode: undefined,
        idempotencyKey,
      });
      toast.success(`Crédito adicionado. Novo saldo: ${formatCurrency(result.saldo)}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o crédito");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> {mode === "subtract" ? "Abater crédito do cliente" : "Adicionar crédito do cliente"}</DialogTitle>
          <DialogDescription>{mode === "subtract" ? `Retire um valor do saldo pré-pago de ${client.name} com motivo obrigatório.` : `Registre um valor pré-pago para ${client.name}. O lançamento também será registrado no caixa aberto.`}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <span className="text-sm text-muted-foreground">Saldo disponível</span>
            <strong className="text-lg">{isLoadingSummary ? "Consultando…" : formatCurrency(Number(summary?.saldo ?? 0))}</strong>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-credit-amount">{mode === "subtract" ? "Valor para abater" : "Valor para adicionar"}</Label>
            <CurrencyInput id="customer-credit-amount" autoFocus value={amountText} onChange={(event) => setAmountText(event.target.value)} />
          </div>

          {mode === "subtract" && <div className="space-y-2"><Label htmlFor="customer-credit-reason">Motivo do abatimento *</Label><Textarea id="customer-credit-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1200} rows={3} placeholder="Ex.: devolução de crédito autorizada pelo cliente" /></div>}

          {mode === "add" && <div className="space-y-2">
            <Label>Forma de recebimento</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant={method === "DINHEIRO" ? "default" : "outline"} className="h-12 gap-2" onClick={() => setMethod("DINHEIRO")}><Banknote className="h-4 w-4" /> Dinheiro</Button>
              <Button type="button" variant={method === "CARTAO_DEBITO" ? "default" : "outline"} className="h-12 gap-2" onClick={() => setMethod("CARTAO_DEBITO")}><CreditCard className="h-4 w-4" /> Débito</Button>
              <Button type="button" variant={method === "CARTAO_CREDITO" ? "default" : "outline"} className="h-12 gap-2" onClick={() => setMethod("CARTAO_CREDITO")}><CreditCard className="h-4 w-4" /> Crédito</Button>
            </div>
          </div>}

          {mode === "add" && method === "DINHEIRO" && (
            <div className="grid gap-3 rounded-lg border border-success/30 bg-success/5 p-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="customer-credit-received">Valor recebido</Label>
                <CurrencyInput id="customer-credit-received" value={receivedText} onChange={(event) => setReceivedText(event.target.value)} />
              </div>
              <div className="flex flex-col justify-center rounded-md bg-success/10 p-2 text-center">
                <span className="text-xs text-muted-foreground">Troco</span>
                <strong className="text-lg text-success">{formatCurrency(change)}</strong>
              </div>
            </div>
          )}

          {mode === "add" && cardPayment && <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">Cartão registrado somente como forma de recebimento. Nenhum dado do cartão é solicitado ou armazenado.</p>}

          {!canReceivePayments && <p className="rounded-md border border-warning bg-warning/10 p-3 text-sm text-warning">Abra o caixa e confirme sua permissão para adicionar crédito.</p>}

          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Últimos lançamentos</h3>
            {isLoadingSummary ? <p className="text-sm text-muted-foreground">Carregando histórico…</p> : summary?.lancamentos.length ? (
              <div className="max-h-44 space-y-2 overflow-y-auto">
                {summary.lancamentos.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{entry.descricao}<span className="ml-2 text-xs text-muted-foreground">{new Date(entry.criadoEm).toLocaleDateString("pt-BR")}</span></span>
                    <strong className={entry.tipo === "USO" || entry.tipo === "AJUSTE_SAIDA" ? "shrink-0 text-muted-foreground" : "shrink-0 text-success"}>{entry.tipo === "USO" || entry.tipo === "AJUSTE_SAIDA" ? "−" : "+"}{formatCurrency(Number(entry.valor))}</strong>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhum movimento de crédito registrado.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={handleSubmit} disabled={Boolean(blockReason) || topUpCredit.isPending || subtractCredit.isPending}>
            {(topUpCredit.isPending || subtractCredit.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "subtract" ? "Abater crédito" : "Adicionar crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
