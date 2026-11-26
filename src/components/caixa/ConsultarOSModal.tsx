import { useEffect, useMemo, useRef, useState } from "react";
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
  MessageCircle,
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
  ScanLine,
  CircleX,
} from "lucide-react";
import { useConsultaOS, getStatusConfig, OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { EditarRolPdvDialog } from "@/components/caixa/EditarRolPdvDialog";
import { useEditPdvPayment, usePdvPaymentsForOrder, useReversePdvPayment, type PdvPaymentSummary } from "@/hooks/usePdvPayments";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { usePdvStoragePositions } from "@/hooks/usePdvStoragePositions";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { orderMonthRange } from "@/lib/orderMonthFilter";
import {
  getOrderScanKey,
  isDuplicateOrderScan,
  normalizeOrderScanInput,
  parseCanonicalOrderScan,
  type RecentOrderScan,
} from "@/lib/orderScanner";

interface ConsultarOSModalProps {
  recent?: boolean;
  positionMode?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceberPagamento?: (ordem: OrdemServicoConsulta) => void;
  canReceivePayments?: boolean;
  receivePaymentBlockReason?: string | null;
  onDarBaixa?: (ordem: OrdemServicoConsulta) => void;
  onEnviarEntrada?: (ordem: OrdemServicoConsulta) => void;
  onImprimirROL?: (ordemId: string) => void;
  onImprimirEtiquetas?: (ordemId: string) => void;
  onImprimirDisponibilidade?: (ordemId: string) => void;
  onEnviarDisponibilidade?: (ordem: OrdemServicoConsulta) => void;
}

interface EditingPosition {
  itemId: string;
  value: string;
}

interface ScannerFeedback {
  tone: "pending" | "success" | "warning" | "error";
  message: string;
}

interface PosicaoRolResult {
  orderId: string;
  allItemsPositioned: boolean;
  readyForCustomer: boolean;
  deliveryMode: "balcao" | "entrega";
  deliveryQueueUpdated: boolean;
}

const paymentMethodLabels: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  FIDELIDADE: "Fidelidade",
  CREDITO_CLIENTE: "Crédito do cliente",
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

const getItemUnitLabel = (unit?: string | null) => {
  const normalized = (unit || "").trim().toLowerCase();
  if (["metro", "metros", "mt", "m", "m²", "m2"].includes(normalized)) return "m²";
  if (["kg", "quilo", "kilo"].includes(normalized)) return "kg";
  if (["un", "unidade"].includes(normalized)) return "unidade";
  if (["pç", "pc", "peca", "peça"].includes(normalized)) return "peça";
  return unit || "unidade";
};

const formatOrderQuantity = (quantity: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(quantity);

const getOrderQuantitySummary = (order: OrdemServicoConsulta) => {
  const totals = new Map<string, number>();
  order.itens.forEach((item) => {
    const unit = getItemUnitLabel(item.produto?.unidade);
    totals.set(unit, (totals.get(unit) ?? 0) + item.quantidade);
  });
  return [...totals.entries()].map(([unit, quantity]) => `${formatOrderQuantity(quantity)} ${unit}`).join(" · ") || "0 itens";
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
      toast.success("Pagamento estornado e saldo do ROL recalculado.");
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
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void refetch()}>
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
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado neste ROL.</p>
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
                  {Number(payment.valor_nao_alocado) > 0 && (
                    <p role="alert" className="mt-1 text-xs font-medium text-warning">
                      {formatPaymentCurrency(payment.valor_nao_alocado)} recebido e ainda não alocado. Exige conciliação.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="text-right">
                    <span className="block font-semibold">{formatPaymentCurrency(payment.valor)}</span>
                    {Number(payment.valor_alocado) !== Number(payment.valor) && (
                      <span className="text-xs text-muted-foreground">
                        Alocado: {formatPaymentCurrency(payment.valor_alocado)}
                      </span>
                    )}
                  </div>
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
              O pagamento original será mantido no histórico, uma movimentação inversa será registrada e o saldo do ROL será recalculado. Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="payment-reversal-reason" className="text-sm font-medium">Motivo do estorno *</label>
            <Textarea
              id="payment-reversal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: baixa registrada no ROL incorreto"
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
              A baixa original será mantida como estornada e uma nova baixa de correção será registrada. Isso preserva o histórico e recalcula o saldo do ROL.
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
  canReceivePayments = true,
  receivePaymentBlockReason = null,
  onDarBaixa,
  onEnviarEntrada,
  onImprimirROL,
  onImprimirEtiquetas,
  onImprimirDisponibilidade,
  onEnviarDisponibilidade,
  recent = false,
  positionMode = false,
}: ConsultarOSModalProps) {
  const { activeArea } = useWorkspace();
  const positionArea = activeArea === "industrial" ? "industrial" : "residencial";
  const { data: storagePositions = [] } = usePdvStoragePositions(positionArea, open);
  const { allowed: canOperateCaixa } = usePermissaoModulo("caixa");
  const { allowed: canManageOrders } = usePermissaoModulo("ordens");
  const canManageRol = canOperateCaixa || canManageOrders;
  const [manualSearchTerm, setManualSearchTerm] = useState("");
  const [queryTerm, setQueryTerm] = useState("");
  const [scannerValue, setScannerValue] = useState("");
  const [scanAttempt, setScanAttempt] = useState<{ value: string; submittedAt: number } | null>(null);
  const [scannerFeedback, setScannerFeedback] = useState<ScannerFeedback | null>(null);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [entryMonth, setEntryMonth] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [attendantId, setAttendantId] = useState("todos");
  const [expandedOS, setExpandedOS] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<EditingPosition | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrdemServicoConsulta | null>(null);
  const [cancelingOrder, setCancelingOrder] = useState<OrdemServicoConsulta | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const recentScanRef = useRef<RecentOrderScan | null>(null);

  const historyDateRangeInvalid = recent && Boolean(historyDateFrom && historyDateTo && historyDateFrom > historyDateTo);
  const historyHasCriteria = Boolean(queryTerm.trim().length >= 2 || historyDateFrom || historyDateTo || attendantId !== "todos" || statusFilter !== "todos");
  const monthRange = !recent && !positionMode ? orderMonthRange(entryMonth) : null;
  const { data: funcionarios = [] } = useFuncionarios({ enabled: open });
  const funcionariosById = useMemo(() => new Map(funcionarios.map((funcionario) => [funcionario.id, funcionario.nome])), [funcionarios]);
  const { data: ordens, isLoading, isFetching, isError, refetch } = useConsultaOS(queryTerm, statusFilter, {
    enabled: open && !historyDateRangeInvalid && (!recent || historyHasCriteria),
    recent,
    dateFrom: recent ? historyDateFrom || undefined : monthRange?.from,
    dateTo: recent ? historyDateTo || undefined : monthRange?.to,
    allowDateSearch: Boolean(monthRange),
    attendantId: recent && attendantId !== "todos" ? attendantId : undefined,
  });
  const queryClient = useQueryClient();
  const defaultConsultation = !recent && !positionMode;
  const selectedOrder = ordens?.find((ordem) => ordem.id === expandedOS);

  useEffect(() => {
    if (open) return;
    setManualSearchTerm("");
    setQueryTerm("");
    setStatusFilter("todos");
    setEntryMonth("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
    setAttendantId("todos");
    setExpandedOS(null);
    setEditingPosition(null);
    setScannerValue("");
    setScannerFeedback(null);
    setScanAttempt(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setExpandedOS(null);
    setEditingPosition(null);
  }, [open, queryTerm, statusFilter, historyDateFrom, historyDateTo, attendantId, entryMonth]);

  const handleManualSearch = (value: string) => {
    setManualSearchTerm(value);
    setQueryTerm(value);
    setScanAttempt(null);
    setScannerFeedback(null);
  };

  const submitScannerValue = () => {
    const value = normalizeOrderScanInput(scannerValue);
    if (!value) {
      setScannerFeedback({ tone: "error", message: "Aponte o leitor para uma etiqueta ou informe o número do ROL." });
      return;
    }

    const now = Date.now();
    if (isDuplicateOrderScan(recentScanRef.current, value, now)) {
      setScannerValue("");
      setScannerFeedback({ tone: "warning", message: "Leitura duplicada ignorada. O mesmo código já está em processamento ou foi localizado." });
      return;
    }

    const key = getOrderScanKey(value);
    if (!key) return;
    recentScanRef.current = { key, scannedAt: now };
    setScannerValue("");
    setScanAttempt({ value, submittedAt: now });
    setScannerFeedback({ tone: "pending", message: "Validando a etiqueta no setor atual…" });
    if (queryTerm === value) void refetch();
    else setQueryTerm(value);
  };

  useEffect(() => {
    if (!scanAttempt || isFetching) return;
    if (isError) {
      setScannerFeedback({ tone: "error", message: "Não foi possível validar a etiqueta. Tente novamente sem alterar o pedido." });
      return;
    }

    const ordem = ordens?.[0];
    if (!ordem) {
      setScannerFeedback({ tone: "error", message: "Etiqueta não encontrada nesta empresa e neste setor." });
      return;
    }

    setExpandedOS(ordem.id);
    const leitura = parseCanonicalOrderScan(scanAttempt.value);
    if (leitura?.kind === "item") {
      const item = ordem.itens.find(candidate => candidate.id === leitura.itemId);
      setScannerFeedback({
        tone: "success",
        message: `Item ${item?.produto?.nome || leitura.itemId.slice(0, 8)} localizado no ROL ${ordem.numero}.`,
      });
    } else {
      setScannerFeedback({ tone: "success", message: `ROL ${ordem.numero} localizado e aberto para conferência.` });
    }
  }, [isError, isFetching, ordens, scanAttempt]);

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

  const valorPendente = (ordem: OrdemServicoConsulta) => {
    const total = ordem.valor_total || 0;
    const pago = ordem.valor_pago || 0;
    return Math.max(0, Math.round((total - pago) * 100) / 100);
  };

  const startEditingPosition = (itemId: string, currentPosition: string | null) => {
    setEditingPosition({ itemId, value: currentPosition || "" });
  };

  const cancelEditingPosition = () => {
    setEditingPosition(null);
  };

  const cancelOrder = async () => {
    if (!cancelingOrder || cancelReason.trim().length < 5) return;
    setIsCancelling(true);
    try {
      const { error } = await supabase.rpc("cancelar_ordem_servico", {
        _ordem_servico_id: cancelingOrder.id,
        _motivo: cancelReason.trim(),
      });
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
        queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
        queryClient.invalidateQueries({ queryKey: ["order-directory"] }),
      ]);
      toast.success(`ROL ${cancelingOrder.numero} cancelado e preservado no histórico.`);
      setCancelingOrder(null);
      setCancelReason("");
      setExpandedOS(null);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cancelar o ROL.");
    } finally {
      setIsCancelling(false);
    }
  };

  const savePosition = async () => {
    if (!editingPosition) return;

    const newPosition = editingPosition.value.trim() || null;

    setIsSavingPosition(true);
    try {
      const { data, error } = await supabase.rpc("registrar_posicao_item_rol", {
        _item_id: editingPosition.itemId,
        _posicao_prateleira: newPosition,
      });

      if (error) throw error;

      const result = data as unknown as PosicaoRolResult;
      if (!result?.orderId) {
        throw new Error("O servidor não confirmou a atualização da posição do ROL.");
      }

      toast.success("Posição atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["consulta-os"] });
      queryClient.invalidateQueries({ queryKey: ["route-stop-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["delivery-rols-in-progress"] });
      setEditingPosition(null);

      if (result.readyForCustomer && result.deliveryQueueUpdated) {
        toast.success("ROL pronto incluído na fila de Entregas e Coletas.");
      }
    } catch (error) {
      console.error("Erro ao atualizar posição:", error);
      toast.error("Erro ao atualizar posição. Tente novamente.");
    } finally {
      setIsSavingPosition(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex h-[92vh] min-h-0 max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden",
        defaultConsultation && "pdv-compact-dialog pdv-rol-dialog",
      )}>
        <DialogHeader className={cn(defaultConsultation && "pdv-rol-header")}>
          <DialogTitle className={cn("flex items-center gap-2", defaultConsultation && "pdv-rol-title")}>
            {positionMode && !recent ? <MapPin className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            {recent ? "Histórico de atendimentos" : positionMode ? "Posição de peças / ROL" : "Consultar ROL"}
          </DialogTitle>
          {defaultConsultation && (
            <Badge className="pdv-rol-area-badge" variant="secondary">
              {activeArea === "industrial" ? "Industrial" : "Doméstico"}
            </Badge>
          )}
        </DialogHeader>
        <DialogDescription className={cn(defaultConsultation && "sr-only")}>
          {recent
            ? "Informe um ROL, cliente ou período para carregar o histórico sob demanda."
            : positionMode
              ? "Busque o ROL ou cliente, abra a ordem e use o ícone de edição no item para registrar a posição de armazenamento."
              : "Busque pelo número do ROL ou pelo nome do cliente deste setor."}
        </DialogDescription>

        {recent && (
          <div className="grid shrink-0 gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(190px,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <label htmlFor="pdv-history-date-from" className="text-xs font-semibold text-foreground">Retirada inicial</label>
              <Input
                id="pdv-history-date-from"
                type="date"
                value={historyDateFrom}
                onChange={(event) => setHistoryDateFrom(event.target.value)}
                aria-invalid={historyDateRangeInvalid}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pdv-history-date-to" className="text-xs font-semibold text-foreground">Retirada final</label>
              <Input
                id="pdv-history-date-to"
                type="date"
                value={historyDateTo}
                onChange={(event) => setHistoryDateTo(event.target.value)}
                aria-invalid={historyDateRangeInvalid}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pdv-history-attendant" className="text-xs font-semibold text-foreground">Atendente</label>
              <Select value={attendantId} onValueChange={setAttendantId}>
                <SelectTrigger id="pdv-history-attendant"><SelectValue placeholder="Todos os atendentes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os atendentes</SelectItem>
                  {funcionarios.map((funcionario) => <SelectItem key={funcionario.id} value={funcionario.id}>{funcionario.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!historyDateFrom && !historyDateTo && attendantId === "todos" && statusFilter === "todos"}
              onClick={() => {
                setHistoryDateFrom("");
                setHistoryDateTo("");
                setAttendantId("todos");
                setStatusFilter("todos");
              }}
            >
              Limpar filtros
            </Button>
            {historyDateRangeInvalid && <p className="text-xs font-medium text-destructive sm:col-span-4">A data inicial não pode ser posterior à data final.</p>}
          </div>
        )}

        <div className={cn("min-w-0 shrink-0 overflow-x-hidden rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:p-4", defaultConsultation && "pdv-rol-search-card")}>
          <div className={cn(defaultConsultation && "pdv-rol-search-layout")}>
            <div className={cn("flex shrink-0 flex-col gap-3 sm:flex-row", defaultConsultation && "pdv-rol-search-controls")}>
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar ROL ou cliente"
                  placeholder={positionMode ? "Buscar ROL ou cliente para atualizar posição..." : "Buscar ROL ou cliente"}
                  value={manualSearchTerm}
                  onChange={(e) => handleManualSearch(e.target.value)}
                  className={cn("pl-10", defaultConsultation && "pdv-rol-search-input")}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={cn("w-full sm:w-48", defaultConsultation && "pdv-rol-filter-trigger")}>
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
            {defaultConsultation && <Separator orientation="vertical" className="pdv-rol-search-divider" />}
            <div className={cn("min-w-0", defaultConsultation && "pdv-rol-scanner") }>
              {!defaultConsultation && (
                <div className="mb-2 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><ScanLine className="h-5 w-5" /></div>
                  <div>
                    <label htmlFor="order-scanner-input" className="text-sm font-semibold">Leitor de código de barras</label>
                    <p className="text-xs text-muted-foreground">Identifica o ROL ou a linha do item. A quantidade da linha não representa uma peça individual.</p>
                  </div>
                </div>
              )}
              {defaultConsultation && <div className="pdv-rol-scanner-icon"><ScanLine aria-hidden="true" /></div>}
              <div className={cn("flex min-w-0 flex-col gap-2 sm:flex-row", defaultConsultation && "pdv-rol-scanner-field")}>
                {!defaultConsultation && <label htmlFor="order-scanner-input" className="text-sm font-semibold">Ler código de barras</label>}
                <Input
                  id="order-scanner-input"
                  aria-label="Leitor de código de barras"
                  value={scannerValue}
                  onChange={event => setScannerValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitScannerValue();
                    }
                  }}
                  placeholder={defaultConsultation ? "Ler código de barras" : "Escaneie a etiqueta ou digite o número do ROL"}
                  className={cn("h-11 min-w-0 bg-background font-mono", defaultConsultation && "pdv-rol-scanner-input")}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <Button type="button" className={cn("h-11 w-full min-w-0 shrink-0 gap-2 sm:w-auto", defaultConsultation && "pdv-rol-locate-button")} onClick={submitScannerValue}>
                <ScanLine className="h-4 w-4" /> {defaultConsultation ? "Localizar" : "Localizar código"}
              </Button>
            </div>
          </div>
          {defaultConsultation && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="pdv-rol-entry-month" className="text-xs font-medium text-muted-foreground">Mês de entrada</label>
              <Input id="pdv-rol-entry-month" type="month" value={entryMonth} onChange={(event) => setEntryMonth(event.target.value)} className="h-[34px] w-auto min-w-[160px] text-sm" />
              {entryMonth && <Button type="button" variant="ghost" size="sm" className="h-[34px]" onClick={() => setEntryMonth("")}>Limpar mês</Button>}
            </div>
          )}
          {scannerFeedback && (
            <p
              role="status"
              aria-live="polite"
              className={cn(
                "mt-2 text-sm font-medium",
                scannerFeedback.tone === "success" && "text-emerald-700",
                scannerFeedback.tone === "warning" && "text-amber-700",
                scannerFeedback.tone === "error" && "text-destructive",
                scannerFeedback.tone === "pending" && "text-muted-foreground",
                defaultConsultation && scannerFeedback.tone === "success" && "pdv-rol-feedback-success",
                defaultConsultation && scannerFeedback.tone !== "success" && "pdv-rol-feedback",
              )}
            >
              {scannerFeedback.message}
            </p>
          )}
        </div>

        {/* Results */}
        <ScrollArea className={cn("h-0 min-h-0 flex-1", defaultConsultation && "pdv-rol-results")}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div role="alert" className="py-8 text-center"><p>Não foi possível carregar as ordens deste setor.</p><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>
          ) : recent && !historyHasCriteria ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Informe um ROL, cliente ou período para consultar o histórico.</p>
            </div>
          ) : !recent && queryTerm.trim().length < 2 && !monthRange ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{defaultConsultation ? "Digite pelo menos 2 caracteres ou selecione o mês de entrada" : "Digite pelo menos 2 caracteres para buscar"}</p>
            </div>
          ) : !ordens || ordens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum ROL encontrado para os filtros informados</p>
            </div>
          ) : (
            <div className={cn("space-y-3 py-2", defaultConsultation && "pdv-rol-result-list")}>
              {!recent && ordens.length === 1000 && <p role="status" className="text-sm text-muted-foreground">Exibindo até 1.000 ROLs. Para localizar outros resultados, refine a busca por cliente, número ou situação.</p>}
              {ordens.map((ordem) => {
                const statusConfig = getStatusConfig(ordem.status);
                const isExpanded = expandedOS === ordem.id;
                const pendente = valorPendente(ordem);
                const isPendente = pendente > 0.009
                  && ordem.status !== "cancelada"
                  && ordem.condicao_pagamento !== "faturado";
                const readyForCustomer = ordem.itens.length > 0
                  && ordem.itens.every((item) => Boolean(item.posicao_prateleira?.trim()));

                return (
                  <div
                    key={ordem.id}
                    className={cn(
                      "border rounded-lg overflow-hidden transition-all",
                      defaultConsultation && "pdv-rol-order-card",
                      isExpanded && "ring-2 ring-primary/20",
                      ordem.leitura && "border-primary/40 bg-primary/[0.02]",
                    )}
                  >
                    {/* Order Header - Clickable */}
                    <button
                      onClick={() => toggleExpand(ordem.id)}
                      className={cn("flex w-full flex-col items-stretch gap-3 p-4 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between", defaultConsultation && "pdv-rol-order-header")}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="whitespace-nowrap font-mono font-bold">
                              ROL {ordem.numero}
                            </span>
                            {defaultConsultation && (
                              <Badge variant="secondary" className="pdv-rol-modality-badge">
                                {ordem.entrega_modalidade === "entrega" ? "Delivery" : "Retirada"}
                              </Badge>
                            )}
                            {ordem.urgente && (
                              <Badge variant="destructive" className="gap-1">
                                <Zap className="w-3 h-3" />
                                Lavagem Expressa
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
                            {!defaultConsultation && <Badge variant="secondary">
                              Entrada {format(parseISO(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                            </Badge>}
                            {!defaultConsultation && !isPendente && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                                Pagamento em dia
                              </Badge>
                            )}
                          </div>
                          {defaultConsultation ? (
                            <div className="pdv-rol-customer-contact">
                              <p className="pdv-rol-customer-name">
                                {ordem.cliente?.nome_fantasia || ordem.cliente?.razao_social}
                              </p>
                              {ordem.cliente?.telefone && (
                                <p className="pdv-rol-customer-phone"><Phone aria-hidden="true" />{ordem.cliente.telefone}</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {ordem.cliente?.nome_fantasia || ordem.cliente?.razao_social}
                            </p>
                          )}
                          {!defaultConsultation && <p className="mt-0.5 text-xs text-muted-foreground">
                            Atendido por: {ordem.atendente_id ? (funcionariosById.get(ordem.atendente_id) || "Atendente não localizado") : "Não identificado"}
                          </p>}
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            {getOrderQuantitySummary(ordem)}
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
                      <div className={cn("border-t bg-muted/30", defaultConsultation && "pdv-rol-expanded-content")}>
                        {/* Order Info */}
                        <div className={cn("grid grid-cols-2 gap-4 p-4 text-sm md:grid-cols-3 lg:grid-cols-6", defaultConsultation && "pdv-rol-order-meta")}>
                          <div>
                            <p className="text-muted-foreground">Entrada</p>
                            <p className="font-medium">
                              {format(parseISO(ordem.data_retirada), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Previsão Entrega</p>
                            <p className="font-medium">
                              {ordem.data_previsao_entrega
                                ? format(parseISO(ordem.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                                : "-"}
                            </p>
                          </div>
                          {!defaultConsultation && ordem.cliente?.telefone && (
                            <div>
                              <p className="text-muted-foreground">Telefone</p>
                              <p className="font-medium flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {ordem.cliente.telefone}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Modalidade</p>
                            <p className="font-medium">{ordem.entrega_modalidade === "entrega" ? "Delivery" : "Retirada"}</p>
                          </div>
                          {(ordem.taxa_entrega ?? 0) > 0 && (
                            <div>
                              <p className="text-muted-foreground">Taxa de delivery</p>
                              <p className="font-medium">{formatCurrency(ordem.taxa_entrega)}</p>
                              {ordem.delivery_modelo_snapshot === "km" && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {ordem.delivery_distancia_km_snapshot == null
                                    ? "Tarifa por KM (distância não registrada)"
                                    : `${Number(ordem.delivery_distancia_km_snapshot).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km × ${formatCurrency(ordem.delivery_taxa_km_snapshot ?? 0)}/km${Number(ordem.delivery_taxa_base_snapshot ?? 0) > 0 ? ` + base ${formatCurrency(ordem.delivery_taxa_base_snapshot)}` : ""}`}
                                </p>
                              )}
                            </div>
                          )}
                          <div>
                            <p className="text-muted-foreground">Pagamento</p>
                            <p className="font-medium capitalize">
                              {ordem.forma_pagamento || "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Atendente</p>
                            <p className="font-medium">{ordem.atendente_id ? (funcionariosById.get(ordem.atendente_id) || ordem.atendente?.nome || "Não localizado") : (ordem.atendente?.nome || "Não identificado")}</p>
                          </div>
                        </div>

                        <Separator className={cn(defaultConsultation && "pdv-rol-separator-hidden")} />

                        {/* Items List */}
                        <div className={cn("p-4", defaultConsultation && "pdv-rol-items-card")}>
                          <h4 className={cn("font-medium mb-3 flex items-center gap-2", defaultConsultation && "pdv-rol-items-heading")}>
                            <Package className="w-4 h-4" />
                            {positionMode ? "Itens e posição de armazenamento" : "Itens do ROL"}{!defaultConsultation && ` (${ordem.itens.length})`}
                            {defaultConsultation && <span className="pdv-rol-items-count">{getOrderQuantitySummary(ordem)}</span>}
                          </h4>
                          <div className={cn("space-y-2", defaultConsultation && "pdv-rol-items-table")}>
                            {defaultConsultation && (
                              <div className="pdv-rol-items-columns" aria-hidden="true">
                                <span>Produto</span><span>Qtd.</span><span>Unitário</span><span>Total</span><span>Prateleira</span>
                              </div>
                            )}
                            {ordem.itens.map((item) => {
                              const isEditing = editingPosition?.itemId === item.id;

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    "flex flex-col items-stretch justify-between gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center",
                                    positionMode && "border-primary/30",
                                    defaultConsultation && "pdv-rol-item-row",
                                  )}
                                >
                                  <div className={cn("flex-1", defaultConsultation && "pdv-rol-item-product")}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {item.produto?.nome || "Produto"}
                                      </span>
                                      <span className={cn("text-sm text-muted-foreground", defaultConsultation && "pdv-rol-item-qty-inline")}>
                                        x{formatOrderQuantity(item.quantidade)} {getItemUnitLabel(item.produto?.unidade)}
                                      </span>
                                      {ordem.leitura?.tipo === "item" && ordem.leitura.itemId === item.id && (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Item lido</Badge>
                                      )}
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
                                      <span className={cn("text-xs px-2 py-0.5 bg-muted rounded", defaultConsultation && "pdv-rol-price-inline")}>
                                        {formatCurrency(item.preco_unitario)} / {getItemUnitLabel(item.produto?.unidade)} × {formatOrderQuantity(item.quantidade)} {getItemUnitLabel(item.produto?.unidade)} = {formatCurrency(item.subtotal)}
                                      </span>
                                      {item.avarias && (
                                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3" />
                                          {item.avarias}
                                        </span>
                                      )}
                                      {item.observacoes && (
                                        <span className="basis-full text-xs text-muted-foreground">
                                          Observações: {item.observacoes}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {defaultConsultation && <span className="pdv-rol-item-quantity">{formatOrderQuantity(item.quantidade)} {getItemUnitLabel(item.produto?.unidade)}</span>}
                                  {defaultConsultation && <span className="pdv-rol-item-unit">{formatCurrency(item.preco_unitario)} / {getItemUnitLabel(item.produto?.unidade)}</span>}
                                  {defaultConsultation && <strong className="pdv-rol-item-total">{formatCurrency(item.subtotal)}</strong>}

                                  {/* Storage position - selected from the operation catalog */}
                                  {isEditing ? (
                                    <div className={cn("flex min-w-0 flex-wrap items-center gap-1 sm:flex-nowrap", defaultConsultation && "pdv-rol-position-cell")}>
                                      <Input
                                        list={`pdv-storage-positions-${positionArea}`}
                                        value={editingPosition.value}
                                        onChange={(event) => setEditingPosition({ ...editingPosition, value: event.target.value })}
                                        className="h-8 min-w-48 flex-1 text-sm"
                                        placeholder="Escolha ou digite a posição"
                                        aria-label="Local e posição de armazenamento"
                                      />
                                      <datalist id={`pdv-storage-positions-${positionArea}`}>
                                        {storagePositions.map((position) => <option key={position.id} value={position.nome_exibicao} />)}
                                      </datalist>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        aria-label={`Salvar posição de ${item.produto?.nome || "item"}`}
                                        title="Salvar posição de armazenamento"
                                        onClick={savePosition}
                                        disabled={isSavingPosition}
                                      >
                                        <Check className="w-4 h-4 text-green-600" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8"
                                        aria-label={`Cancelar edição da posição de ${item.produto?.nome || "item"}`}
                                        title="Cancelar edição da posição"
                                        onClick={cancelEditingPosition}
                                      >
                                        <X className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className={cn("flex items-center justify-between gap-2 sm:justify-end", defaultConsultation && "pdv-rol-position-cell")}>
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
                                        aria-label={`Editar posição de ${item.produto?.nome || "item"}`}
                                        title="Editar posição de armazenamento"
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

                        {canOperateCaixa && (
                          <div className={cn(defaultConsultation && "pdv-rol-history-card")}>
                            <PaymentHistory orderId={ordem.id} />
                          </div>
                        )}

                        {defaultConsultation ? (
                          <section className="pdv-rol-financial-card" aria-label="Resumo financeiro">
                            <h4><CreditCard aria-hidden="true" />Resumo financeiro</h4>
                            {Number(ordem.valor_acrescimo_express ?? 0) > 0 && <div className="pdv-rol-financial-row"><span>Lavagem Expressa</span><strong>+ {formatCurrency(Number(ordem.valor_acrescimo_express))}</strong></div>}
                            <div className="pdv-rol-financial-row"><span>Valor total</span><strong>{formatCurrency(ordem.valor_total)}</strong></div>
                            <div className="pdv-rol-financial-row"><span>Valor recebido</span><strong>{formatCurrency(ordem.valor_pago || 0)}</strong></div>
                            <div className="pdv-rol-financial-row pdv-rol-balance"><span>Saldo pendente</span><strong>{formatCurrency(Math.max(pendente, 0))}</strong></div>
                            {canOperateCaixa && ordem.condicao_pagamento !== "faturado" && onReceberPagamento && (
                              <Button
                                size="sm"
                                className="pdv-rol-receive-button"
                                disabled={!isPendente || !canReceivePayments || !onReceberPagamento}
                                title={!isPendente ? "Este ROL não possui saldo pendente" : !canReceivePayments ? receivePaymentBlockReason || "Abra o caixa para receber este pagamento" : "Receber pagamento parcial ou total"}
                                onClick={() => onReceberPagamento(ordem)}
                              >
                                <CreditCard aria-hidden="true" /> Receber pagamento
                              </Button>
                            )}
                            <p className="pdv-rol-payment-hint">Parcial ou total</p>
                            {isPendente && canOperateCaixa && !canReceivePayments && (
                              <p role="status" className="px-1 text-xs text-warning">{receivePaymentBlockReason || "Abra o caixa para registrar o recebimento deste ROL."}</p>
                            )}
                          </section>
                        ) : isPendente ? (
                          <>
                            <Separator />
                            <div className="p-4 bg-amber-50 border-t border-amber-200">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm text-amber-700">Valor Pendente</p>
                                  <p className="text-xl font-bold text-amber-800">{formatCurrency(pendente)}</p>
                                </div>
                                {canOperateCaixa && ordem.condicao_pagamento !== "faturado" && onReceberPagamento && (
                                  <Button size="sm" disabled={!canReceivePayments} title={!canReceivePayments ? receivePaymentBlockReason || "Abra o caixa para receber este pagamento" : undefined} onClick={() => onReceberPagamento(ordem)} className="bg-amber-600 hover:bg-amber-700">
                                    <CreditCard className="w-4 h-4 mr-2" />Receber pagamento parcial ou total
                                  </Button>
                                )}
                              </div>
                              {canOperateCaixa && !canReceivePayments && <p role="status" className="mt-2 text-xs text-warning">{receivePaymentBlockReason || "Abra o caixa para registrar o recebimento deste ROL."}</p>}
                            </div>
                          </>
                        ) : null}

                        {ordem.observacoes && (
                          <>
                            {!defaultConsultation && <Separator />}
                            <div className={cn("px-4 py-3 text-sm", defaultConsultation && "pdv-rol-notes")}>
                              <p className="font-medium">Observações gerais do ROL</p>
                              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{ordem.observacoes}</p>
                            </div>
                          </>
                        )}

                        {/* Actions */}
                        {!defaultConsultation && <Separator />}
                        <div className={cn("flex flex-wrap gap-1.5 p-3", defaultConsultation && "pdv-rol-actions-grid")}>
                          {canManageRol && !["entregue", "cancelada"].includes(ordem.status) && !defaultConsultation && (
                            <>
                              {onDarBaixa && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  disabled={valorPendente(ordem) > 0.009}
                                  title={valorPendente(ordem) > 0.009 ? `Receba o saldo de ${formatCurrency(valorPendente(ordem))} antes de dar baixa` : "Concluir atendimento com o ROL totalmente pago"}
                                  onClick={() => onDarBaixa(ordem)}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Dar baixa no ROL
                                </Button>
                              )}
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 px-2.5 text-xs"
                                onClick={() => setEditingOrder(ordem)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                Editar ROL completo
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => {
                                  setCancelReason("");
                                  setCancelingOrder(ordem);
                                }}
                              >
                                <CircleX className="w-3.5 h-3.5 mr-1.5" />
                                Cancelar ROL
                              </Button>
                            </>
                          )}
                          {defaultConsultation && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="pdv-rol-action-button pdv-rol-action-edit"
                              disabled={!canManageRol || ["entregue", "cancelada"].includes(ordem.status)}
                              title={!canManageRol ? "Seu perfil não pode editar este ROL" : "Editar dados e itens do ROL"}
                              onClick={() => setEditingOrder(ordem)}
                            >
                              <Pencil aria-hidden="true" />Editar ROL
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 px-2.5 text-xs", defaultConsultation && "pdv-rol-action-button pdv-rol-action-print")}
                            disabled={!onImprimirROL}
                            title={onImprimirROL ? "Imprimir o ROL" : "Impressão indisponível para este perfil"}
                            onClick={() => onImprimirROL?.(ordem.id)}
                          >
                            <Printer className="w-3.5 h-3.5 mr-1.5" />
                            Imprimir ROL
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 px-2.5 text-xs", defaultConsultation && "pdv-rol-action-button pdv-rol-action-tags")}
                            disabled={!onImprimirEtiquetas}
                            title={onImprimirEtiquetas ? "Imprimir etiquetas do ROL" : "Impressão indisponível para este perfil"}
                            onClick={() => onImprimirEtiquetas?.(ordem.id)}
                          >
                            <Tag className="w-3.5 h-3.5 mr-1.5" />
                            Etiquetas
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 px-2.5 text-xs", defaultConsultation && "pdv-rol-action-button pdv-rol-action-availability")}
                            disabled={!readyForCustomer || !onImprimirDisponibilidade}
                            title={readyForCustomer ? "Imprimir o documento de disponibilidade" : "Salve a localização de todas as peças primeiro"}
                            onClick={() => onImprimirDisponibilidade?.(ordem.id)}
                          >
                            <Package className="w-3.5 h-3.5 mr-1.5" />
                            ROL disponível
                          </Button>
                          {defaultConsultation && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="pdv-rol-action-button pdv-rol-action-entry"
                              disabled={!canManageRol || ["entregue", "cancelada"].includes(ordem.status) || !onEnviarEntrada}
                              title={!canManageRol ? "Seu perfil não pode enviar avisos" : "Enviar aviso de entrada do ROL ao cliente"}
                              onClick={() => onEnviarEntrada?.(ordem)}
                            >
                              <MessageCircle aria-hidden="true" />Enviar aviso de entrada
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-8 px-2.5 text-xs", defaultConsultation && "pdv-rol-action-button pdv-rol-action-whatsapp")}
                            data-testid="pdv-send-availability-whatsapp"
                            disabled={!readyForCustomer || !onEnviarDisponibilidade}
                            title={readyForCustomer ? (onEnviarDisponibilidade ? "Enviar um único aviso de ROL disponível pelo WhatsApp" : "Aviso WhatsApp indisponível para este perfil") : "Salve a localização de todas as peças primeiro"}
                            onClick={() => onEnviarDisponibilidade?.(ordem)}
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                            {defaultConsultation ? "Aviso WhatsApp" : "Enviar aviso WhatsApp"}
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
        {defaultConsultation && (
          <div className="pdv-rol-footer">
            <Button
              variant="outline"
              className="pdv-rol-cancel-button"
              disabled={!selectedOrder || !canManageRol || ["entregue", "cancelada"].includes(selectedOrder.status)}
              title={!selectedOrder ? "Localize e abra um ROL primeiro" : "Cancelar ROL com motivo obrigatório"}
              onClick={() => {
                if (!selectedOrder) return;
                setCancelReason("");
                setCancelingOrder(selectedOrder);
              }}
            >
              <CircleX aria-hidden="true" />Cancelar ROL
            </Button>
            <Button
              className="pdv-rol-close-order-button"
              disabled={!selectedOrder || !canManageRol || !onDarBaixa || ["entregue", "cancelada"].includes(selectedOrder.status) || valorPendente(selectedOrder) > 0.009}
              title={!selectedOrder ? "Localize e abra um ROL primeiro" : !canManageRol ? "Seu perfil não pode concluir este atendimento" : valorPendente(selectedOrder) > 0.009 ? `Receba o saldo de ${formatCurrency(valorPendente(selectedOrder))} antes de dar baixa` : "Concluir atendimento com o ROL totalmente pago"}
              onClick={() => selectedOrder && onDarBaixa?.(selectedOrder)}
            >
              <Check aria-hidden="true" />
              <span>Dar baixa no ROL<small>Concluir atendimento</small></span>
            </Button>
          </div>
        )}
      </DialogContent>
      </Dialog>

      <EditarRolPdvDialog
        open={Boolean(editingOrder)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingOrder(null);
        }}
        ordem={editingOrder}
        onSaved={() => {
          setEditingOrder(null);
          void refetch();
        }}
      />

      <AlertDialog open={Boolean(cancelingOrder)} onOpenChange={(nextOpen) => {
        if (!nextOpen && !isCancelling) {
          setCancelingOrder(null);
          setCancelReason("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar ROL {cancelingOrder?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              O ROL será preservado no histórico e deixará de aparecer como atendimento aberto. Pagamentos confirmados precisam ser estornados antes do cancelamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="pdv-cancel-rol-reason" className="text-sm font-medium">Motivo do cancelamento *</label>
            <Textarea
              id="pdv-cancel-rol-reason"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Ex.: cliente solicitou o cancelamento antes do início da produção"
              maxLength={1000}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Informe pelo menos 5 caracteres.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelReason.trim().length < 5 || isCancelling}
              onClick={(event) => {
                event.preventDefault();
                void cancelOrder();
              }}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
