import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowDownCircle, Info } from "lucide-react";
import { useAddMovimentacao } from "@/hooks/useCaixa";
import { parseCurrencyToNumber } from "@/lib/currencyUtils";
import { toast } from "sonner";
import { createIdempotencyKey } from "@/lib/idempotency";

interface SangriaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaId: string;
}

const formatLocalDateTime = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const CATEGORIAS_SANGRIA = [
  { value: "DEPOSITO_BANCARIO", label: "Depósito bancário" },
  { value: "PAGAMENTO_FORNECEDOR", label: "Pagamento a fornecedor" },
  { value: "DESPESA_OPERACIONAL", label: "Despesa operacional" },
  { value: "ENVIO_AO_COFRE", label: "Envio ao cofre" },
  { value: "RETIRADA_PROPRIETARIO", label: "Retirada do proprietário" },
  { value: "OUTROS", label: "Outro motivo" },
] as const;

export function SangriaModal({ open, onOpenChange, caixaId }: SangriaModalProps) {
  const { pathname } = useLocation();
  const operationType = pathname.includes("/industrial/") ? "industrial" as const : "domestico" as const;
  const [valor, setValor] = useState("");
  const [ocorridoEm, setOcorridoEm] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [referencia, setReferencia] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);

  const addMovimentacao = useAddMovimentacao();

  useEffect(() => {
    if (!open) return;
    setValor("");
    setOcorridoEm(formatLocalDateTime(new Date()));
    setResponsavelNome("");
    setCategoria("");
    setDescricao("");
    setReferencia("");
    idempotencyKeyRef.current = null;
  }, [open]);

  const resetForm = () => {
    setValor("");
    setOcorridoEm("");
    setResponsavelNome("");
    setCategoria("");
    setDescricao("");
    setReferencia("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valorNumerico = parseCurrencyToNumber(valor);
    const responsavel = responsavelNome.trim();
    const motivo = descricao.trim();
    const dataValida = ocorridoEm ? new Date(ocorridoEm) : null;

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (!dataValida || !Number.isFinite(dataValida.getTime())) {
      toast.error("Informe a data e o horário da retirada");
      return;
    }
    if (responsavel.length < 2) {
      toast.error("Informe quem está recebendo o valor da sangria");
      return;
    }
    if (!categoria) {
      toast.error("Selecione o motivo da sangria");
      return;
    }
    if (motivo.length < 5) {
      toast.error("Descreva o motivo com pelo menos 5 caracteres");
      return;
    }

    idempotencyKeyRef.current ??= createIdempotencyKey("cash-withdrawal");
    try {
      await addMovimentacao.mutateAsync({
        caixa_id: caixaId,
        tipo: "SANGRIA",
        valor: valorNumerico,
        descricao: motivo,
        ocorrido_em: dataValida.toISOString(),
        responsavel_nome: responsavel,
        categoria,
        referencia: referencia.trim() || undefined,
        operation_type: operationType,
        idempotency_key: idempotencyKeyRef.current,
      });
    } catch {
      return;
    }

    idempotencyKeyRef.current = null;
    resetForm();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !addMovimentacao.isPending) idempotencyKeyRef.current = null;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="pdv-compact-dialog pdv-withdrawal-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning">
            <ArrowDownCircle className="w-5 h-5" />
            Sangria de Caixa
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Informe valor, responsável e motivo. Operador e horário são registrados automaticamente.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sangria-valor">Valor retirado *</Label>
              <CurrencyInput
                id="sangria-valor"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sangria-data">Data e horário *</Label>
              <Input
                id="sangria-data"
                type="datetime-local"
                skipUppercase
                value={ocorridoEm}
                max={formatLocalDateTime(new Date())}
                onChange={(e) => setOcorridoEm(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sangria-responsavel">Pessoa que recebe/retira o valor *</Label>
            <Input
              id="sangria-responsavel"
              value={responsavelNome}
              onChange={(e) => setResponsavelNome(e.target.value)}
              placeholder="Nome completo"
              maxLength={120}
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sangria-categoria">Finalidade da sangria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="sangria-categoria" aria-label="Finalidade da sangria">
                <SelectValue placeholder="Selecione uma finalidade" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SANGRIA.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sangria-descricao">Detalhe do motivo *</Label>
            <Textarea
              id="sangria-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Explique para que o dinheiro será usado ou onde será depositado."
              minLength={5}
              maxLength={1000}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sangria-referencia">Comprovante ou referência (opcional)</Label>
            <Input
              id="sangria-referencia"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex.: número do depósito, recibo ou documento"
              maxLength={120}
            />
          </div>

          <DialogFooter data-pdv-dialog-footer>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={addMovimentacao.isPending}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {addMovimentacao.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Sangria
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
