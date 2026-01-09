import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "destructive" | "info";
}

const iconColorStyles = {
  primary: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  info: "bg-info text-info-foreground",
};

export function KPICard({ title, value, icon: Icon, iconColor = "primary" }: KPICardProps) {
  return (
    <div className="kpi-card">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <div className={cn("kpi-card-icon", iconColorStyles[iconColor])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
