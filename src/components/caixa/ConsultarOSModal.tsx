import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Undo2,
} from "lucide-react";
import { useConsultaOS, getStatusConfig, OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { useEditPdvPayment, usePdvPaymentsForOrder, useReversePdvPayment, type PdvPaymentSummary } from "@/hooks/usePdvPayments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";

interface ConsultarOSModalProps {
  recent?: boolean;
  positionMode?: boolean;
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

const paymentMethodLabels: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  FIDELIDADE: "Fidelidade",
  OUTRO: "Outro",
};

const paymentStatusLabels: Record<string, string> = {
  CONFIRMADO: "Confirmado",
  EM_REVISAO: "Em revisão",
  ESTORNADO: "Estornado",
  CANCELADO: "Cancelado",
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  FALHOU: "Falhou",
};

function PaymentHistory({ orderId }: { orderId: string }) {
  const [paymentToReverse, setPaymentToReverse] = useState<PdvPaymentSummary | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<PdvPaymentSummary | null>(null);
  const [reason, setReason] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("DINHEIRO");
  const { data: payments = [], isLoading, isError, refetch } = usePdvPaymentsForOrder(orderId, true);
  const reversePayment = useReversePdvPayment();
  const editPayment = useEditPdvPayment();

  const formatPaymentCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);

  const openReverseDialog = (payment: PdvPaymentSummary) => {
    setPaymentToReverse(payment);
    setReason("");
  };

  const openEditDialog = (payment: PdvPaymentSummary) => {
    setPaymentToEdit(payment);
    setEditAmount(Number(payment.valor).toFixed(2).replace(".", ","));
    setEditMethod(payment.metodo);
    setEditReason("");
  };

  const handleReverse = async () => {
    if (!paymentToReverse || reason.trim().length < 5) return;
    try {
      await reversePayment.mutateAsync({ paymentId: paymentToReverse.id, reason: reason.trim() });
      toast.success("Pagamento estornado e saldo da OS recalculado.");
      setPaymentToReverse(null);
      setReason("");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível estornar o pagamento.");
    }
  };

  const handleEdit = async () => {
    if (!paymentToEdit || editReason.trim().length < 5) return;
    const normalizedAmount = Number(editAmount.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) return;
    try {
      await editPayment.mutateAsync({
        paymentId: paymentToEdit.id,
        newValue: normalizedAmount,
        newMethod: editMethod,
        reason: editReason.trim(),
      });
      toast.success("Pagamento corrigido e histórico preservado.");
      setPaymentToEdit(null);
      setEditReason("");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível corrigir o pagamento.");
    }
  };

  return (
    <>
      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Histórico de pagamentos
          </h4>
          {isError && (
            <Button variant="ghost" size="sm" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Consultando pagamentos...
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Não foi possível carregar o histórico de pagamentos.</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado nesta OS.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{paymentMethodLabels[payment.metodo] || payment.metodo}</span>
                    <Badge variant={payment.status === "ESTORNADO" ? "destructive" : payment.status === "CONFIRMADO" || payment.status === "EM_REVISAO" ? "default" : "secondary"}>
                      {paymentStatusLabels[payment.status] || payment.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {payment.momento === "ENTRADA" ? "Na entrada" : "Na retirada"} · {payment.provedor} · {format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {payment.reversalUnavailableReason && payment.status !== "ESTORNADO" && (
                    <p className="text-xs text-muted-foreground mt-1">{payment.reversalUnavailableReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatPaymentCurrency(payment.valor)}</span>
                  {payment.canEdit && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openEditDialog(payment)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Button>
                  )}
                  {payment.canReverse && (
                    <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => openReverseDialog(payment)}>
                      <Undo2 className="w-3.5 h-3.5" />
                      Estornar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!paymentToReverse} onOpenChange={(open) => !open && setPaymentToReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O pagamento original será mantido no histórico, uma movimentação inversa será registrada e o saldo da OS será recalculado. Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="payment-reversal-reason" className="text-sm font-medium">Motivo do estorno *</label>
            <Textarea
              id="payment-reversal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: baixa registrada na OS incorreta"
              maxLength={1000}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Informe pelo menos 5 caracteres.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reversePayment.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleReverse(); }} disabled={reason.trim().length < 5 || reversePayment.isPending}>
              {reversePayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar estorno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!paymentToEdit} onOpenChange={(open) => !open && setPaymentToEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar pagamento</DialogTitle>
            <DialogDescription>
              A baixa original será mantida como estornada e uma nova baixa de correção será registrada. Isso preserva o histórico e recalcula o saldo da OS.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="payment-edit-amount" className="text-sm font-medium">Novo valor *</label>
                <Input
                  id="payment-edit-amount"
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(event) => setEditAmount(event.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="payment-edit-method" className="text-sm font-medium">Forma *</label>
                <Select value={editMethod} onValueChange={setEditMethod}>
                  <SelectTrigger id="payment-edit-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="CARTAO_CREDITO">Cartão de crédito</SelectItem>
                    <SelectItem value="CARTAO_DEBITO">Cartão de débito</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="payment-edit-reason" className="text-sm font-medium">Motivo da correção *</label>
              <Textarea
                id="payment-edit-reason"
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
                placeholder="Ex.: forma de pagamento informada incorretamente"
                maxLength={1000}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">Informe pelo menos 5 caracteres.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentToEdit(null)} disabled={editPayment.isPending}>Cancelar</Button>
            <Button
              onClick={(event) => { event.preventDefault(); void handleEdit(); }}
              disabled={editReason.trim().length < 5 || !Number.isFinite(Number(editAmount.replace(/\./g, "").replace(",", "."))) || Number(editAmount.replace(/\./g, "").replace(",", ".")) <= 0 || editPayment.isPending}
            >
              {editPayment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar correção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ConsultarOSModal({
  open,
  onOpenChange,
  onReceberPagamento,
  onImprimirROL,
  onImprimirEtiquetas,
  recent = false,
  positionMode = false,
}: ConsultarOSModalProps) {
  const { activeArea } = useWorkspace();
  const { allowed: canOperateCaixa } = usePermissaoModulo("caixa");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [expandedOS, setExpandedOS] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<EditingPosition | null>(null);
  const [isSavingPosition, setIsSavingPosition] = useState(false);

  const { data: ordens, isLoading, isError, refetch } = useConsultaOS(searchTerm, statusFilter, { enabled: open, recent });
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
            {positionMode && !recent ? <MapPin className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            {recent ? "Histórico de atendimentos" : positionMode ? "Posição de peças / ROL" : "Consultar ROL / Ordem de Serviço"} · {activeArea === "industrial" ? "Industrial" : "Residencial"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription>
          {recent
            ? "Até 100 atendimentos mais recentes deste setor. Use a busca para localizar um ROL."
            : positionMode
              ? "Busque o ROL ou cliente, abra a ordem e use o ícone de edição no item para registrar a posição de armazenamento."
              : "Busque pelo número do ROL ou pelo nome do cliente deste setor."}
        </DialogDescription>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={positionMode ? "Buscar ROL ou cliente para atualizar posição..." : "Buscar por número da OS ou nome do cliente..."}
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
          ) : isError ? (
            <div role="alert" className="py-8 text-center"><p>Não foi possível carregar as ordens deste setor.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>
          ) : !recent && searchTerm.length < 2 ? (
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
                                Pagamento Pendente · {formatCurrency(pendente)}
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              Retirada {format(new Date(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                            </Badge>
                            {!isPendente && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                                Pagamento em dia
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
                            {positionMode ? "Itens e posição de armazenamento" : "Itens da OS"} ({ordem.itens.length})
                          </h4>
                          <div className="space-y-2">
                            {ordem.itens.map((item) => {
                              const isEditing = editingPosition?.itemId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className={cn("flex items-center justify-between rounded-lg border bg-background p-3", positionMode && "border-primary/30")}
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
                                        aria-label={`Editar posição de ${item.produto?.nome || "item"}`}
                                        title="Editar posição de armazenamento"
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

                        {canOperateCaixa && <PaymentHistory orderId={ordem.id} />}

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
                                {canOperateCaixa && ordem.condicao_pagamento !== "faturado" && onReceberPagamento && (
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
