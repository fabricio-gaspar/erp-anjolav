import { useState } from "react";
import { ArrowLeft, Loader2, Package, Clock, Calendar, Truck, User, FileText, Printer, Tag } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHistoricoProducao } from "@/hooks/useHistoricoProducao";
import { useItensOrdemServico } from "@/hooks/useOrdensServico";
import { HistoricoTimeline } from "@/components/producao/HistoricoTimeline";
import { FormularioEtapa } from "@/components/producao/FormularioEtapa";
import { ImprimirOSModal } from "@/components/ordens/ImprimirOSModal";
import { usePrintOS } from "@/hooks/usePrintOS";

interface DetalhesOSProps {
  ordemServicoId: string;
  onBack: () => void;
}

const statusConfig: Record<string, { label: string; variant: "info" | "success" | "warning" | "danger" | "default"; next?: string }> = {
  retirada: { label: "Retirado", variant: "info", next: "separacao" },
  separacao: { label: "Separação", variant: "warning", next: "lavagem" },
  lavagem: { label: "Lavagem", variant: "warning", next: "secagem" },
  secagem: { label: "Secagem", variant: "warning", next: "passadoria" },
  passadoria: { label: "Passadoria", variant: "warning", next: "embalagem" },
  embalagem: { label: "Embalagem", variant: "info", next: "expedicao" },
  expedicao: { label: "Pronto Entrega", variant: "success", next: "entregue" },
  entregue: { label: "Entregue", variant: "success" },
  cancelada: { label: "Cancelada", variant: "danger" },
};

export function DetalhesOS({ ordemServicoId, onBack }: DetalhesOSProps) {
  const [showFormulario, setShowFormulario] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const { data: ordem, isLoading } = useQuery({
    queryKey: ["ordem_servico", ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social, telefone, email),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .eq("id", ordemServicoId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { historico, isLoading: isLoadingHistorico } = useHistoricoProducao(ordemServicoId);
  const { itens, isLoading: isLoadingItens } = useItensOrdemServico(ordemServicoId);
  const { printROL, printEtiqueta, isLoading: isPrinting } = usePrintOS(ordemServicoId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando detalhes...</span>
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Ordem de serviço não encontrada.</p>
        <Button variant="link" onClick={onBack}>
          Voltar
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[ordem.status] || { label: ordem.status, variant: "default" as const };
  const canAdvance = ordem.status !== "entregue" && ordem.status !== "cancelada";

  const valorTotal = itens.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const quantidadeTotal = itens.reduce((acc, item) => acc + Number(item.quantidade), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono text-primary">{ordem.numero}</h2>
              <StatusBadge variant={statusInfo.variant}>{statusInfo.label}</StatusBadge>
              {ordem.prioridade && ordem.prioridade !== "normal" && (
                <Badge variant={ordem.prioridade === "urgente" ? "destructive" : "secondary"}>
                  {ordem.prioridade.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Criada {formatDistanceToNow(new Date(ordem.created_at), { locale: ptBR, addSuffix: true })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Print Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isPrinting}>
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Imprimir</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => printROL()}>
                <FileText className="h-4 w-4 mr-2" />
                Imprimir ROL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => printEtiqueta()}>
                <Tag className="h-4 w-4 mr-2" />
                Imprimir Etiqueta
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPrintModal(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Opções de Impressão...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canAdvance && (
            <Button onClick={() => setShowFormulario(true)} className="bg-primary hover:bg-primary/90">
              Avançar para {statusConfig[statusInfo.next || ""]?.label || "Próxima Etapa"}
            </Button>
          )}
        </div>
      </div>

      {/* Formulário de Avanço */}
      {showFormulario && statusInfo.next && (
        <FormularioEtapa
          ordemServicoId={ordemServicoId}
          etapaAtual={ordem.status}
          proximaEtapa={statusInfo.next}
          onClose={() => setShowFormulario(false)}
          onSuccess={() => {
            setShowFormulario(false);
            // Refetch will happen automatically
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informações da OS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Cliente</p>
                <p className="font-medium">{ordem.cliente?.razao_social}</p>
                {ordem.cliente?.telefone && (
                  <p className="text-sm text-muted-foreground">{ordem.cliente.telefone}</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Motorista / Veículo</p>
                <p className="font-medium">{ordem.motorista?.nome || "Não definido"}</p>
                {ordem.veiculo && (
                  <p className="text-sm text-muted-foreground">
                    {ordem.veiculo.placa} - {ordem.veiculo.modelo}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data Retirada
                </p>
                <p className="font-medium">
                  {format(new Date(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Previsão Entrega
                </p>
                <p className="font-medium">
                  {ordem.data_previsao_entrega
                    ? format(new Date(ordem.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                    : "Não definida"}
                </p>
              </div>
            </div>

            {ordem.observacoes && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Observações</p>
                  <p className="text-sm">{ordem.observacoes}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Itens da OS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Itens da OS
                </p>
                <div className="text-sm text-muted-foreground">
                  {quantidadeTotal} itens • R$ {valorTotal.toFixed(2)}
                </div>
              </div>

              {isLoadingItens ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : itens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item adicionado
                </p>
              ) : (
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{item.produto?.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantidade} {item.produto?.unidade} × R$ {Number(item.preco_unitario).toFixed(2)}
                        </p>
                      </div>
                      <p className="font-medium">R$ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline do Histórico */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Histórico de Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingHistorico ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <HistoricoTimeline historico={historico} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print Modal */}
      {ordem && (
        <ImprimirOSModal
          open={showPrintModal}
          onOpenChange={setShowPrintModal}
          ordemServicoId={ordemServicoId}
          osNumero={ordem.numero}
          clienteNome={ordem.cliente?.razao_social || "Cliente"}
        />
      )}
    </div>
  );
}
