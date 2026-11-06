import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface CashReportErrorProps {
  onRetry: () => void;
}

export function CashReportError({ onRetry }: CashReportErrorProps) {
  return (
    <Card className="border-red-200 bg-red-50/60 p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
      <p className="mt-3 font-semibold text-red-900">Não foi possível carregar este relatório</p>
      <p className="mt-1 text-sm text-red-700">Os dados não foram substituídos por um resultado vazio.</p>
      <Button variant="outline" className="mt-4 min-h-11 gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" /> Tentar novamente
      </Button>
    </Card>
  );
}
