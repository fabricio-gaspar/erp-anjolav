import { Truck, Package, Clock, ChevronRight, Route, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScheduleItem {
  id: string;
  clientName: string;
  time?: string;
  status: "pending" | "completed" | "in_progress";
  prontoEntrega?: boolean;
  osNumero?: string | null;
}

interface DailyScheduleProps {
  type: "pickup" | "delivery";
  items: ScheduleItem[];
  count: number;
  onGenerateRoute?: () => void;
  isGeneratingRoute?: boolean;
}

export function DailySchedule({ type, items, count, onGenerateRoute, isGeneratingRoute }: DailyScheduleProps) {
  const isPickup = type === "pickup";
  const Icon = isPickup ? Truck : Package;
  const title = isPickup ? "Retiradas do Dia" : "Entregas do Dia";

  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", isPickup ? "text-primary" : "text-success")} />
          <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {onGenerateRoute && items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onGenerateRoute();
              }}
              disabled={isGeneratingRoute}
            >
              {isGeneratingRoute ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Route className="w-3 h-3" />
              )}
              Gerar Rota
            </Button>
          )}
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            isPickup ? "bg-primary/8 text-primary" : "bg-success/8 text-success"
          )}>
            {count}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center">
          <Icon className="w-5 h-5 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">Nenhum agendamento para hoje</p>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-slate-50">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2.5 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400">
                    {item.clientName.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-slate-700 truncate">{item.clientName}</p>
                    {item.prontoEntrega && (
                      <Badge className="bg-success/10 text-success border-0 text-[9px] px-1.5 py-0 h-4">
                        PRONTO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {item.osNumero && <span className="text-primary font-medium">{item.osNumero}</span>}
                    {item.time && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {item.time}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium border-0",
                    item.status === "completed"
                      ? "bg-success/8 text-success"
                      : item.status === "in_progress"
                      ? "bg-warning/8 text-warning"
                      : "bg-slate-50 text-slate-400"
                  )}
                >
                  {item.status === "completed" ? "Concluído" : item.status === "in_progress" ? "Em Andamento" : "Pendente"}
                </Badge>
                <ChevronRight className="w-3.5 h-3.5 text-slate-200 group-hover:text-slate-400 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}