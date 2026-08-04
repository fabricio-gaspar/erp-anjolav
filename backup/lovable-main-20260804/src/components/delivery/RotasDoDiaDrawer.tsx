import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Truck, 
  MapPin, 
  Clock, 
  Plus, 
  User, 
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Package,
  ArrowUpDown,
} from "lucide-react";
import { useRotasDoDia, RotaEntrega } from "@/hooks/useRotasEntrega";
import { cn } from "@/lib/utils";

interface RotasDoDiaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNovaRota: () => void;
  onGerenciarRota: (rota: RotaEntrega) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { 
    label: "Pendente", 
    color: "bg-muted text-muted-foreground",
    icon: <Circle className="w-3 h-3" />,
  },
  em_rota: { 
    label: "Em Rota", 
    color: "bg-primary text-primary-foreground",
    icon: <Truck className="w-3 h-3" />,
  },
  concluida: { 
    label: "Concluída", 
    color: "bg-success text-success-foreground",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelada: { 
    label: "Cancelada", 
    color: "bg-destructive text-destructive-foreground",
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

export function RotasDoDiaDrawer({
  open,
  onOpenChange,
  onNovaRota,
  onGerenciarRota,
}: RotasDoDiaDrawerProps) {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const { data: rotas, isLoading } = useRotasDoDia(hoje);

  const getParadasStats = (rota: RotaEntrega) => {
    const paradas = rota.paradas || [];
    const realizadas = paradas.filter(p => p.status === "realizada").length;
    const total = paradas.length;
    return { realizadas, total };
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Rotas do Dia
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Botão Nova Rota */}
          <Button onClick={onNovaRota} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Nova Rota
          </Button>

          <Separator />

          {/* Lista de Rotas */}
          <ScrollArea className="h-[calc(100vh-220px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !rotas || rotas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Truck className="w-12 h-12 mb-3 opacity-50" />
                <p className="font-medium">Nenhuma rota hoje</p>
                <p className="text-sm">Crie uma nova rota para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rotas.map((rota) => {
                  const stats = getParadasStats(rota);
                  const config = STATUS_CONFIG[rota.status] || STATUS_CONFIG.pendente;
                  
                  return (
                    <button
                      key={rota.id}
                      onClick={() => onGerenciarRota(rota)}
                      className="w-full p-4 rounded-lg border bg-card hover:border-primary/50 hover:shadow-sm transition-all text-left"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={cn("gap-1", config.color)}>
                          {config.icon}
                          {config.label}
                        </Badge>
                        
                        {stats.total > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {stats.realizadas}/{stats.total} paradas
                          </span>
                        )}
                      </div>

                      {/* Motorista e Veículo */}
                      <div className="space-y-2">
                        {rota.motorista ? (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{rota.motorista.nome}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-warning">
                            <User className="w-4 h-4" />
                            <span>Motorista não atribuído</span>
                          </div>
                        )}

                        {rota.veiculo && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Truck className="w-4 h-4" />
                            <span>{rota.veiculo.modelo} - {rota.veiculo.placa}</span>
                          </div>
                        )}
                      </div>

                      {/* Paradas Preview */}
                      {rota.paradas && rota.paradas.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <MapPin className="w-3 h-3" />
                            <span>Paradas:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {rota.paradas.slice(0, 5).map((parada, index) => (
                              <Badge 
                                key={parada.id} 
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  parada.status === "realizada" && "bg-success/10 text-success border-success/30",
                                  parada.status === "nao_entregue" && "bg-destructive/10 text-destructive border-destructive/30"
                                )}
                              >
                                {index + 1}. {parada.tipo === "retirada" ? "R" : "E"}
                              </Badge>
                            ))}
                            {rota.paradas.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{rota.paradas.length - 5}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Horários */}
                      {(rota.hora_saida || rota.hora_retorno) && (
                        <div className="mt-3 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
                          {rota.hora_saida && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Saída: {format(new Date(rota.hora_saida), "HH:mm")}</span>
                            </div>
                          )}
                          {rota.hora_retorno && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Retorno: {format(new Date(rota.hora_retorno), "HH:mm")}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
