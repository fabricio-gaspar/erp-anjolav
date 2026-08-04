import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Agendamento } from "@/hooks/useAgendamentos";

interface CancelarAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onConfirm: (id: string, motivo: string) => void;
}

export function CancelarAgendamentoModal({
  open,
  onOpenChange,
  agendamento,
  onConfirm,
}: CancelarAgendamentoModalProps) {
  const [motivo, setMotivo] = useState("");

  const handleConfirm = () => {
    if (agendamento) {
      onConfirm(agendamento.id, motivo);
      setMotivo("");
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setMotivo("");
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Atendimento</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a cancelar o atendimento para{" "}
            <strong>{agendamento?.cliente?.razao_social}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label>Motivo do cancelamento (opcional)</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Informe o motivo do cancelamento..."
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Manter Agendado
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Confirmar Cancelamento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
