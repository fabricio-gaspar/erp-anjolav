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
  Calendar,
  Clock
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { OrdemServicoPortal } from "@/hooks/usePortalData";

interface DetalhesOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServicoPortal | null;
}

const etapasConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  retirada: { icon: Truck, label: "Retirada", color: "text-gray-600", bgColor: "bg-gray-100" },
  separacao: { icon: Package, label: "Separação", color: "text-blue-600", bgColor: "bg-blue-100" },
  lavagem: { icon: Droplets, label: "Lavagem", color: "text-cyan-600", bgColor: "bg-cyan-100" },
  secagem: { icon: Wind, label: "Secagem", color: "text-orange-600", bgColor: "bg-orange-100" },
  passadoria: { icon: Shirt, label: "Passadoria", color: "text-purple-600", bgColor: "bg-purple-100" },
  embalagem: { icon: PackageCheck, label: "Embalagem", color: "text-pink-600", bgColor: "bg-pink-100" },
  expedicao: { icon: Truck, label: "Pronto para Entrega", color: "text-green-600", bgColor: "bg-green-100" },
  entregue: { icon: CheckCircle, label: "Entregue", color: "text-green-700", bgColor: "bg-green-200" },
};

export function DetalhesOSModal({ open, onOpenChange, ordem }: DetalhesOSModalProps) {
  if (!ordem) return null;

  const historicoOrdenado = [...(ordem.historico || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalPecas = ordem.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0;
  const valorTotal = ordem.itens?.reduce((acc, item) => acc + Number(item.subtotal || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ordem de Serviço #{ordem.numero}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6">
            {/* Status Atual */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="text-sm text-muted-foreground">Status Atual</p>
                <p className="font-semibold text-lg">
                  {etapasConfig[ordem.status]?.label || ordem.status}
                </p>
              </div>
              <Badge variant={ordem.status === "entregue" ? "default" : "secondary"} className="text-sm">
                {ordem.status === "entregue" ? "Concluído" : "Em Processo"}
              </Badge>
            </div>

            {/* Informações */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Retirada</p>
                  <p className="text-sm font-medium">
                    {format(new Date(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              {ordem.data_previsao_entrega && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Previsão Entrega</p>
                    <p className="text-sm font-medium">
                      {format(new Date(ordem.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Total de Peças</p>
                <p className="text-sm font-medium">{totalPecas} itens</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="text-sm font-medium">
                  R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <Separator />

            {/* Itens */}
            {ordem.itens && ordem.itens.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Itens da OS</h4>
                <div className="space-y-2">
                  {ordem.itens.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/50">
                      <span>{item.produto?.nome || "Produto"}</span>
                      <span className="text-muted-foreground">{item.quantidade}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Timeline */}
            <div>
              <h4 className="font-medium mb-3">Histórico de Produção</h4>
              <div className="space-y-4">
                {historicoOrdenado.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum histórico disponível
                  </p>
                ) : (
                  historicoOrdenado.map((h, index) => {
                    const config = etapasConfig[h.etapa_nova] || {
                      icon: Package,
                      label: h.etapa_nova,
                      color: "text-gray-600",
                      bgColor: "bg-gray-100",
                    };
                    const Icon = config.icon;

                    return (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`p-2 rounded-full ${config.bgColor}`}>
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          {index < historicoOrdenado.length - 1 && (
                            <div className="w-0.5 h-full bg-border mt-2" />
                          )}
                        </div>
                        <div className="pb-4">
                          <p className="font-medium text-sm">{config.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(h.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {h.funcionario?.nome && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Por: {h.funcionario.nome}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
