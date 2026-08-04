import { AlertTriangle, Package, FileWarning, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AlertaPortal } from "@/hooks/usePortalData";

interface AlertasPortalProps {
  alertas: AlertaPortal[];
}

const alertaConfig = {
  os_pronta: {
    icon: Package,
    variant: "default" as const,
    className: "border-green-500 bg-green-50 text-green-900",
  },
  os_atrasada: {
    icon: Clock,
    variant: "destructive" as const,
    className: "border-red-500 bg-red-50 text-red-900",
  },
  boleto_vencendo: {
    icon: AlertTriangle,
    variant: "default" as const,
    className: "border-yellow-500 bg-yellow-50 text-yellow-900",
  },
  fatura_pendente: {
    icon: FileWarning,
    variant: "default" as const,
    className: "border-orange-500 bg-orange-50 text-orange-900",
  },
};

export function AlertasPortal({ alertas }: AlertasPortalProps) {
  if (alertas.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        Alertas e Notificações
      </h3>
      <div className="space-y-2">
        {alertas.slice(0, 5).map((alerta, index) => {
          const config = alertaConfig[alerta.tipo];
          const Icon = config.icon;
          return (
            <Alert key={index} className={config.className}>
              <Icon className="h-4 w-4" />
              <AlertTitle className="text-sm font-medium">{alerta.titulo}</AlertTitle>
              <AlertDescription className="text-xs">
                {alerta.descricao}
              </AlertDescription>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}
