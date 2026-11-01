import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  criarChaveOperacaoFatura,
  useFaturas,
  type Fatura,
} from "@/hooks/useFaturas";

interface CancelarFaturaModalProps {
  fatura: Fatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CancelarFaturaModal({ fatura, open, onOpenChange }: CancelarFaturaModalProps) {
  const { cancelarFatura } = useFaturas(undefined, undefined, false);
  const idempotencyKey = useRef(criarChaveOperacaoFatura("invoice-cancel"));
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    idempotencyKey.current = criarChaveOperacaoFatura("invoice-cancel");
  }, [open, fatura?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fatura || motivo.trim().length < 5) return;
    try {
      await cancelarFatura.mutateAsync({
        id: fatura.id,
        motivo: motivo.trim(),
        versao: Number(fatura.versao_financeira || 0),
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch {
      // The mutation toast keeps the dialog open so the operator can safely retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancelar fatura
          </DialogTitle>
          <DialogDescription>
            A fatura será preservada no histórico e os lançamentos voltarão para revisão. Faturas com recebimento, cobrança ou nota emitida exigem o processo correspondente antes do cancelamento.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="invoice-cancel-reason">Motivo do cancelamento *</Label>
            <Textarea
              id="invoice-cancel-reason"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Descreva por que esta fatura deve ser cancelada"
              className="text-base sm:text-sm"
              rows={4}
              required
            />
            <p className="text-xs text-muted-foreground">Mínimo de 5 caracteres. O motivo fica no histórico de auditoria.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Manter fatura
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="min-h-11"
              disabled={!fatura || motivo.trim().length < 5 || cancelarFatura.isPending}
            >
              {cancelarFatura.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
