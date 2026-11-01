import { cn } from "@/lib/utils";
import { ArrowUpRight, LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "destructive" | "info";
  subtitle?: string;
  context?: string;
  onOpen?: () => void;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

const colorStyles = {
  primary: {
    iconBg: "bg-primary/8",
    iconText: "text-primary",
  },
  success: {
    iconBg: "bg-success/8",
    iconText: "text-success",
  },
  warning: {
    iconBg: "bg-warning/8",
    iconText: "text-warning",
  },
  destructive: {
    iconBg: "bg-destructive/8",
    iconText: "text-destructive",
  },
  info: {
    iconBg: "bg-info/8",
    iconText: "text-info",
  },
};

export function KPICard({
  title,
  value,
  icon: Icon,
  iconColor = "primary",
  subtitle,
  context,
  onOpen,
  trend,
}: KPICardProps) {
  const styles = colorStyles[iconColor];
  const content = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground transition-colors group-hover:text-foreground">
          {title}
        </p>

        <span className="block text-[28px] font-bold leading-none tracking-[-0.04em] text-foreground">
          {value}
        </span>

        {subtitle && (
          <p className="mt-2 line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">
            {subtitle}
          </p>
        )}

        {context && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {context}
          </p>
        )}

        {trend && (
          <div className={cn(
            "kpi-card-trend",
            trend.direction === "up" && "text-success",
            trend.direction === "down" && "text-destructive",
            trend.direction === "neutral" && "text-muted-foreground"
          )}>
            {trend.direction === "up" && "↗"}
            {trend.direction === "down" && "↘"}
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-3">
        <div className={cn("kpi-card-icon", styles.iconBg)}>
          <Icon className={cn("h-4 w-4", styles.iconText)} />
        </div>
        {onOpen && <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />}
      </div>
    </div>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className="kpi-card group w-full text-left transition-colors duration-300 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={onOpen}
        aria-label={`Abrir lista de ${title}`}
      >
        {content}
      </button>
    );
  }

  return <div className="kpi-card group">{content}</div>;
}
