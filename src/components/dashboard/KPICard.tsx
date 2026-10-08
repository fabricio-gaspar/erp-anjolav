import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: "primary" | "success" | "warning" | "destructive" | "info";
  subtitle?: string;
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

export function KPICard({ title, value, icon: Icon, iconColor = "primary", subtitle, trend }: KPICardProps) {
  const styles = colorStyles[iconColor];

  return (
    <div className="kpi-card group hover:border-primary/50 transition-colors duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-[10.5px] font-black text-slate-400 group-hover:text-slate-500 transition-colors uppercase tracking-[0.15em] leading-tight mb-1">{title}</p>
          
          <span className="text-[34px] font-black text-[#0f172a] tracking-[-0.05em] leading-[0.9] block uppercase">
            {value}
          </span>
          
          {/* Subtitle */}
          {subtitle && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 line-clamp-1">{subtitle}</p>
          )}

          {/* Trend */}
          {trend && (
            <div className={cn(
              "kpi-card-trend",
              trend.direction === "up" && "text-success",
              trend.direction === "down" && "text-destructive",
              trend.direction === "neutral" && "text-slate-400"
            )}>
              {trend.direction === "up" && "↗"}
              {trend.direction === "down" && "↘"}
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        <div className="ml-2 flex-shrink-0">
          <div className={cn("kpi-card-icon", styles.iconBg)}>
            <Icon className={cn("w-4 h-4", styles.iconText)} />
          </div>
        </div>
      </div>
    </div>
  );
}
