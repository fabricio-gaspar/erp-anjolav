import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Reusable page grammar for Administrative screens.
 *
 * Works with the existing AppLayout, PageHeader, shadcn/ui and CSS design tokens.
 * Do not use this wrapper to force a sidebar into the operational PDV.
 */
export function StandardScreen({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AppLayout title={title} subtitle={description}>
      <div className="page-shell mx-auto max-w-[1600px]">
        <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
        {children}
      </div>
    </AppLayout>
  );
}

export function StandardPanel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader className="flex flex-col gap-2 space-y-0 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base font-bold">{title}</CardTitle>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function StandardMetric({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning";
}) {
  const iconTone = {
    default: "bg-primary/10 text-primary",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
  }[tone];

  return (
    <Card className="min-w-0">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconTone)}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function StandardField({
  id,
  label,
  hint,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}{required && <span className="ml-1 text-destructive" aria-label="obrigatório">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
