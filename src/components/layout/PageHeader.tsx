import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { PdvArea } from "@/lib/authorization";
import { getPdvReturnNavigation } from "@/lib/pdvNavigation";
import { usePdvModuleDialog } from "@/components/layout/PdvModuleDialog";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  const location = useLocation();
  const { pathname } = location;
  const navigate = useNavigate();
  const inPdvModuleDialog = usePdvModuleDialog();
  const isPdvPage = pathname.startsWith("/pdv/") || /^\/(residencial|industrial)(\/|$)/.test(pathname);
  const area: PdvArea = pathname.includes("industrial") ? "industrial" : "residencial";
  const pdvReturn = getPdvReturnNavigation(location.state, area);

  if (inPdvModuleDialog) {
    return actions ? (
      <div className="pdv-module-dialog__page-actions" data-pdv-page-actions>
        {actions}
      </div>
    ) : null;
  }

  return (
    <section
      className={cn(
        isPdvPage
          ? "pdv-page-heading"
          : "flex flex-col gap-3 border-b border-border/70 px-1 pb-5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
      data-pdv-page-header={isPdvPage ? "true" : undefined}
    >
      {isPdvPage && (
        <>
          <button
            type="button"
            className="pdv-page-heading__back"
            aria-label={pdvReturn.label}
            title={pdvReturn.label}
            onClick={() => navigate(pdvReturn.to)}
          >
            <ArrowLeft aria-hidden="true" />
            <span>Voltar</span>
          </button>
          <span className="pdv-page-heading__divider" aria-hidden="true" />
        </>
      )}
      <div className={cn("min-w-0", isPdvPage && "pdv-page-heading__main")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.35)]",
              isPdvPage && "pdv-page-heading__dot",
            )}
            aria-hidden="true"
          />
          <span className={cn(
            "text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground",
            isPdvPage && "pdv-page-heading__eyebrow",
          )}>
            {eyebrow}
          </span>
        </div>
        <h1 className={cn(
          "mt-1 text-[26px] font-bold tracking-[-0.035em] text-foreground sm:text-[28px]",
          isPdvPage && "pdv-page-heading__title",
        )}>
          {title}
        </h1>
        {description && (
          <p className={cn(
            "mt-1 max-w-3xl text-sm font-medium text-muted-foreground",
            isPdvPage && "pdv-page-heading__description",
          )}>
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className={cn(
          "flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center lg:mb-0.5",
          isPdvPage && "pdv-page-heading__actions",
        )}>
          {actions}
        </div>
      )}
    </section>
  );
}
