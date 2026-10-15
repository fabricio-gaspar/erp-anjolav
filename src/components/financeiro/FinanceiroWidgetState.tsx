import type { ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FinanceiroWidgetStateProps {
  children: ReactNode;
  error: Error | null;
  errorReference: string | null;
  isLoading: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  title: string;
}

export function FinanceiroWidgetState({
  children,
  error,
  errorReference,
  isLoading,
  isRetrying,
  onRetry,
  title,
}: FinanceiroWidgetStateProps) {
  if (isLoading) {
    return (
      <Card className="flex min-h-32 items-center justify-center gap-3 p-6" aria-busy="true" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">Carregando {title.toLowerCase()}…</span>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40 p-5" role="alert" aria-busy={isRetrying}>
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="font-semibold text-destructive">Não foi possível carregar {title.toLowerCase()}.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seus dados não foram alterados. Confira a conexão e as permissões da empresa ativa antes de tentar novamente.
              </p>
              {errorReference && (
                <p className="mt-2 text-xs text-muted-foreground">Código da ocorrência: {errorReference}</p>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
              {isRetrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />}
              Tentar novamente
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
