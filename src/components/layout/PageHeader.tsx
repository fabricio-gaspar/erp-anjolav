import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 px-1 pb-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_rgba(0,158,227,0.45)]"
            aria-hidden="true"
          />
          <span className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground">
            {eyebrow}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm font-medium text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:mb-0.5">
          {actions}
        </div>
      )}
    </section>
  );
}
