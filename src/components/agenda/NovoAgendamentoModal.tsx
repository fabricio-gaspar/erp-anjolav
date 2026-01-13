import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { useClientes } from "@/hooks/useClientes";
import { useMotoristas } from "@/hooks/useMotoristas";
import { AgendamentoInsert } from "@/hooks/useAgendamentos";
import { format } from "date-fns";

interface NovoAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (agendamento: AgendamentoInsert) => void;
  defaultDate?: Date;
}

export function NovoAgendamentoModal({
  open,
  onOpenChange,
  onSave,
  defaultDate,
}: NovoAgendamentoModalProps) {
  const { clientes, isLoading: loadingClientes } = useClientes();
  const { motoristasAtivos, isLoading: loadingMotoristas } = useMotoristas();

  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState<"retirada" | "entrega">("retirada");
  const [data, setData] = useState(defaultDate ? format(defaultDate, "yyyy-MM-dd") : "");
  const [horario, setHorario] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState("unico");
  const [motoristaId, setMotoristaId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clienteId || !data) {
      return;
    }

    const agendamento: AgendamentoInsert = {
      cliente_id: clienteId,
      tipo,
      data,
      horario: horario || null,
      recorrente,
      frequencia: recorrente ? frequencia : "unico",
      motorista_id: motoristaId || null,
      observacoes: observacoes || null,
      status: "agendado",
    };

    onSave(agendamento);
    resetForm();
  };

  const resetForm = () => {
    setClienteId("");
    setTipo("retirada");
    setData("");
    setHorario("");
    setRecorrente(false);
    setFrequencia("unico");
    setMotoristaId("");
    setObservacoes("");
  };

  const clientesAtivos = clientes.filter((c) => c.ativo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Agendamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientesAtivos.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as "retirada" | "entrega")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retirada">Retirada</SelectItem>
                  <SelectItem value="entrega">Entrega</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário</Label>
              <Input
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Motorista</Label>
              <Select 
                value={motoristaId || "none"} 
                onValueChange={(v) => setMotoristaId(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={recorrente} onCheckedChange={setRecorrente} />
              <Label>Agendamento recorrente</Label>
            </div>
          </div>

          {recorrente && (
            <div className="space-y-2">
              <Label>Frequência</Label>
              <Select value={frequencia} onValueChange={setFrequencia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o agendamento..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!clienteId || !data}>
              Criar Agendamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
