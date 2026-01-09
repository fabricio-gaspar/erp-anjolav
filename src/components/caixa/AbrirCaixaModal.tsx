import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useAbrirCaixa } from "@/hooks/useCaixa";

interface AbrirCaixaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AbrirCaixaModal({ open, onOpenChange }: AbrirCaixaModalProps) {
  const [operador, setOperador] = useState("");
  const [valorAbertura, setValorAbertura] = useState("0");

  const abrirCaixa = useAbrirCaixa();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!operador.trim()) {
      return;
    }

    const valor = parseFloat(valorAbertura.replace(",", "."));
    
    await abrirCaixa.mutateAsync({
      operador: operador.trim(),
      valor_abertura: isNaN(valor) ? 0 : valor,
    });
    
    setOperador("");
    setValorAbertura("0");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Abrir Caixa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operador">Operador *</Label>
            <Input
              id="operador"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
              placeholder="Nome do operador"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valorAbertura">Valor de Abertura (Fundo de Troco)</Label>
            <Input
              id="valorAbertura"
              type="text"
              value={valorAbertura}
              onChange={(e) => setValorAbertura(e.target.value)}
              placeholder="0,00"
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
            <Button type="submit" disabled={abrirCaixa.isPending || !operador.trim()}>
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
