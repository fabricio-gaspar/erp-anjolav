import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  FileText,
  MapPin,
  Package,
  Phone,
  Printer,
  Tag,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Zap,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useConsultaOS, getStatusConfig, OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ConsultarOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceberPagamento?: (ordem: OrdemServicoConsulta) => void;
  onImprimirROL?: (ordemId: string) => void;
  onImprimirEtiquetas?: (ordemId: string) => void;
}

interface EditingPosition {
  itemId: string;
  corredor: string;
  secao: string;
  prateleira: string;
}

export function ConsultarOSModal({
  open,
  onOpenChange,
  onReceberPagamento,
  onImprimirROL,
  onImprimirEtiquetas,
}: ConsultarOSModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [expandedOS, setExpandedOS] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<EditingPosition | null>(null);
  const [isSavingPosition, setIsSavingPosition] = useState(false);

  const { data: ordens, isLoading } = useConsultaOS(searchTerm, statusFilter);
  const queryClient = useQueryClient();

  const toggleExpand = (ordemId: string) => {
    setExpandedOS(expandedOS === ordemId ? null : ordemId);
    setEditingPosition(null);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const totalPecas = (ordem: OrdemServicoConsulta) => {
    return ordem.itens.reduce((acc, item) => acc + item.quantidade, 0);
  };

  const valorPendente = (ordem: OrdemServicoConsulta) => {
    const total = ordem.valor_total || 0;
    const pago = ordem.valor_pago || 0;
    return total - pago;
  };

  const startEditingPosition = (itemId: string, currentPosition: string | null) => {
    if (currentPosition) {
      const parts = currentPosition.split("-");
      setEditingPosition({
        itemId,
        corredor: parts[0] || "",
        secao: parts[1] || "",
        prateleira: parts[2] || "",
      });
    } else {
      setEditingPosition({
        itemId,
        corredor: "",
        secao: "",
        prateleira: "",
      });
    }
  };

  const cancelEditingPosition = () => {
    setEditingPosition(null);
  };

  const savePosition = async () => {
    if (!editingPosition) return;

    const newPosition = editingPosition.corredor && editingPosition.secao && editingPosition.prateleira
      ? `${editingPosition.corredor}-${editingPosition.secao}-${editingPosition.prateleira}`
      : null;

    setIsSavingPosition(true);
    try {
      const { error } = await supabase
        .from("itens_ordem_servico")
        .update({ posicao_prateleira: newPosition })
        .eq("id", editingPosition.itemId);

      if (error) throw error;

      toast.success("Posição atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["consulta-os"] });
      setEditingPosition(null);
    } catch (error) {
      console.error("Erro ao atualizar posição:", error);
      toast.error("Erro ao atualizar posição. Tente novamente.");
    } finally {
      setIsSavingPosition(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Consultar ROL / Ordem de Serviço
          </DialogTitle>
        </DialogHeader>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número da OS ou nome do cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pronto_entrega">Pronto Entrega</SelectItem>
              <SelectItem value="lavagem">Em Lavagem</SelectItem>
              <SelectItem value="passadoria">Em Passadoria</SelectItem>
              <SelectItem value="conferencia">Em Conferência</SelectItem>
              <SelectItem value="entregue">Entregues</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : searchTerm.length < 2 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Digite pelo menos 2 caracteres para buscar</p>
            </div>
          ) : !ordens || ordens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma ordem de serviço encontrada</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {ordens.map((ordem) => {
                const statusConfig = getStatusConfig(ordem.status);
                const isExpanded = expandedOS === ordem.id;
                const pendente = valorPendente(ordem);
                const isPendente = ordem.status_pagamento === "pendente" && pendente > 0;

                return (
                  <div
                    key={ordem.id}
                    className={cn(
                      "border rounded-lg overflow-hidden transition-all",
                      isExpanded && "ring-2 ring-primary/20"
                    )}
                  >
                    {/* Order Header - Clickable */}
                    <button
                      onClick={() => toggleExpand(ordem.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">
                              OS {ordem.numero}
                            </span>
                            {ordem.urgente && (
                              <Badge variant="destructive" className="gap-1">
                                <Zap className="w-3 h-3" />
                                Urgente
                              </Badge>
                            )}
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                            {isPendente && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                                Pagamento Pendente
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {ordem.cliente?.nome_fantasia || ordem.cliente?.razao_social}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {totalPecas(ordem)} peças
                          </p>
                          <p className="font-medium">
                            {formatCurrency(ordem.valor_total)}
                          </p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30">
                        {/* Order Info */}
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Retirada</p>
                            <p className="font-medium">
                              {format(new Date(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Previsão Entrega</p>
                            <p className="font-medium">
                              {ordem.data_previsao_entrega
                                ? format(new Date(ordem.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                                : "-"}
                            </p>
                          </div>
                          {ordem.cliente?.telefone && (
                            <div>
                              <p className="text-muted-foreground">Telefone</p>
                              <p className="font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {ordem.cliente.telefone}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Pagamento</p>
                            <p className="font-medium capitalize">
                              {ordem.forma_pagamento || "-"}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        {/* Items List */}
                        <div className="p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Itens da OS ({ordem.itens.length})
                          </h4>
                          <div className="space-y-2">
                            {ordem.itens.map((item) => {
                              const isEditing = editingPosition?.itemId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {item.produto?.nome || "Produto"}
                                      </span>
                                      <span className="text-sm text-muted-foreground">
                                        x{item.quantidade}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {item.cor_item && (
                                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                          {item.cor_item}
                                        </span>
                                      )}
                                      {item.marca_item && (
                                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                          {item.marca_item}
                                        </span>
                                      )}
                                      {item.avarias && (
                                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" />
                                          {item.avarias}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Shelf Position - Editable */}
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        value={editingPosition.corredor}
                                        onChange={(e) =>
                                          setEditingPosition({
                                            ...editingPosition,
                                            corredor: e.target.value.toUpperCase(),
                                          })
                                        }
                                        className="w-12 h-8 text-center text-sm p-1"
                                        placeholder="Cor"
                                        maxLength={3}
                                      />
                                      <span className="text-muted-foreground">-</span>
                                      <Input
                                        value={editingPosition.secao}
                                        onChange={(e) =>
                                          setEditingPosition({
                                            ...editingPosition,
                                            secao: e.target.value,
                                          })
                                        }
                                        className="w-12 h-8 text-center text-sm p-1"
                                        placeholder="Sec"
                                        maxLength={3}
                                      />
                                      <span className="text-muted-foreground">-</span>
                                      <Input
                                        value={editingPosition.prateleira}
                                        onChange={(e) =>
                                          setEditingPosition({
                                            ...editingPosition,
                                            prateleira: e.target.value,
                                          })
                                        }
                                        className="w-12 h-8 text-center text-sm p-1"
                                        placeholder="Prat"
                                        maxLength={3}
                                      />
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={savePosition}
                                        disabled={isSavingPosition}
                                      >
                                        <Check className="w-4 h-4 text-green-600" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={cancelEditingPosition}
                                      >
                                        <X className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      {item.posicao_prateleira ? (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-lg border border-primary/20">
                                          <MapPin className="w-4 h-4 text-primary" />
                                          <span className="font-mono font-bold text-primary">
                                            {item.posicao_prateleira}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          Sem posição
                                        </span>
                                      )}
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditingPosition(item.id, item.posicao_prateleira);
                                        }}
                                      >
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Payment Info (if pending) */}
                        {isPendente && (
                          <>
                            <Separator />
                            <div className="p-4 bg-amber-50 border-t border-amber-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-amber-700">Valor Pendente</p>
                                  <p className="text-xl font-bold text-amber-800">
                                    {formatCurrency(pendente)}
                                  </p>
                                </div>
                                {onReceberPagamento && (
                                  <Button
                                    onClick={() => onReceberPagamento(ordem)}
                                    className="bg-amber-600 hover:bg-amber-700"
                                  >
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Receber Pagamento
                                  </Button>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Actions */}
                        <Separator />
                        <div className="p-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onImprimirROL?.(ordem.id)}
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir ROL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onImprimirEtiquetas?.(ordem.id)}
                          >
                            <Tag className="w-4 h-4 mr-2" />
                            Etiquetas
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
