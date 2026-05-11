import { Truck, Clock, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  AgendamentoPendente,
  useConfirmarRetiradaAgendamento,
} from "@/hooks/useFluxoProducao";

interface Props {
  agendamento: AgendamentoPendente;
}

export function AgendamentoCard({ agendamento }: Props) {
  const confirmar = useConfirmarRetiradaAgendamento();

  const hoje = new Date().toISOString().split("T")[0];
  const atrasado = agendamento.data < hoje;

  return (
    <div className="bg-card border border-dashed border-warning/50 rounded-lg p-3 shadow-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-warning" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">
            Agendado
          </span>
        </div>
        <StatusBadge variant={atrasado ? "danger" : "warning"} className="text-[10px]">
          {atrasado ? "Atrasado" : "Hoje"}
        </StatusBadge>
      </div>

      <p className="font-semibold text-sm text-foreground mb-2 line-clamp-1">
        {agendamento.cliente?.razao_social || "Cliente"}
      </p>

      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        {agendamento.horario && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{agendamento.horario.slice(0, 5)}</span>
          </div>
        )}
        {agendamento.motorista?.nome && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{agendamento.motorista.nome}</span>
          </div>
        )}
      </div>

      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          confirmar.mutate(agendamento);
        }}
        disabled={confirmar.isPending}
      >
        {confirmar.isPending ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          "Confirmar Retirada"
        )}
      </Button>
    </div>
  );
}
