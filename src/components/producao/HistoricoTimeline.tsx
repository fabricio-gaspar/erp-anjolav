import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Truck,
  Scissors,
  Droplets,
  Wind,
  Package,
  CheckCircle,
  XCircle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoricoProducao } from "@/hooks/useHistoricoProducao";

interface HistoricoTimelineProps {
  historico: HistoricoProducao[];
}

const etapaConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  retirada: { icon: Truck, color: "text-warning", label: "Retirado" },
  separacao: { icon: Scissors, color: "text-info", label: "Separação" },
  lavagem: { icon: Droplets, color: "text-primary", label: "Lavagem" },
  secagem: { icon: Timer, color: "text-primary", label: "Secagem" },
  passadoria: { icon: Wind, color: "text-purple-500", label: "Passadoria" },
  embalagem: { icon: Package, color: "text-success", label: "Embalagem" },
  expedicao: { icon: CheckCircle, color: "text-success", label: "Pronto Entrega" },
  entregue: { icon: CheckCircle, color: "text-muted-foreground", label: "Entregue" },
  cancelada: { icon: XCircle, color: "text-destructive", label: "Cancelada" },
};

export function HistoricoTimeline({ historico }: HistoricoTimelineProps) {
  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum registro no histórico
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {historico.map((registro, index) => {
        const config = etapaConfig[registro.etapa_nova] || {
          icon: CheckCircle,
          color: "text-muted-foreground",
          label: registro.etapa_nova,
        };
        const Icon = config.icon;
        const isLast = index === historico.length - 1;

        return (
          <div key={registro.id} className="relative flex gap-3">
            {/* Linha conectora */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
            )}

            {/* Ícone */}
            <div
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2",
                config.color.replace("text-", "border-")
              )}
            >
              <Icon className={cn("h-3 w-3", config.color)} />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(registro.created_at), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>

              {registro.funcionario?.nome && (
                <p className="text-xs text-muted-foreground mt-1">
                  Por: {registro.funcionario.nome}
                </p>
              )}

              {registro.observacoes && (
                <p className="text-xs mt-1 bg-muted/50 p-2 rounded">
                  {registro.observacoes}
                </p>
              )}

              {registro.tempo_na_etapa_anterior && (
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo na etapa anterior: {registro.tempo_na_etapa_anterior}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
