import { LucideIcon } from "lucide-react";

interface FinanceiroKPIProps {
  label: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  color: string;
}

export function FinanceiroKPI({ label, value, subtitle, icon: Icon, color }: FinanceiroKPIProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}
