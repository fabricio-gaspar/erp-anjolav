import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Agendamento } from "@/hooks/useAgendamentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReagendarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onSave: (id: string, novaData: string, novoHorario: string | null) => void;
}

export function ReagendarModal({
  open,
  onOpenChange,
  agendamento,
  onSave,
}: ReagendarModalProps) {
  const [novaData, setNovaData] = useState("");
  const [novoHorario, setNovoHorario] = useState("");

  useEffect(() => {
    if (agendamento) {
      setNovaData(agendamento.data);
      setNovoHorario(agendamento.horario || "");
    }
  }, [agendamento]);

  const handleSave = () => {
    if (agendamento && novaData) {
      onSave(agendamento.id, novaData, novoHorario || null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reagendar Atendimento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione a nova data e horário para o atendimento de{" "}
            <strong>{agendamento?.cliente?.razao_social}</strong>.
          </p>

          {agendamento && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="text-muted-foreground">Data atual:</p>
              <p className="font-medium">
                {format(new Date(agendamento.data + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {agendamento.horario && ` às ${agendamento.horario.slice(0, 5)}`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nova Data *</Label>
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Novo Horário</Label>
              <Input
                type="time"
                value={novoHorario}
                onChange={(e) => setNovoHorario(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!novaData}>
              Reagendar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
