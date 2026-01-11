import { Truck, Package, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScheduleItem {
  id: string;
  clientName: string;
  time?: string;
  status: "pending" | "completed" | "in_progress";
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
      "card-bordered p-5",
      isPickup ? "border-l-primary" : "border-l-success"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isPickup ? "bg-primary/10" : "bg-success/10"
          )}>
            <Icon className={cn(
              "w-5 h-5",
              isPickup ? "text-primary" : "text-success"
            )} />
          </div>
          <h3 className="font-bold text-slate-800">{title}</h3>
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
        <div className="py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Icon className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Nenhum agendamento para hoje</p>
        </div>
      ) : (
        <div className="mt-4 space-y-0 divide-y divide-slate-100">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 group hover:bg-slate-50/50 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-slate-500">
                    {item.clientName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-slate-800">{item.clientName}</p>
                  {item.time && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {item.time}
                    </div>
                  )}
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
