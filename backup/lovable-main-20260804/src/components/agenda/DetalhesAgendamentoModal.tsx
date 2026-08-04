import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMotoristas } from "@/hooks/useMotoristas";
import { Agendamento, AgendamentoUpdate } from "@/hooks/useAgendamentos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Truck, Calendar, Clock, User, MessageSquare } from "lucide-react";

interface DetalhesAgendamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamento: Agendamento | null;
  onSave: (id: string, updates: AgendamentoUpdate) => void;
}

export function DetalhesAgendamentoModal({
  open,
  onOpenChange,
  agendamento,
  onSave,
}: DetalhesAgendamentoModalProps) {
  const { motoristasAtivos } = useMotoristas();

  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [motoristaId, setMotoristaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (agendamento) {
      setData(agendamento.data);
      setHorario(agendamento.horario || "");
      setMotoristaId(agendamento.motorista_id || "");
      setObservacoes(agendamento.observacoes || "");
      setIsEditing(false);
    }
  }, [agendamento]);

  const handleSave = () => {
    if (agendamento) {
      onSave(agendamento.id, {
        data,
        horario: horario || null,
        motorista_id: motoristaId || null,
        observacoes: observacoes || null,
      });
      setIsEditing(false);
    }
  };

  const getStatusBadge = () => {
    if (!agendamento) return null;
    switch (agendamento.status) {
      case "agendado":
        return <Badge className="bg-blue-500">Agendado</Badge>;
      case "confirmado":
        return <Badge className="bg-primary">Confirmado</Badge>;
      case "realizado":
        return <Badge className="bg-emerald-500">Realizado</Badge>;
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return null;
    }
  };

  const getFrequencyLabel = () => {
    switch (agendamento?.frequencia) {
      case "semanal":
        return "Semanal";
      case "quinzenal":
        return "Quinzenal";
      case "mensal":
        return "Mensal";
      default:
        return "Único";
    }
  };

  if (!agendamento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {agendamento.tipo === "retirada" ? (
              <Package className="h-5 w-5 text-primary" />
            ) : (
              <Truck className="h-5 w-5 text-emerald-500" />
            )}
            Detalhes do Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cliente e Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-lg">{agendamento.cliente?.razao_social}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {agendamento.tipo} • {getFrequencyLabel()}
              </p>
            </div>
            {getStatusBadge()}
          </div>

          {/* Campos editáveis */}
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Data
                </Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                ) : (
                  <p className="text-sm py-2">
                    {format(new Date(agendamento.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Horário
                </Label>
                {isEditing ? (
                  <Input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                  />
                ) : (
                  <p className="text-sm py-2">
                    {agendamento.horario ? agendamento.horario.slice(0, 5) : "Não definido"}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Motorista
              </Label>
              {isEditing ? (
                <Select value={motoristaId} onValueChange={setMotoristaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {motoristasAtivos.map((motorista) => (
                      <SelectItem key={motorista.id} value={motorista.id}>
                        {motorista.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm py-2">
                  {agendamento.motorista?.nome || "Não atribuído"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Observações
              </Label>
              {isEditing ? (
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações..."
                  rows={3}
                />
              ) : (
                <p className="text-sm py-2 text-muted-foreground">
                  {agendamento.observacoes || "Nenhuma observação"}
                </p>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Salvar</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button onClick={() => setIsEditing(true)}>Editar</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
