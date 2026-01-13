import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMotoristas } from "@/hooks/useMotoristas";
import { Agendamento } from "@/hooks/useAgendamentos";

interface AtribuirMotoristaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onSave: (id: string, motoristaId: string | null) => void;
}

export function AtribuirMotoristaModal({
  open,
  onOpenChange,
  agendamento,
  onSave,
}: AtribuirMotoristaModalProps) {
  const { motoristasAtivos } = useMotoristas();
  const [motoristaId, setMotoristaId] = useState("");

  useEffect(() => {
    if (agendamento) {
      setMotoristaId(agendamento.motorista_id || "");
    }
  }, [agendamento]);

  const handleSave = () => {
    if (agendamento) {
      onSave(agendamento.id, motoristaId || null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atribuir Motorista</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Selecione o motorista responsável pelo atendimento de{" "}
            <strong>{agendamento?.cliente?.razao_social}</strong>.
          </p>

          <div className="space-y-2">
            <Label>Motorista</Label>
            <Select 
              value={motoristaId || "none"} 
              onValueChange={(v) => setMotoristaId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motorista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {motoristasAtivos.map((motorista) => (
                  <SelectItem key={motorista.id} value={motorista.id}>
                    {motorista.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
