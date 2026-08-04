import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "danger" | "info" | "default";

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-destructive-light text-destructive",
  info: "bg-info-light text-info",
  default: "bg-muted text-muted-foreground",
};

export function StatusBadge({ variant = "default", children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
