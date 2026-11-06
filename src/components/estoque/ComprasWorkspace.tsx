import { useDeferredValue, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import {
  ArchiveX,
  ArrowDownToLine,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useCompras, useEstoqueLocais, type PedidoCompra } from "@/hooks/useCompras";
import { usePurchaseDirectory, usePurchaseOrderDetails } from "@/hooks/usePurchaseDirectory";
import { useEstoque } from "@/hooks/useEstoque";
import { useFornecedores } from "@/hooks/useFornecedores";
import { useIsAdmin } from "@/hooks/usePermissoesUsuario";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  normalizePurchaseDirectoryPage,
  normalizePurchaseDirectorySearchInput,
  normalizePurchaseDirectoryStatus,
  PURCHASE_DIRECTORY_PAGE_SIZE,
  sanitizePurchaseDirectorySearch,
} from "@/lib/purchaseDirectory";
import { toast } from "sonner";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const today = () => format(new Date(), "yyyy-MM-dd");

const statusConfig = {
  rascunho: { label: "Rascunho", variant: "outline" as const },
  aprovado: { label: "Aguardando recebimento", variant: "secondary" as const },
  parcial: { label: "Recebido parcialmente", variant: "secondary" as const },
  recebido: { label: "Recebido", variant: "default" as const },
  cancelado: { label: "Cancelado", variant: "destructive" as const },
};

const pendingQuantity = (order: PedidoCompra) => order.itens.reduce(
  (total, item) => total + Number(item.quantidade_solicitada) - Number(item.quantidade_recebida) + Number(item.quantidade_devolvida),
  0,
);

const netReceivedQuantity = (order: PedidoCompra) => order.itens.reduce(
  (total, item) => total + Number(item.quantidade_recebida) - Number(item.quantidade_devolvida),
  0,
);

type ItemDraft = { productId: string; quantity: string; unitCost: string };

function PurchaseOrderDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PedidoCompra | null;
}) {
  const { fornecedores } = useFornecedores();
  const { produtos } = useEstoque();
  const { save } = useCompras();
  const [supplierId, setSupplierId] = useState("");
  const [deliveryForecast, setDeliveryForecast] = useState("");
  const [paymentDays, setPaymentDays] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ productId: "", quantity: "", unitCost: "" }]);
  const commandKey = useRef(createIdempotencyKey("purchase-save"));

  const reset = (nextOrder: PedidoCompra | null) => {
    setSupplierId(nextOrder?.fornecedor_id || "");
    setDeliveryForecast(nextOrder?.previsao_entrega || "");
    setPaymentDays(String(nextOrder?.prazo_pagamento_dias ?? 0));
    setNotes(nextOrder?.observacoes || "");
    setItems(nextOrder?.itens.length
      ? nextOrder.itens.map((item) => ({
          productId: item.estoque_produto_id,
          quantity: String(item.quantidade_solicitada),
          unitCost: String(item.custo_unitario),
        }))
      : [{ productId: "", quantity: "", unitCost: "" }]);
    commandKey.current = createIdempotencyKey("purchase-save");
  };

  useEffect(() => {
    if (open) reset(order);
  }, [open, order]);

  const total = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitCost || 0), 0);
  const updateItem = (index: number, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const submit = async () => {
    const normalized = items
      .filter((item) => item.productId || item.quantity || item.unitCost)
      .map((item) => ({
        produtoId: item.productId,
        quantidade: Number(item.quantity),
        custoUnitario: Number(item.unitCost),
      }));
    if (!supplierId) return toast.error("Selecione o fornecedor.");
    if (!normalized.length || normalized.some((item) => !item.produtoId || item.quantidade <= 0 || item.custoUnitario <= 0)) {
      return toast.error("Informe produto, quantidade e custo positivo em todos os itens.");
    }
    if (new Set(normalized.map((item) => item.produtoId)).size !== normalized.length) {
      return toast.error("O mesmo insumo não pode aparecer duas vezes.");
    }
    await save.mutateAsync({
      pedidoId: order?.id,
      fornecedorId: supplierId,
      previsaoEntrega: deliveryForecast || undefined,
      prazoPagamentoDias: Number(paymentDays || 0),
      observacoes: notes,
      versaoEsperada: order?.versao,
      itens: normalized,
      idempotencyKey: commandKey.current,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{order ? `Editar pedido #${order.numero}` : "Novo pedido de compra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Fornecedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Selecione um parceiro" /></SelectTrigger>
                <SelectContent>
                  {fornecedores.filter((supplier) => supplier.ativo).map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Previsão de entrega</Label>
              <Input type="date" min={today()} value={deliveryForecast} onChange={(event) => setDeliveryForecast(event.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <div>
              <Label>Prazo de pagamento</Label>
              <div className="relative">
                <Input type="number" min="0" max="3650" value={paymentDays} onChange={(event) => setPaymentDays(event.target.value)} className="pr-12" />
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">dias</span>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Condições, contato ou instruções de entrega" />
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="font-semibold">Itens do pedido</h3>
                <p className="text-xs text-muted-foreground">O custo informado será usado no recebimento e no contas a pagar.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setItems((current) => [...current, { productId: "", quantity: "", unitCost: "" }])}>
                <Plus className="mr-1 h-4 w-4" />Item
              </Button>
            </div>
            <div className="space-y-3 p-4">
              {items.map((item, index) => (
                <div key={index} className="grid items-end gap-2 rounded-lg border bg-card p-3 md:grid-cols-[minmax(220px,1fr)_120px_140px_120px_36px]">
                  <div>
                    <Label>Insumo</Label>
                    <Select value={item.productId} onValueChange={(value) => {
                      const product = produtos.find((candidate) => candidate.id === value);
                      updateItem(index, { productId: value, unitCost: item.unitCost || String(product?.preco_custo || "") });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{produtos.filter((product) => product.ativo).map((product) => <SelectItem key={product.id} value={product.id}>{product.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantidade</Label>
                    <Input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
                  </div>
                  <div>
                    <Label>Custo unitário</Label>
                    <Input type="number" min="0.01" step="0.01" value={item.unitCost} onChange={(event) => updateItem(index, { unitCost: event.target.value })} />
                  </div>
                  <div className="pb-2 text-right font-semibold">{money.format(Number(item.quantity || 0) * Number(item.unitCost || 0))}</div>
                  <Button variant="ghost" size="icon" title="Remover item" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t px-4 py-3">
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total previsto</p>
                <p className="text-xl font-bold">{money.format(total)}</p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar rascunho"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ order, open, onOpenChange }: { order: PedidoCompra | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { receive } = useCompras();
  const { locais } = useEstoqueLocais({ enabled: open, includeBalances: false });
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(today());
  const [document, setDocument] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const commandKey = useRef(createIdempotencyKey("purchase-receive"));

  useEffect(() => {
    if (open) {
      setLocationId(locais.find((location) => location.ativo)?.id || "");
      setDate(today());
      setDocument("");
      setQuantities({});
      commandKey.current = createIdempotencyKey("purchase-receive");
    }
  }, [open, order, locais]);

  const submit = async () => {
    if (!order || !locationId) return toast.error("Selecione o local de recebimento.");
    const items = order.itens.map((item) => ({ itemId: item.id, quantidade: Number(quantities[item.id] || 0) })).filter((item) => item.quantidade > 0);
    if (!items.length) return toast.error("Informe ao menos uma quantidade recebida.");
    const invalid = items.some((input) => {
      const item = order.itens.find((candidate) => candidate.id === input.itemId)!;
      return input.quantidade > Number(item.quantidade_solicitada) - Number(item.quantidade_recebida) + Number(item.quantidade_devolvida);
    });
    if (invalid) return toast.error("Uma quantidade excede o saldo pendente.");
    await receive.mutateAsync({ order, localId: locationId, date, document, items, idempotencyKey: commandKey.current });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Receber pedido #{order?.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            Este recebimento gerará uma entrada por local e uma conta a pagar apenas pelo valor recebido agora.
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Data *</Label><Input type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Documento do fornecedor</Label><Input value={document} onChange={(event) => setDocument(event.target.value)} placeholder="NF, romaneio ou protocolo" /></div>
          </div>
          <div>
            <Label>Local de entrada *</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{locais.filter((location) => location.ativo).map((location) => <SelectItem key={location.id} value={location.id}>{location.codigo} · {location.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            {order?.itens.map((item) => {
              const pending = Number(item.quantidade_solicitada) - Number(item.quantidade_recebida) + Number(item.quantidade_devolvida);
              return (
                <div key={item.id} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_150px]">
                  <div>
                    <p className="font-medium">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">Pendente: {number.format(pending)} {item.unidade} · {money.format(Number(item.custo_unitario))}/un.</p>
                  </div>
                  <Input type="number" min="0" max={pending} step="0.001" placeholder="Qtd. recebida" value={quantities[item.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={receive.isPending}>{receive.isPending ? "Conciliando..." : "Confirmar recebimento"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ order, open, onOpenChange }: { order: PedidoCompra | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { returnReceipt } = useCompras();
  const { locais } = useEstoqueLocais({ enabled: open, includeBalances: false });
  const [receiptId, setReceiptId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(today());
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const commandKey = useRef(createIdempotencyKey("purchase-return"));
  const receipt = order?.recebimentos.find((candidate) => candidate.id === receiptId);

  const chooseReceipt = (id: string, sourceOrder = order) => {
    const nextReceipt = sourceOrder?.recebimentos.find((candidate) => candidate.id === id);
    setReceiptId(id);
    setLocationId(nextReceipt?.estoque_local_id || "");
    setQuantities({});
  };
  useEffect(() => {
    if (open) {
      const first = order?.recebimentos.find((candidate) => candidate.itens.some((item) => Number(item.quantidade) > Number(item.quantidade_devolvida)));
      setReceiptId(first?.id || "");
      setLocationId(first?.estoque_local_id || "");
      setQuantities({});
      setDate(today());
      setReason("");
      commandKey.current = createIdempotencyKey("purchase-return");
    }
  }, [open, order]);
  const submit = async () => {
    if (!order || !receipt || !locationId) return toast.error("Selecione o recebimento e o local da devolução.");
    if (reason.trim().length < 5) return toast.error("Descreva o motivo da devolução.");
    const items = receipt.itens.map((item) => ({ recebimentoItemId: item.id, quantidade: Number(quantities[item.id] || 0) })).filter((item) => item.quantidade > 0);
    if (!items.length) return toast.error("Informe ao menos uma quantidade devolvida.");
    if (items.some((input) => {
      const item = receipt.itens.find((candidate) => candidate.id === input.recebimentoItemId)!;
      return input.quantidade > Number(item.quantidade) - Number(item.quantidade_devolvida);
    })) return toast.error("Uma quantidade excede o saldo devolvível.");
    await returnReceipt.mutateAsync({ order, receiptId: receipt.id, localId: locationId, date, reason, items, idempotencyKey: commandKey.current });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Devolver mercadoria do pedido #{order?.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">A devolução retira o saldo do estoque. O valor ainda não pago reduz a obrigação; o valor já pago vira crédito com o fornecedor.</div>
          <div>
            <Label>Recebimento de origem *</Label>
            <Select value={receiptId} onValueChange={chooseReceipt}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{order?.recebimentos.filter((candidate) => candidate.itens.some((item) => Number(item.quantidade) > Number(item.quantidade_devolvida))).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{format(new Date(`${candidate.data_recebimento}T12:00:00`), "dd/MM/yyyy")} · {money.format(Number(candidate.valor_total))} {candidate.documento_fornecedor ? `· ${candidate.documento_fornecedor}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Data *</Label><Input type="date" max={today()} min={receipt?.data_recebimento} value={date} onChange={(event) => setDate(event.target.value)} /></div>
            <div><Label>Local de saída *</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{locais.filter((location) => location.ativo).map((location) => <SelectItem key={location.id} value={location.id}>{location.codigo} · {location.nome}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Motivo *</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: lote avariado, divergência de qualidade..." rows={2} /></div>
          <div className="space-y-2">
            {receipt?.itens.map((item) => {
              const orderItem = order?.itens.find((candidate) => candidate.id === item.pedido_item_id);
              const available = Number(item.quantidade) - Number(item.quantidade_devolvida);
              return <div key={item.id} className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_150px]"><div><p className="font-medium">{orderItem?.descricao}</p><p className="text-xs text-muted-foreground">Devolvível: {number.format(available)} {orderItem?.unidade}</p></div><Input type="number" min="0" max={available} step="0.001" placeholder="Qtd. devolvida" value={quantities[item.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></div>;
            })}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button variant="destructive" onClick={submit} disabled={returnReceipt.isPending}>{returnReceipt.isPending ? "Conciliando..." : "Confirmar devolução"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseDetailsDialog({
  order,
  open,
  onOpenChange,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onReceive,
  onReturn,
  onCancel,
  isAdmin,
}: {
  order: PedidoCompra | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onReceive: () => void;
  onReturn: () => void;
  onCancel: () => void;
  isAdmin: boolean;
}) {
  if (!order) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Pedido de compra</DialogTitle></DialogHeader>
          {isLoading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando detalhes do pedido...</div> : isError ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Não foi possível carregar os detalhes deste pedido. Nenhuma alteração foi realizada.</p><Button onClick={onRetry}>Tentar novamente</Button></div> : <p className="text-sm text-muted-foreground">Selecione um pedido para consultar os detalhes.</p>}
        </DialogContent>
      </Dialog>
    );
  }
  const ordered = order.itens.reduce((sum, item) => sum + Number(item.quantidade_solicitada), 0);
  const received = netReceivedQuantity(order);
  const progress = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8"><DialogTitle>Pedido #{order.numero}</DialogTitle><Badge variant={statusConfig[order.status].variant}>{statusConfig[order.status].label}</Badge></div>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3 sm:col-span-2"><p className="text-xs uppercase tracking-wide text-muted-foreground">Fornecedor</p><p className="font-semibold">{order.fornecedor_nome}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Pedido</p><p className="font-semibold">{format(new Date(`${order.data_pedido}T12:00:00`), "dd/MM/yyyy")}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">Total previsto</p><p className="font-semibold">{money.format(Number(order.valor_total))}</p></div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="mb-2 flex items-center justify-between"><div><p className="font-semibold">Progresso do recebimento</p><p className="text-xs text-muted-foreground">{number.format(received)} de {number.format(ordered)} unidades líquidas</p></div><span className="text-sm font-bold">{Math.round(progress)}%</span></div>
            <Progress value={progress} />
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-[680px]"><TableHeader><TableRow><TableHead>Insumo</TableHead><TableHead className="text-right">Pedido</TableHead><TableHead className="text-right">Recebido</TableHead><TableHead className="text-right">Devolvido</TableHead><TableHead className="text-right">Pendente</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader><TableBody>{order.itens.map((item) => { const pending = Number(item.quantidade_solicitada) - Number(item.quantidade_recebida) + Number(item.quantidade_devolvida); return <TableRow key={item.id}><TableCell><p className="font-medium">{item.descricao}</p><p className="text-xs text-muted-foreground">{item.unidade}</p></TableCell><TableCell className="text-right">{number.format(Number(item.quantidade_solicitada))}</TableCell><TableCell className="text-right text-emerald-600">{number.format(Number(item.quantidade_recebida))}</TableCell><TableCell className="text-right text-amber-600">{number.format(Number(item.quantidade_devolvida))}</TableCell><TableCell className="text-right font-semibold">{number.format(pending)}</TableCell><TableCell className="text-right">{money.format(Number(item.custo_unitario))}</TableCell></TableRow>; })}</TableBody></Table>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><ArrowDownToLine className="h-4 w-4" />Recebimentos e financeiro</h3>
            {order.recebimentos.length === 0 ? <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum recebimento registrado.</div> : <div className="space-y-2">{order.recebimentos.map((receipt) => <div key={receipt.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto]"><div><p className="font-medium">{format(new Date(`${receipt.data_recebimento}T12:00:00`), "dd 'de' MMMM", { locale: ptBR })}</p><p className="text-xs text-muted-foreground">{receipt.documento_fornecedor || "Sem documento"} · {receipt.itens.length} item(ns)</p></div><div className="sm:text-right"><p className="font-semibold">{money.format(Number(receipt.valor_total))}</p><p className="text-xs text-muted-foreground">Vence {receipt.conta ? format(new Date(`${receipt.conta.vencimento}T12:00:00`), "dd/MM/yyyy") : "—"}</p></div><Badge variant={receipt.conta?.status === "pago" ? "default" : "outline"} className="self-center justify-self-start sm:justify-self-end">Conta {receipt.conta?.status || "vinculada"}</Badge></div>)}</div>}
          </div>

          {(order.devolucoes.length > 0 || order.creditos.length > 0) && <div><h3 className="mb-2 flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4" />Devoluções e créditos</h3><div className="space-y-2">{order.devolucoes.map((entry) => <div key={entry.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{entry.motivo}</p><p className="text-xs text-muted-foreground">{format(new Date(`${entry.data_devolucao}T12:00:00`), "dd/MM/yyyy")} · estorno {money.format(Number(entry.reducao_obrigacao))} · crédito {money.format(Number(entry.credito_fornecedor))}</p></div><span className="font-semibold text-amber-700 dark:text-amber-300">{money.format(Number(entry.valor_total))}</span></div></div>)}</div></div>}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {order.status === "rascunho" && <Button variant="outline" onClick={onEdit}>Editar rascunho</Button>}
          {["aprovado", "parcial"].includes(order.status) && <Button onClick={onReceive}><PackageCheck className="mr-2 h-4 w-4" />Receber</Button>}
          {isAdmin && order.recebimentos.some((receipt) => receipt.itens.some((item) => Number(item.quantidade) > Number(item.quantidade_devolvida))) && <Button variant="outline" onClick={onReturn}><RotateCcw className="mr-2 h-4 w-4" />Devolver</Button>}
          {isAdmin && order.status !== "cancelado" && pendingQuantity(order) > 0 && <Button variant="ghost" className="text-destructive" onClick={onCancel}><ArchiveX className="mr-2 h-4 w-4" />Cancelar saldo</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ComprasWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { approve, cancel } = useCompras();
  const adminQuery = useIsAdmin();
  const isAdmin = adminQuery.data === true;
  const querySearch = searchParams.get("compra-busca") ?? "";
  const page = normalizePurchaseDirectoryPage(searchParams.get("compra-pagina"));
  const status = normalizePurchaseDirectoryStatus(searchParams.get("compra-situacao"));
  const [search, setSearch] = useState(querySearch);
  const deferredSearch = useDeferredValue(sanitizePurchaseDirectorySearch(querySearch));
  const directoryQuery = usePurchaseDirectory({ page, pageSize: PURCHASE_DIRECTORY_PAGE_SIZE, search: deferredSearch, status });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedQuery = usePurchaseOrderDetails(selectedId);
  const selected = selectedQuery.data ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const cancelKey = useRef(createIdempotencyKey("purchase-cancel"));

  useEffect(() => {
    setSearch(querySearch);
  }, [querySearch]);

  const updateDirectoryParams = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    if (resetPage) next.delete("compra-pagina");
    setSearchParams(next, { replace: true });
  };
  const updateSearch = (value: string) => {
    const normalized = normalizePurchaseDirectorySearchInput(value);
    setSearch(normalized);
    updateDirectoryParams({ "compra-busca": sanitizePurchaseDirectorySearch(normalized) || null });
  };
  const setPage = (nextPage: number) => updateDirectoryParams({ "compra-pagina": String(nextPage) }, false);
  const openDetails = (orderId: string) => { setSelectedId(orderId); setDetailsOpen(true); };
  const openNew = () => { setEditingId(null); setFormOpen(true); };
  const openEdit = () => { if (!selected) return; setEditingId(selected.id); setDetailsOpen(false); setFormOpen(true); };
  const openReceive = () => { setDetailsOpen(false); setReceiveOpen(true); };
  const openReturn = () => { setDetailsOpen(false); setReturnOpen(true); };
  const openCancel = () => { setCancelReason(""); cancelKey.current = createIdempotencyKey("purchase-cancel"); setDetailsOpen(false); setCancelOpen(true); };
  const confirmCancel = async () => {
    if (!selected || cancelReason.trim().length < 5) return toast.error("Informe o motivo do cancelamento.");
    await cancel.mutateAsync({ order: selected, reason: cancelReason, idempotencyKey: cancelKey.current });
    setCancelOpen(false);
  };
  const directory = directoryQuery.data;
  const orders = directory?.items || [];
  const totalPages = Math.max(1, Math.ceil((directory?.total || 0) / PURCHASE_DIRECTORY_PAGE_SIZE));
  const rangeStart = directory?.total ? (page - 1) * PURCHASE_DIRECTORY_PAGE_SIZE + 1 : 0;
  const rangeEnd = directory ? Math.min(page * PURCHASE_DIRECTORY_PAGE_SIZE, directory.total) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Rascunhos", value: directory?.summary.draftCount ?? "—", icon: FileText }, { label: "Aguardando recebimento", value: directory?.summary.receivingCount ?? "—", icon: Clock3 }, { label: "Valor ainda pendente", value: directory ? money.format(directory.summary.pendingValue) : "—", icon: ShoppingCart }, { label: "Créditos com fornecedores", value: directory ? money.format(directory.summary.availableCreditValue) : "—", icon: RotateCcw }].map((item) => <Card key={item.label}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><item.icon className="h-5 w-5" /></div><div><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="text-xl font-bold">{item.value}</p></div></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="text-lg">Pedidos de compra</CardTitle><p className="text-sm text-muted-foreground">Aprovação, recebimento parcial, devolução e financeiro na mesma origem.</p></div>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo pedido</Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar pedidos de compra por número ou fornecedor" className="pl-9" placeholder="Buscar por número ou fornecedor" value={search} onChange={(event) => updateSearch(event.target.value)} skipUppercase /></div>
            <Select value={status} onValueChange={(value) => updateDirectoryParams({ "compra-situacao": value === "open" ? null : value })}><SelectTrigger aria-label="Filtrar pedidos de compra por situação" className="sm:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Em aberto</SelectItem><SelectItem value="all">Todos os pedidos</SelectItem><SelectItem value="rascunho">Rascunhos</SelectItem><SelectItem value="aprovado">Aguardando</SelectItem><SelectItem value="parcial">Parciais</SelectItem><SelectItem value="recebido">Recebidos</SelectItem><SelectItem value="cancelado">Cancelados</SelectItem></SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {directoryQuery.isError && <div className="page-empty-state mx-3 mb-3"><p>Não foi possível carregar os pedidos. Nenhuma lista vazia foi criada.</p><Button className="mt-3" variant="outline" onClick={() => void directoryQuery.refetch()}>Tentar novamente</Button></div>}
          <div className={directoryQuery.isError ? "hidden" : "hidden overflow-x-auto md:block"} data-testid="purchase-directory-table-scroll">
            <Table className="min-w-[820px]"><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Fornecedor</TableHead><TableHead>Situação</TableHead><TableHead>Previsão</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pendente</TableHead><TableHead className="w-[180px]">Ações</TableHead></TableRow></TableHeader><TableBody>
              {directoryQuery.isLoading ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Carregando compras...</TableCell></TableRow> : orders.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow> : orders.map((order) => <TableRow key={order.id} className="cursor-pointer" onClick={() => openDetails(order.id)}><TableCell><p className="font-semibold">#{order.numero}</p><p className="text-xs text-muted-foreground">{format(new Date(`${order.data_pedido}T12:00:00`), "dd/MM/yyyy")}</p></TableCell><TableCell className="font-medium">{order.fornecedor_nome}</TableCell><TableCell><Badge variant={statusConfig[order.status].variant}>{statusConfig[order.status].label}</Badge></TableCell><TableCell>{order.previsao_entrega ? format(new Date(`${order.previsao_entrega}T12:00:00`), "dd/MM/yyyy") : "—"}</TableCell><TableCell className="text-right font-medium">{money.format(Number(order.valor_total))}</TableCell><TableCell className="text-right">{number.format(order.quantidade_pendente)}</TableCell><TableCell onClick={(event) => event.stopPropagation()}><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openDetails(order.id)}>Detalhes</Button>{order.status === "rascunho" && isAdmin && <Button size="sm" onClick={() => approve.mutate({ id: order.id, versao: order.versao })} disabled={approve.isPending}><BadgeCheck className="mr-1 h-4 w-4" />Aprovar</Button>}{["aprovado", "parcial"].includes(order.status) && <Button size="sm" onClick={() => { setSelectedId(order.id); setReceiveOpen(true); }}><ArrowDownToLine className="mr-1 h-4 w-4" />Receber</Button>}</div></TableCell></TableRow>)}
            </TableBody></Table>
          </div>
          <div className={directoryQuery.isError ? "hidden" : "space-y-3 p-3 md:hidden"} data-testid="purchase-directory-cards">
            {directoryQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando compras...</p> : orders.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido encontrado.</p> : orders.map((order) => <button key={order.id} type="button" onClick={() => openDetails(order.id)} className="w-full rounded-xl border bg-card p-4 text-left shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">Pedido #{order.numero}</p><p className="text-sm text-muted-foreground">{order.fornecedor_nome}</p></div><Badge variant={statusConfig[order.status].variant}>{statusConfig[order.status].label}</Badge></div><Separator className="my-3" /><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold">{money.format(Number(order.valor_total))}</p></div><div><p className="text-xs text-muted-foreground">Saldo pendente</p><p className="font-semibold">{number.format(order.quantidade_pendente)}</p></div></div></button>)}
          </div>
          {!directoryQuery.isError && directory && <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><p className="text-muted-foreground">{directory.total ? `Exibindo ${rangeStart}–${rangeEnd} de ${directory.total} pedidos` : "Nenhum pedido no recorte atual"}</p><nav aria-label="Paginação de pedidos de compra" className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1 || directoryQuery.isFetching} aria-label="Página anterior de pedidos de compra"><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-24 text-center text-xs font-medium">Página {page} de {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages || directoryQuery.isFetching} aria-label="Próxima página de pedidos de compra"><ChevronRight className="h-4 w-4" /></Button></nav></div>}
        </CardContent>
      </Card>

      <PurchaseOrderDialog open={formOpen} onOpenChange={setFormOpen} order={editingId ? selected : null} />
      <PurchaseDetailsDialog order={selected} open={detailsOpen} onOpenChange={setDetailsOpen} isLoading={selectedQuery.isLoading} isError={selectedQuery.isError} onRetry={() => void selectedQuery.refetch()} onEdit={openEdit} onReceive={openReceive} onReturn={openReturn} onCancel={openCancel} isAdmin={isAdmin} />
      <ReceiveDialog order={selected} open={receiveOpen && Boolean(selected)} onOpenChange={setReceiveOpen} />
      <ReturnDialog order={selected} open={returnOpen && Boolean(selected)} onOpenChange={setReturnOpen} />
      <Dialog open={cancelOpen && Boolean(selected)} onOpenChange={setCancelOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Cancelar saldo pendente</DialogTitle></DialogHeader><div className="space-y-3"><div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">Recebimentos, movimentações e contas existentes não serão apagados. Apenas a parcela ainda pendente deixará de ser recebida.</div><div><Label>Motivo *</Label><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Informe o motivo operacional" /></div></div><DialogFooter><Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button><Button variant="destructive" onClick={confirmCancel} disabled={cancel.isPending}>{cancel.isPending ? "Cancelando..." : "Cancelar saldo"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
