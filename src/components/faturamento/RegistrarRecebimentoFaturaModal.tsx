import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  criarChaveOperacaoFatura,
  useFaturas,
  type FormaRecebimentoFatura,
  type Fatura,
} from "@/hooks/useFaturas";
import { formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";

interface RegistrarRecebimentoFaturaModalProps {
  fatura: Fatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS: Array<{ value: FormaRecebimentoFatura; label: string }> = [
  { value: "PIX", label: "PIX" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "OUTRO", label: "Outro" },
];

export function RegistrarRecebimentoFaturaModal({
  fatura,
  open,
  onOpenChange,
}: RegistrarRecebimentoFaturaModalProps) {
  const { registrarPagamento } = useFaturas(undefined, undefined, false);
  const idempotencyKey = useRef(criarChaveOperacaoFatura("invoice-payment"));
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formaPagamento, setFormaPagamento] = useState<FormaRecebimentoFatura>("PIX");
  const [referencia, setReferencia] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const total = Number(fatura?.valor_total || 0);
  const recebido = Number(fatura?.valor_pago || 0);
  const saldo = Math.max(total - recebido, 0);
  const numericValue = parseCurrencyToNumber(valor);
  const hasValidValue = Number.isFinite(numericValue)
    && numericValue > 0
    && numericValue <= saldo + 0.009;

  useEffect(() => {
    if (!open || !fatura) return;
    setValor(formatNumberToCurrency(saldo));
    setDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setFormaPagamento("PIX");
    setReferencia("");
    setObservacoes("");
    idempotencyKey.current = criarChaveOperacaoFatura("invoice-payment");
  }, [fatura, open, saldo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fatura) return;
    if (!hasValidValue) return;

    try {
      await registrarPagamento.mutateAsync({
        id: fatura.id,
        valor: numericValue,
        dataPagamento,
        formaPagamento,
        referencia: referencia || null,
        observacoes: observacoes || null,
        versao: Number(fatura.versao_financeira || 0),
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch {
      // A mutation already presents the server message and keeps the same key for a safe retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            Registrar recebimento
          </DialogTitle>
          <DialogDescription>
            {fatura?.cliente?.razao_social ?? "Cliente"} · o valor será alocado às ordens desta fatura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
          <div>
            <span className="block text-xs text-muted-foreground">Fatura</span>
            <strong>R$ {formatNumberToCurrency(total)}</strong>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Recebido</span>
            <strong className="text-success">R$ {formatNumberToCurrency(recebido)}</strong>
          </div>
          <div>
            <span className="block text-xs text-muted-foreground">Saldo</span>
            <strong className="text-warning">R$ {formatNumberToCurrency(saldo)}</strong>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-value">Valor recebido *</Label>
              <CurrencyInput
                id="invoice-payment-value"
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                className="text-base sm:text-sm"
                required
              />
              <p
                className={numericValue > saldo + 0.009 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                aria-live="polite"
              >
                {numericValue > saldo + 0.009
                  ? `O valor não pode ultrapassar o saldo de R$ ${formatNumberToCurrency(saldo)}.`
                  : "Pode ser parcial, sem ultrapassar o saldo."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-date">Data do recebimento *</Label>
              <Input
                id="invoice-payment-date"
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={dataPagamento}
                onChange={(event) => setDataPagamento(event.target.value)}
                className="text-base sm:text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Forma de recebimento *</Label>
              <Select
                value={formaPagamento}
                onValueChange={(value) => setFormaPagamento(value as FormaRecebimentoFatura)}
              >
                <SelectTrigger className="min-h-11 text-base sm:text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-reference">Referência</Label>
              <Input
                id="invoice-payment-reference"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="NSU, comprovante ou código"
                className="text-base sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-payment-notes">Observações</Label>
            <Textarea
              id="invoice-payment-notes"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Informações úteis para a conciliação"
              className="text-base sm:text-sm"
              rows={3}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={registrarPagamento.isPending || !fatura || saldo <= 0 || !hasValidValue}
            >
              {registrarPagamento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
