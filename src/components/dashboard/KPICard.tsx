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

// Mini sparkline SVG paths for visual decoration
const sparklines = [
  "M0,20 L5,18 L10,22 L15,16 L20,19 L25,12 L30,15 L35,8 L40,10 L45,6 L50,8",
  "M0,15 L5,12 L10,18 L15,10 L20,14 L25,8 L30,12 L35,6 L40,9 L45,4 L50,7",
  "M0,10 L5,14 L10,8 L15,16 L20,12 L25,18 L30,14 L35,20 L40,16 L45,22 L50,18",
  "M0,18 L5,15 L10,20 L15,12 L20,16 L25,10 L30,14 L35,7 L40,11 L45,5 L50,9",
];

export function KPICard({ title, value, icon: Icon, iconColor = "primary", subtitle, trend }: KPICardProps) {
  const styles = colorStyles[iconColor];
  const sparkline = sparklines[Math.abs(title.length) % sparklines.length];
  const isDown = trend?.direction === "down";

  return (
    <div className="kpi-card group hover:border-primary/50 transition-colors duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="kpi-card-title group-hover:text-slate-500 transition-colors uppercase">{title}</p>

          {/* Value */}
          <span className="kpi-card-value block tracking-tighter">{value}</span>
          
          {/* Subtitle */}
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-400 mt-1 line-clamp-1">{subtitle}</p>
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

        {/* Sparkline */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
          <div className={cn("kpi-card-icon", styles.iconBg)}>
            <Icon className={cn("w-4 h-4", styles.iconText)} />
          </div>
          <svg width="40" height="20" viewBox="0 0 50 24" className="opacity-30 hidden xl:block">
            <path
              d={sparkline}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                trend?.direction === "down" ? "text-destructive" : "text-primary"
              )}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
