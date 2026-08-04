import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Package, 
  Truck, 
  Droplets, 
  Wind, 
  Shirt, 
  PackageCheck,
  CheckCircle,
  Clock,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DetalhesOSModal } from "./DetalhesOSModal";
import type { OrdemServicoPortal } from "@/hooks/usePortalData";

interface AcompanhamentoProducaoProps {
  ordens: OrdemServicoPortal[];
  isLoading: boolean;
}

const etapasConfig: Record<string, { icon: typeof Package; label: string; color: string }> = {
  retirada: { icon: Truck, label: "Retirada", color: "text-gray-500" },
  separacao: { icon: Package, label: "Separação", color: "text-blue-500" },
  lavagem: { icon: Droplets, label: "Lavagem", color: "text-cyan-500" },
  secagem: { icon: Wind, label: "Secagem", color: "text-orange-500" },
  passadoria: { icon: Shirt, label: "Passadoria", color: "text-purple-500" },
  embalagem: { icon: PackageCheck, label: "Embalagem", color: "text-pink-500" },
  expedicao: { icon: Truck, label: "Pronto Entrega", color: "text-green-500" },
  entregue: { icon: CheckCircle, label: "Entregue", color: "text-green-600" },
};

const etapasOrdem = ["retirada", "separacao", "lavagem", "secagem", "passadoria", "embalagem", "expedicao", "entregue"];

function getStatusBadge(status: string) {
  const config = etapasConfig[status];
  if (!config) return { label: status, variant: "secondary" as const };
  
  if (status === "entregue") return { label: config.label, variant: "default" as const, className: "bg-green-600" };
  if (status === "expedicao") return { label: config.label, variant: "default" as const, className: "bg-green-500" };
  return { label: config.label, variant: "secondary" as const };
}

function MiniTimeline({ status }: { status: string }) {
  const currentIndex = etapasOrdem.indexOf(status);
  
  return (
    <div className="flex items-center gap-1 mt-2">
      {etapasOrdem.slice(0, -1).map((etapa, index) => {
        const config = etapasConfig[etapa];
        const Icon = config?.icon || Package;
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={etapa} className="flex items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                isCompleted
                  ? "bg-green-500 text-white"
                  : isCurrent
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
            </div>
            {index < etapasOrdem.length - 2 && (
              <div
                className={`w-4 h-0.5 ${
                  isCompleted ? "bg-green-500" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AcompanhamentoProducao({ ordens, isLoading }: AcompanhamentoProducaoProps) {
  const [selectedOS, setSelectedOS] = useState<OrdemServicoPortal | null>(null);

  // Filtrar apenas OS ativas (não entregues)
  const ordensAtivas = ordens.filter(os => os.status !== "entregue");
  const ordensRecentes = ordens.filter(os => os.status === "entregue").slice(0, 3);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Acompanhe suas Ordens de Serviço
      </h3>

      {ordensAtivas.length === 0 && ordensRecentes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma ordem de serviço encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* OS Ativas */}
          {ordensAtivas.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                Em processamento ({ordensAtivas.length})
              </p>
              {ordensAtivas.map((os) => {
                const statusBadge = getStatusBadge(os.status);
                const totalPecas = os.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0;
                
                return (
                  <Card 
                    key={os.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedOS(os)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold">OS #{os.numero}</span>
                            <Badge variant={statusBadge.variant} className={statusBadge.className}>
                              {statusBadge.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{totalPecas} peças</span>
                            {os.data_previsao_entrega && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Previsão: {format(new Date(os.data_previsao_entrega), "dd/MM", { locale: ptBR })}
                              </span>
                            )}
                          </div>
                          <MiniTimeline status={os.status} />
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* OS Recentes (entregues) */}
          {ordensRecentes.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-sm text-muted-foreground font-medium">
                Entregas recentes
              </p>
              {ordensRecentes.map((os) => {
                const totalPecas = os.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0;
                
                return (
                  <Card 
                    key={os.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors opacity-75"
                    onClick={() => setSelectedOS(os)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium">OS #{os.numero}</span>
                          <span className="text-sm text-muted-foreground">
                            {totalPecas} peças
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {os.data_entrega && format(new Date(os.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <DetalhesOSModal
        open={!!selectedOS}
        onOpenChange={(open) => !open && setSelectedOS(null)}
        ordem={selectedOS}
      />
    </div>
  );
}
