import { Package, Truck, MoreVertical, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Agendamento } from "@/hooks/useAgendamentos";
import { AgendaEventMenu } from "./AgendaEventMenu";

interface AgendaEventCardProps {
  agendamento: Agendamento;
  onMarkCompleted: (id: string) => void;
  onCancel: (agendamento: Agendamento) => void;
  onReschedule: (agendamento: Agendamento) => void;
  onAssignDriver: (agendamento: Agendamento) => void;
  onAddObservation: (agendamento: Agendamento) => void;
  onDelete: (agendamento: Agendamento) => void;
  onViewDetails: (agendamento: Agendamento) => void;
}

export function AgendaEventCard({
  agendamento,
  onMarkCompleted,
  onCancel,
  onReschedule,
  onAssignDriver,
  onAddObservation,
  onDelete,
  onViewDetails,
}: AgendaEventCardProps) {
  const isRetirada = agendamento.tipo === "retirada";
  const isCanceled = agendamento.status === "cancelado";
  const isCompleted = agendamento.status === "realizado";

  const getFrequencyLabel = () => {
    switch (agendamento.frequencia) {
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

  const getFrequencyBadgeClass = () => {
    switch (agendamento.frequencia) {
      case "semanal":
        return "bg-primary/10 text-primary border-primary/20";
      case "quinzenal":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "mensal":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  return (
    <div
      className={`p-2 rounded-md border-l-4 bg-card shadow-sm relative group cursor-pointer transition-opacity ${
        isRetirada ? "border-l-primary" : "border-l-emerald-500"
      } ${isCanceled ? "opacity-50 line-through" : ""} ${isCompleted ? "opacity-70" : ""}`}
      onClick={() => onViewDetails(agendamento)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm">
            {isRetirada ? (
              <Package className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            ) : (
              <Truck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            )}
            <span className="font-medium text-foreground truncate">
              {agendamento.cliente?.razao_social || "Cliente"}
            </span>
            {isCompleted && (
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
            )}
            {isCanceled && (
              <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="outline" className={`text-xs ${getFrequencyBadgeClass()}`}>
              {getFrequencyLabel()}
            </Badge>
            {agendamento.horario && (
              <Badge variant="outline" className="text-xs bg-muted/50">
                {agendamento.horario.slice(0, 5)}
              </Badge>
            )}
          </div>
          {agendamento.motorista && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              🚗 {agendamento.motorista.nome}
            </p>
          )}
        </div>
        <AgendaEventMenu
          agendamento={agendamento}
          onMarkCompleted={onMarkCompleted}
          onCancel={onCancel}
          onReschedule={onReschedule}
          onAssignDriver={onAssignDriver}
          onAddObservation={onAddObservation}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
