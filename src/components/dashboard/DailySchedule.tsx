import { Truck, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const bgColor = isPickup ? "bg-primary/10" : "bg-success/10";
  const iconColor = isPickup ? "text-primary" : "text-success";

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
          <h3 className="font-semibold text-foreground">{title}</h3>
        </div>
        <Badge variant="secondary" className="rounded-full">
          {count}
        </Badge>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum agendamento para hoje
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-2 border-t border-border"
            >
              <div>
                <p className="font-medium text-foreground text-sm">{item.clientName}</p>
                {item.time && (
                  <p className="text-xs text-muted-foreground">{item.time}</p>
                )}
              </div>
              <Badge
                variant={item.status === "completed" ? "default" : "secondary"}
                className={
                  item.status === "completed"
                    ? "bg-success text-success-foreground"
                    : item.status === "in_progress"
                    ? "bg-warning text-warning-foreground"
                    : ""
                }
              >
                {item.status === "completed"
                  ? "Concluído"
                  : item.status === "in_progress"
                  ? "Em Andamento"
                  : "Pendente"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
