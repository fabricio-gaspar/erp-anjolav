import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "destructive" | "info";
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

const colorStyles = {
  primary: {
    border: "border-l-primary",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  success: {
    border: "border-l-success",
    iconBg: "bg-success/10",
    iconText: "text-success",
  },
  warning: {
    border: "border-l-warning",
    iconBg: "bg-warning/10",
    iconText: "text-warning",
  },
  destructive: {
    border: "border-l-destructive",
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
  },
  info: {
    border: "border-l-info",
    iconBg: "bg-info/10",
    iconText: "text-info",
  },
};

export function KPICard({ title, value, icon: Icon, iconColor = "primary", trend }: KPICardProps) {
  const styles = colorStyles[iconColor];

  return (
    <div className={cn(
      "kpi-card",
      styles.border
    )}>
      {/* Icon */}
      <div className={cn("kpi-card-icon", styles.iconBg)}>
        <Icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", styles.iconText)} />
      </div>

      {/* Title */}
      <p className="kpi-card-title">{title}</p>

      {/* Value */}
      <span className="kpi-card-value">{value}</span>

      {/* Trend (optional) */}
      {trend && (
        <div className={cn(
          "kpi-card-trend",
          trend.direction === "up" && "text-success",
          trend.direction === "down" && "text-destructive",
          trend.direction === "neutral" && "text-muted-foreground"
        )}>
          {trend.direction === "up" && "▲"}
          {trend.direction === "down" && "▼"}
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  );
}
