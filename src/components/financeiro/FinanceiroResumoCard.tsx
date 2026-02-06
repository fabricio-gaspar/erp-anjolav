import { LucideIcon } from "lucide-react";

interface FinanceiroResumoCardProps {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  items: { label: string; value: string; bold?: boolean }[];
}

export function FinanceiroResumoCard({ title, icon: Icon, iconColor, items }: FinanceiroResumoCardProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className={`text-xs ${item.bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
