import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Agendamento } from "@/hooks/useAgendamentos";

interface ObservacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onSave: (id: string, observacoes: string) => void;
}

export function ObservacaoModal({
  open,
  onOpenChange,
  agendamento,
  onSave,
}: ObservacaoModalProps) {
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (agendamento) {
      setObservacoes(agendamento.observacoes || "");
    }
  }, [agendamento]);

  const handleSave = () => {
    if (agendamento) {
      onSave(agendamento.id, observacoes);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Observação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Adicione uma observação para o agendamento de{" "}
            <strong>{agendamento?.cliente?.razao_social}</strong>.
          </p>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Digite suas observações..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
