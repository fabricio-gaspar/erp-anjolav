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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowUpCircle } from "lucide-react";
import { useAddMovimentacao } from "@/hooks/useCaixa";
import { toast } from "sonner";

interface SuprimentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaId: string;
}

export function SuprimentoModal({ open, onOpenChange, caixaId }: SuprimentoModalProps) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");

  const addMovimentacao = useAddMovimentacao();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valorNumerico = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    await addMovimentacao.mutateAsync({
      caixa_id: caixaId,
      tipo: "REFORCO",
      valor: valorNumerico,
      descricao: descricao.trim() || "Suprimento de caixa",
      forma_pagamento: "DINHEIRO",
    });

    setValor("");
    setDescricao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-success">
            <ArrowUpCircle className="w-5 h-5" />
            Suprimento de Caixa
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-success/10 text-success-foreground rounded-lg p-3 text-sm">
            <p>
              Suprimento é a adição de dinheiro ao caixa (reforço de troco).
              Será adicionado ao valor esperado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Motivo / Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reforço de troco, dinheiro do cofre..."
              rows={3}
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
            <Button
              type="submit"
              disabled={addMovimentacao.isPending}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              {addMovimentacao.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Confirmar Suprimento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
