import { useState } from "react";
import { ArrowLeft, Loader2, Package, Clock, Calendar, Truck, FileText, Printer, Tag, Send } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
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
import { dispararNotificacao } from "@/services/notificacaoService";
import { toast } from "@/hooks/use-toast";
import { OrderStateOverview } from "@/components/ordens/OrderStateOverview";
import { QualityDeliveryPanel } from "@/components/ordens/QualityDeliveryPanel";
import { OrderRecordsPanel } from "@/components/ordens/OrderRecordsPanel";
import { createIdempotencyKey } from "@/lib/idempotency";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { useMensagensLog } from "@/hooks/useMensagensLog";

interface DetalhesOSProps {
  ordemServicoId: string;
  onBack: () => void;
}

interface RelatedQuery {
  select(columns: string): RelatedQuery;
  eq(column: string, value: string): RelatedQuery;
  maybeSingle(): Promise<{ data: Record<string, string> | null; error: Error | null }>;
}

// These two relations have more than one FK path in the generated database type.
const relatedDb = supabase as unknown as { from(table: string): RelatedQuery };

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

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

export function DetalhesOS({ ordemServicoId, onBack }: DetalhesOSProps) {
  const [showFormulario, setShowFormulario] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const { data: ordem, isLoading, error } = useQuery({
    queryKey: ["ordem_servico", session?.user.id, activeTenant?.id, ordemServicoId, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id && ordemServicoId),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para abrir o pedido");
      }
      let query = supabase
        .from("ordens_servico")
        .select("*")
        .eq("id", ordemServicoId)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // A ordem possui FKs simples e compostas para estas três tabelas. Buscar
      // cada relação separadamente evita a ambiguidade do embed do PostgREST.
      const clientResult = await supabase.from("clientes")
          .select("razao_social, telefone, email")
          .eq("id", data.cliente_id)
          .eq("tenant_id", activeTenant.id)
          .maybeSingle();
      const driverResult = data.motorista_id
          ? await relatedDb.from("motoristas")
            .select("nome")
            .eq("id", data.motorista_id)
            .eq("tenant_id", activeTenant.id)
            .maybeSingle()
          : { data: null, error: null };
      const vehicleResult = data.veiculo_id
          ? await relatedDb.from("veiculos")
            .select("placa, modelo")
            .eq("id", data.veiculo_id)
            .eq("tenant_id", activeTenant.id)
            .maybeSingle()
          : { data: null, error: null };
      if (clientResult.error) throw clientResult.error;
      if (driverResult.error) throw driverResult.error;
      if (vehicleResult.error) throw vehicleResult.error;
      return {
        ...data,
        cliente: clientResult.data,
        motorista: driverResult.data,
        veiculo: vehicleResult.data,
      };
    },
  });

  const { historico, isLoading: isLoadingHistorico } = useHistoricoProducao(ordemServicoId);
  const { itens, isLoading: isLoadingItens } = useItensOrdemServico(ordemServicoId);
  const { printROL, printEtiqueta, isLoading: isPrinting } = usePrintOS(ordemServicoId);
  const { data: mensagens, isLoading: isLoadingMensagens, isError: mensagensError } = useMensagensLog({ ordem_servico_id: ordemServicoId });

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
        <p className="text-muted-foreground">
          {error ? "Não foi possível carregar o ROL. Tente novamente." : "ROL não encontrado."}
        </p>
        <Button variant="link" onClick={onBack}>
          Voltar
        </Button>
      </div>
    );
  }

  const statusInfo = statusConfig[ordem.status] || { label: ordem.status, variant: "default" as const };
  const hasFulfillmentContract = typeof ordem.status_qualidade === "string";
  const qualityBlocksAdvance = hasFulfillmentContract
    && ordem.status === "passadoria"
    && ordem.status_qualidade !== "aprovada";
  const deliveryUsesItemFlow = hasFulfillmentContract && ordem.status === "expedicao";
  const canAdvance = ordem.status !== "entregue"
    && ordem.status !== "cancelada"
    && !qualityBlocksAdvance
    && !deliveryUsesItemFlow;

  const valorTotal = Number(ordem.valor_total ?? itens.reduce((acc, item) => acc + Number(item.subtotal), 0));
  const quantidadeTotal = itens.reduce((acc, item) => acc + Number(item.quantidade), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para a lista de pedidos" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-mono text-xl font-bold text-primary">ROL {ordem.numero}</h2>
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

        <div className="flex flex-wrap items-center gap-2 pl-12 lg:justify-end lg:pl-0">
          {/* WhatsApp Resend */}
          {ordem.cliente?.telefone && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSendingWhatsApp}
              onClick={async () => {
                if (mensagens?.some((item) => ["incerto", "processando"].includes(item.status))) {
                  toast({ title: "Concilie o envio pendente antes de reenviar", variant: "destructive" });
                  return;
                }
                setIsSendingWhatsApp(true);
                try {
                  const evento = ordem.status === "expedicao" ? "os_pronta" : "os_status";
                  const enviado = await dispararNotificacao(evento, {
                    cliente: ordem.cliente?.razao_social || "",
                    telefone: ordem.cliente?.telefone || "",
                    numero: ordem.numero,
                    ordem_servico_id: ordemServicoId,
                    cliente_id: ordem.cliente_id,
                    idempotencyKey: createIdempotencyKey("whatsapp-manual"),
                  });
                  toast({
                    title: enviado
                      ? "WhatsApp confirmado pelo WA-AKG"
                      : "Envio de WhatsApp não confirmado",
                    variant: enviado ? "default" : "destructive",
                  });
                } finally {
                  setIsSendingWhatsApp(false);
                }
              }}
            >
              {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">WhatsApp</span>
            </Button>
          )}
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
            <Button onClick={() => setShowFormulario(true)}>
              Avançar para {statusConfig[statusInfo.next || ""]?.label || "Próxima Etapa"}
            </Button>
          )}
        </div>
      </div>

      <OrderStateOverview
        operationalStatus={ordem.status}
        paymentStatus={ordem.status_pagamento}
        qualityStatus={ordem.status_qualidade}
        logisticsStatus={ordem.status_logistica}
        fiscalStatus={ordem.status_fiscal}
        totalValue={ordem.valor_total}
        paidValue={ordem.valor_pago}
      />

      {qualityBlocksAdvance && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
          Registre a qualidade dos itens antes de avançar o pedido inteiro. Itens aprovados já podem ser entregues separadamente quando aplicável.
        </div>
      )}

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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Informações Principais */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Informações do pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  {format(parseISO(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Previsão Entrega
                </p>
                <p className="font-medium">
                  {ordem.data_previsao_entrega
                    ? format(parseISO(ordem.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
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

            {/* Itens do ROL */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Itens do pedido
                </p>
                <div className="text-sm text-muted-foreground">
                  {quantidadeTotal} itens • {formatCurrency(valorTotal)}
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
                          {item.quantidade} {item.produto?.unidade} × {formatCurrency(Number(item.preco_unitario))}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(Number(item.subtotal))}</p>
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
              Histórico operacional
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

      <OrderRecordsPanel orderId={ordemServicoId} orderStatus={ordem.status} />

      <Card>
        <CardHeader><CardTitle className="text-base">Notificações do ROL</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {isLoadingMensagens ? <p className="text-sm text-muted-foreground">Carregando histórico...</p>
            : mensagensError ? <p className="text-sm text-destructive">Não foi possível carregar as notificações.</p>
            : !mensagens?.length ? <p className="text-sm text-muted-foreground">Nenhuma notificação registrada para este ROL.</p>
            : mensagens.map((mensagem) => (
              <div key={mensagem.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{mensagem.evento.replace(/_/g, " ")}</span>
                  <Badge variant={["falhou", "incerto"].includes(mensagem.status) ? "destructive" : "outline"}>
                    {mensagem.status === "incerto" ? "Requer conciliação" : mensagem.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(mensagem.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} · {mensagem.canal}
                  {mensagem.provider_message_id ? " · ID externo registrado" : ""}
                </p>
                <p className="mt-2 whitespace-pre-wrap">{mensagem.mensagem}</p>
                {mensagem.last_error_code && <p className="mt-1 text-xs text-destructive">Motivo: {mensagem.last_error_code}</p>}
              </div>
            ))}
        </CardContent>
      </Card>

      {hasFulfillmentContract && (
        <QualityDeliveryPanel
          orderId={ordemServicoId}
          items={itens}
          paymentStatus={ordem.status_pagamento}
          paymentCondition={ordem.condicao_pagamento}
        />
      )}

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
