import { Truck, Package, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
}

export function DailySchedule({ type, items, count }: DailyScheduleProps) {
  const isPickup = type === "pickup";
  const Icon = isPickup ? Truck : Package;
  const title = isPickup ? "Retiradas do Dia" : "Entregas do Dia";
  const colorClass = isPickup ? "primary" : "success";

  return (
    <div className={cn(
      "card-bordered p-3",
      isPickup ? "border-l-primary" : "border-l-success"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            isPickup ? "bg-primary/10" : "bg-success/10"
          )}>
            <Icon className={cn(
              "w-3.5 h-3.5",
              isPickup ? "text-primary" : "text-success"
            )} />
          </div>
          <h3 className="font-semibold text-sm text-slate-800">{title}</h3>
        </div>
        <Badge 
          className={cn(
            "rounded-full px-3 py-1 text-sm font-bold",
            isPickup 
              ? "bg-primary/10 text-primary border-primary/20" 
              : "bg-success/10 text-success border-success/20"
          )}
        >
          {count}
        </Badge>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="py-4 text-center">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
            <Icon className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Nenhum agendamento para hoje</p>
        </div>
      ) : (
        <div className="mt-2 space-y-0 divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 group hover:bg-slate-50/50 -mx-1 px-1 rounded-md transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-500">
                    {item.clientName.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{item.clientName}</p>
                    {item.prontoEntrega && (
                      <Badge className="bg-success text-success-foreground text-[9px] px-1.5 py-0 h-4 font-bold">
                        PRONTO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    {item.osNumero && (
                      <span className="font-medium text-primary">{item.osNumero}</span>
                    )}
                    {item.time && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.time}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    item.status === "completed"
                      ? "bg-success/10 text-success border-success/30"
                      : item.status === "in_progress"
                      ? "bg-warning/10 text-warning border-warning/30"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  )}
                >
                  {item.status === "completed"
                    ? "Concluído"
                    : item.status === "in_progress"
                    ? "Em Andamento"
                    : "Pendente"}
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
