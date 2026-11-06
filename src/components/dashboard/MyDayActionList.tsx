import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface MyDayAction {
  id: string;
  title: string;
  value: number | string;
  description: string;
  context: string;
  actionLabel: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "info" | "neutral";
  onOpen: () => void;
}

interface MyDayActionListProps {
  actions: MyDayAction[];
  isLoading?: boolean;
}

const toneStyles: Record<MyDayAction["tone"], { border: string; icon: string; value: string }> = {
  danger: {
    border: "border-destructive/25 bg-destructive/[0.035]",
    icon: "bg-destructive/10 text-destructive",
    value: "text-destructive",
  },
  warning: {
    border: "border-warning/30 bg-warning/[0.04]",
    icon: "bg-warning/12 text-warning",
    value: "text-warning",
  },
  info: {
    border: "border-info/25 bg-info/[0.035]",
    icon: "bg-info/10 text-info",
    value: "text-info",
  },
  neutral: {
    border: "border-border bg-card",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
  },
};

export function MyDayActionList({ actions, isLoading = false }: MyDayActionListProps) {
  return (
    <section aria-labelledby="my-day-actions-title" className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="my-day-actions-title" className="text-lg font-bold tracking-tight text-foreground">
            Atenção agora
          </h2>
          <p className="text-sm text-muted-foreground">
            Pendências e exceções que exigem uma próxima ação no seu escopo.
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {actions.length} {actions.length === 1 ? "fila acionável" : "filas acionáveis"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4" aria-label="Carregando tarefas do dia">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="flex min-h-28 items-center gap-3 rounded-xl border border-success/25 bg-success/[0.035] p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nenhuma exceção crítica agora</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Continue pelas ações rápidas ou acompanhe os indicadores abaixo.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => {
            const styles = toneStyles[action.tone];
            const Icon = action.icon;

            return (
              <article
                key={action.id}
                className={cn("flex min-h-40 flex-col rounded-xl border p-4 shadow-sm", styles.border)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-foreground">{action.title}</h3>
                      <span className={cn("text-2xl font-black leading-none", styles.value)}>{action.value}</span>
                    </div>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{action.description}</p>
                  </div>
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {action.context}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 shrink-0 gap-1.5 px-2 text-primary"
                    onClick={action.onOpen}
                    aria-label={`${action.actionLabel}: ${action.title}`}
                  >
                    {action.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
