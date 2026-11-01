import { useRef, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { useAbrirCaixa } from "@/hooks/useCaixa";
import { parseCurrencyToNumber } from "@/lib/currencyUtils";
import { createIdempotencyKey } from "@/lib/idempotency";

interface AbrirCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AbrirCaixaModal({ open, onOpenChange }: AbrirCaixaModalProps) {
  const [valorAbertura, setValorAbertura] = useState("0");
  const idempotencyKeyRef = useRef<string | null>(null);

  const abrirCaixa = useAbrirCaixa();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const valor = parseCurrencyToNumber(valorAbertura);
    idempotencyKeyRef.current ??= createIdempotencyKey("cash-open");

    try {
      await abrirCaixa.mutateAsync({
        valor_abertura: isNaN(valor) ? 0 : valor,
        identificador_caixa: "principal",
        idempotency_key: idempotencyKeyRef.current,
      });
    } catch {
      return;
    }

    idempotencyKeyRef.current = null;
    setValorAbertura("0");
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !abrirCaixa.isPending) idempotencyKeyRef.current = null;
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Abrir Caixa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            O operador será identificado pela sessão autenticada e ficará registrado na abertura.
          </p>

          <div className="space-y-2">
            <Label htmlFor="valorAbertura">Valor de Abertura (Fundo de Troco)</Label>
            <CurrencyInput
              id="valorAbertura"
              value={valorAbertura}
              onChange={(e) => setValorAbertura(e.target.value)}
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
            <Button type="submit" disabled={abrirCaixa.isPending}>
              {abrirCaixa.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Abrir Caixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
