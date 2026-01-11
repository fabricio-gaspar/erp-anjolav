import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ icon: Icon, title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("section-header", className)}>
      {Icon && (
        <div className="section-header-icon">
          <Icon />
        </div>
      )}
      <h2 className="section-title">{title}</h2>
      <div className="section-header-line" />
      {action}
    </div>
  );
}
