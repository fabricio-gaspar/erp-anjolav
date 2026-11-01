import { MoreVertical, CheckCircle, XCircle, Calendar, User, MessageSquare } from "lucide-react";
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
}

export function AgendaEventMenu({
  agendamento,
  onMarkCompleted,
  onCancel,
  onReschedule,
  onAssignDriver,
  onAddObservation,
}: AgendaEventMenuProps) {
  const isCompleted = agendamento.status === "realizado";
  const isCanceled = agendamento.status === "cancelado";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ações do agendamento de ${agendamento.cliente?.razao_social || "cliente"}`}
          className="h-8 w-8 opacity-100 transition-opacity sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
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
        {!isCanceled && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onCancel(agendamento)}
              className="text-amber-600 focus:text-amber-600"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar atendimento
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
