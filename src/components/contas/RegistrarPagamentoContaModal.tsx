import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
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
  criarChaveOperacaoFinanceira,
  useContasPagar,
  type ContaPagar,
  type RegistrarPagamentoContaInput,
} from "@/hooks/useContasPagar";
import { formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";

interface RegistrarPagamentoContaModalProps {
  conta: ContaPagar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAS_PAGAMENTO: Array<{
  value: RegistrarPagamentoContaInput["formaPagamento"];
  label: string;
}> = [
  { value: "PIX", label: "PIX" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "OUTRO", label: "Outro" },
];

export function RegistrarPagamentoContaModal({
  conta,
  open,
  onOpenChange,
}: RegistrarPagamentoContaModalProps) {
  const { registrarPagamento } = useContasPagar(false);
  const idempotencyKey = useRef(criarChaveOperacaoFinanceira("payable-payment"));
  const [valor, setValor] = useState("");
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formaPagamento, setFormaPagamento] = useState<RegistrarPagamentoContaInput["formaPagamento"]>("PIX");
  const [referencia, setReferencia] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const saldo = conta ? Math.max(Number(conta.valor) - Number(conta.valor_pago || 0), 0) : 0;

  useEffect(() => {
    if (!open || !conta) return;
    setValor(formatNumberToCurrency(saldo));
    setDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setFormaPagamento("PIX");
    setReferencia("");
    setObservacoes("");
    idempotencyKey.current = criarChaveOperacaoFinanceira("payable-payment");
  }, [conta, open, saldo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!conta) return;
    const numericValue = parseCurrencyToNumber(valor);
    if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > saldo + 0.009) return;

    try {
      await registrarPagamento.mutateAsync({
        id: conta.id,
        valor: numericValue,
        dataPagamento,
        formaPagamento,
        referencia: referencia || null,
        observacoes: observacoes || null,
        versao: conta.versao,
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch {
      // The mutation displays the error and the form remains open with its values.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {conta?.descricao ?? "Despesa"} · saldo de R$ {formatNumberToCurrency(saldo)}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payable-payment-value">Valor pago *</Label>
              <CurrencyInput
                id="payable-payment-value"
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payable-payment-date">Data do pagamento *</Label>
              <Input
                id="payable-payment-date"
                type="date"
                max={format(new Date(), "yyyy-MM-dd")}
                value={dataPagamento}
                onChange={(event) => setDataPagamento(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Forma de pagamento *</Label>
              <Select
                value={formaPagamento}
                onValueChange={(value) => setFormaPagamento(value as RegistrarPagamentoContaInput["formaPagamento"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payable-payment-reference">Referência</Label>
              <Input
                id="payable-payment-reference"
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
                placeholder="NSU, comprovante ou código"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payable-payment-notes">Observações</Label>
            <Textarea
              id="payable-payment-notes"
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Detalhes úteis para a conciliação"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={registrarPagamento.isPending || !conta}>
              {registrarPagamento.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
