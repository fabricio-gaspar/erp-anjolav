import { MoreVertical, CheckCircle, XCircle, Calendar, User, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Agendamento } from "@/hooks/useAgendamentos";

interface AgendaEventMenuProps {
  agendamento: Agendamento;
  onMarkCompleted: (id: string) => void;
  onCancel: (agendamento: Agendamento) => void;
  onReschedule: (agendamento: Agendamento) => void;
  onAssignDriver: (agendamento: Agendamento) => void;
  onAddObservation: (agendamento: Agendamento) => void;
  onDelete: (agendamento: Agendamento) => void;
}

export function AgendaEventMenu({
  agendamento,
  onMarkCompleted,
  onCancel,
  onReschedule,
  onAssignDriver,
  onAddObservation,
  onDelete,
}: AgendaEventMenuProps) {
  const isCompleted = agendamento.status === "realizado";
  const isCanceled = agendamento.status === "cancelado";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {!isCompleted && !isCanceled && (
          <DropdownMenuItem onClick={() => onMarkCompleted(agendamento.id)}>
            <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
            Marcar como realizado
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onAssignDriver(agendamento)}>
          <User className="h-4 w-4 mr-2" />
          Atribuir motorista
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReschedule(agendamento)}>
          <Calendar className="h-4 w-4 mr-2" />
          Reagendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAddObservation(agendamento)}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Adicionar observação
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isCanceled && (
          <DropdownMenuItem
            onClick={() => onCancel(agendamento)}
            className="text-amber-600 focus:text-amber-600"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancelar atendimento
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => onDelete(agendamento)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Excluir permanentemente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
