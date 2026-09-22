import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Loader2, Receipt, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseCurrencyToNumber, formatNumberToCurrency } from "@/lib/currencyUtils";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { useRecordPdvPayment } from "@/hooks/usePdvPayments";
import { CARD_BRANDS, createPdvIdempotencyKey, type PdvPaymentMethod } from "@/lib/pdvPayment";

const PAYMENT_METHODS = [
  { id: "DINHEIRO" as const, label: "Dinheiro", icon: Banknote },
  { id: "PIX" as const, label: "PIX", icon: Smartphone },
  { id: "CARTAO_DEBITO" as const, label: "Débito", icon: CreditCard },
  { id: "CARTAO_CREDITO" as const, label: "Crédito", icon: CreditCard },
];

export interface PixRecebimentoRequest {
  orderId: string;
  orderNumber: string;
  amount: number;
  cashRegisterId: string;
  idempotencyKey: string;
}

interface ReceberPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  osNumero: string;
  osId: string;
  clienteNome: string;
  valorTotal: number;
  valorPago: number;
  onSuccess?: () => void;
  onRequestPix: (request: PixRecebimentoRequest) => void;
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
  clienteNome,
  valorTotal,
  valorPago,
  onSuccess,
  onRequestPix,
}: ReceberPagamentoModalProps) {
  const valorPendente = Math.max(0, Math.round((valorTotal - (valorPago || 0)) * 100) / 100);
  const [formaPagamento, setFormaPagamento] = useState<PdvPaymentMethod>("DINHEIRO");
  const [valorPagamento, setValorPagamento] = useState(formatNumberToCurrency(valorPendente));
  const [valorEntregue, setValorEntregue] = useState(formatNumberToCurrency(valorPendente));
  const [parcelas, setParcelas] = useState(1);
  const [bandeira, setBandeira] = useState("");
  const [nsu, setNsu] = useState("");
  const [codigoAutorizacao, setCodigoAutorizacao] = useState("");
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => createPdvIdempotencyKey("receipt"));
  const { data: caixaAberto } = useCaixaAberto();
  const recordPayment = useRecordPdvPayment();

  useEffect(() => {
    if (!open) return;
    const formatted = formatNumberToCurrency(valorPendente);
    setFormaPagamento("DINHEIRO");
    setValorPagamento(formatted);
    setValorEntregue(formatted);
    setParcelas(1);
    setBandeira("");
    setNsu("");
    setCodigoAutorizacao("");
    setPaymentIdempotencyKey(createPdvIdempotencyKey("receipt"));
  }, [open, valorPendente]);

  useEffect(() => {
    if (formaPagamento !== "CARTAO_CREDITO") setParcelas(1);
    if (!formaPagamento.startsWith("CARTAO_")) {
      setBandeira("");
      setNsu("");
      setCodigoAutorizacao("");
    }
  }, [formaPagamento]);

  const amount = parseCurrencyToNumber(valorPagamento);
  const tendered = parseCurrencyToNumber(valorEntregue);
  const change = formaPagamento === "DINHEIRO" && tendered >= amount
    ? Math.round((tendered - amount) * 100) / 100
    : 0;
  const canSubmit = useMemo(() => {
    if (!caixaAberto || !Number.isFinite(amount) || amount <= 0 || amount > valorPendente) return false;
    if (formaPagamento === "DINHEIRO" && tendered < amount) return false;
    if (formaPagamento.startsWith("CARTAO_") && (!bandeira || (!nsu.trim() && !codigoAutorizacao.trim()))) {
      return false;
    }
    return true;
  }, [amount, bandeira, caixaAberto, codigoAutorizacao, formaPagamento, nsu, tendered, valorPendente]);

  const handleSubmit = async () => {
    if (!caixaAberto || !canSubmit) return;
    if (formaPagamento === "PIX") {
      onOpenChange(false);
      onRequestPix({
        orderId: osId,
        orderNumber: osNumero,
        amount: valorPendente,
        cashRegisterId: caixaAberto.id,
        idempotencyKey: createPdvIdempotencyKey("pix"),
      });
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
          brand: formaPagamento.startsWith("CARTAO_") ? bandeira : undefined,
          nsu: nsu.trim() || undefined,
          authorizationCode: codigoAutorizacao.trim() || undefined,
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
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Receber pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">OS</span><strong>{osNumero}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">Cliente</span><span className="truncate font-medium">{clienteNome}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="font-semibold">{formatCurrency(valorTotal)}</p>
            </div>
            <div className="rounded-lg bg-destructive/10 p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo pendente</p>
              <p className="font-bold text-destructive">{formatCurrency(valorPendente)}</p>
            </div>
          </div>
          {valorPago > 0 && <div className="text-center"><Badge variant="secondary">Já pago: {formatCurrency(valorPago)}</Badge></div>}

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <Button
                    key={method.id}
                    type="button"
                    variant={formaPagamento === method.id ? "default" : "outline"}
                    className="h-14 flex-col gap-1 px-2"
                    onClick={() => setFormaPagamento(method.id)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs">{method.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {formaPagamento !== "PIX" && (
            <div className="space-y-2">
              <Label>Valor deste pagamento</Label>
              <CurrencyInput value={valorPagamento} onChange={(event) => setValorPagamento(event.target.value)} className="text-lg font-semibold" />
              <p className="text-xs text-muted-foreground">Permite recebimento parcial; o restante continuará pendente.</p>
            </div>
          )}

          {formaPagamento === "DINHEIRO" && (
            <div className="grid gap-3 rounded-lg border border-success/30 bg-success/5 p-3 sm:grid-cols-2">
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
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Bandeira</Label>
                  <Select value={bandeira} onValueChange={setBandeira}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {CARD_BRANDS.map((brand) => <SelectItem key={brand.value} value={brand.value}>{brand.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {formaPagamento === "CARTAO_CREDITO" && (
                  <div>
                    <Label htmlFor="receipt-installments">Parcelas</Label>
                    <Input
                      id="receipt-installments"
                      type="number"
                      min={1}
                      max={24}
                      value={parcelas}
                      onChange={(event) => setParcelas(Math.min(24, Math.max(1, Number(event.target.value) || 1)))}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="receipt-nsu">NSU</Label><Input id="receipt-nsu" value={nsu} onChange={(event) => setNsu(event.target.value)} maxLength={100} className="mt-1" /></div>
                <div><Label htmlFor="receipt-auth">Autorização</Label><Input id="receipt-auth" value={codigoAutorizacao} onChange={(event) => setCodigoAutorizacao(event.target.value)} maxLength={100} className="mt-1" /></div>
              </div>
              <p className="text-xs text-muted-foreground">Informe ao menos o NSU ou a autorização após a aprovação na maquininha. Nenhum dado sensível do cartão é armazenado.</p>
            </div>
          )}

          {formaPagamento === "PIX" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              Será gerado um QR Code dinâmico de {formatCurrency(valorPendente)}. A baixa ocorrerá automaticamente somente após a confirmação do provedor.
            </div>
          )}

          {!caixaAberto && (
            <div className="rounded-lg border border-warning bg-warning/10 p-3 text-center text-sm font-medium text-warning">
              Não há caixa aberto para registrar o pagamento.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || recordPayment.isPending}>
            {recordPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {formaPagamento === "PIX" ? "Gerar PIX" : "Confirmar recebimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
