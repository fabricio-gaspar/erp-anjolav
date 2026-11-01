import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Loader2, PackageCheck, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ItemOrdemServico } from "@/hooks/useOrdensServico";
import { useOrderFulfillment, type QualityMovementInput } from "@/hooks/useOrderFulfillment";
import { createIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";

interface QualityDraft {
  approved: string;
  retained: string;
  rework: string;
  reason: string;
}

interface ResolutionDraft {
  itemId: string;
  origin: "RETIDO" | "RETRABALHO";
  result: "APROVADO" | "RETIDO" | "RETRABALHO";
  quantity: string;
  reason: string;
}

interface QualityDeliveryPanelProps {
  orderId: string;
  items: ItemOrdemServico[];
  paymentStatus?: string | null;
  paymentCondition?: string | null;
}

const quantity = (value: number | string | null | undefined) => Number(value || 0);
const formatQuantity = (value: number, unit?: string) =>
  `${Number.isInteger(value) ? value : value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit || "un."}`;

export function QualityDeliveryPanel({
  orderId,
  items,
  paymentStatus,
  paymentCondition,
}: QualityDeliveryPanelProps) {
  const { qualityHistory, deliveries, registerQuality, registerDelivery } = useOrderFulfillment(orderId);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [qualityDraft, setQualityDraft] = useState<Record<string, QualityDraft>>({});
  const [resolutionDraft, setResolutionDraft] = useState<Record<string, ResolutionDraft>>({});
  const [deliveryDraft, setDeliveryDraft] = useState<Record<string, string>>({});
  const [qualityKey, setQualityKey] = useState("");
  const [deliveryKey, setDeliveryKey] = useState("");
  const [newForecast, setNewForecast] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverDocument, setReceiverDocument] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [authorizeWithBalance, setAuthorizeWithBalance] = useState(false);
  const [balanceReason, setBalanceReason] = useState("");

  const totals = useMemo(() => items.reduce(
    (acc, item) => {
      const total = quantity(item.quantidade);
      const approved = quantity(item.quantidade_aprovada);
      const retained = quantity(item.quantidade_retida);
      const rework = quantity(item.quantidade_retrabalho);
      const delivered = quantity(item.quantidade_entregue);
      acc.total += total;
      acc.approved += approved;
      acc.retained += retained;
      acc.rework += rework;
      acc.delivered += delivered;
      acc.pendingQuality += Math.max(total - approved - retained - rework, 0);
      acc.availableDelivery += Math.max(approved - delivered, 0);
      return acc;
    },
    { total: 0, approved: 0, retained: 0, rework: 0, delivered: 0, pendingQuality: 0, availableDelivery: 0 },
  ), [items]);

  const openQuality = () => {
    const draft = Object.fromEntries(items.map((item) => {
      const pending = Math.max(
        quantity(item.quantidade)
          - quantity(item.quantidade_aprovada)
          - quantity(item.quantidade_retida)
          - quantity(item.quantidade_retrabalho),
        0,
      );
      return [item.id, {
        approved: pending > 0 ? String(pending) : "",
        retained: "",
        rework: "",
        reason: "",
      }];
    }));
    setQualityDraft(draft);
    setNewForecast("");
    setQualityKey(createIdempotencyKey("quality"));
    setQualityOpen(true);
  };

  const openDelivery = () => {
    setDeliveryDraft(Object.fromEntries(items.map((item) => [
      item.id,
      String(Math.max(quantity(item.quantidade_aprovada) - quantity(item.quantidade_entregue), 0) || ""),
    ])));
    setReceiverName("");
    setReceiverDocument("");
    setDeliveryNotes("");
    setAuthorizeWithBalance(false);
    setBalanceReason("");
    setDeliveryKey(createIdempotencyKey("delivery"));
    setDeliveryOpen(true);
  };

  const openResolution = () => {
    const draft: Record<string, ResolutionDraft> = {};
    for (const item of items) {
      const retained = quantity(item.quantidade_retida);
      const rework = quantity(item.quantidade_retrabalho);
      if (retained > 0) {
        draft[`${item.id}:RETIDO`] = {
          itemId: item.id,
          origin: "RETIDO",
          result: "RETRABALHO",
          quantity: String(retained),
          reason: "",
        };
      }
      if (rework > 0) {
        draft[`${item.id}:RETRABALHO`] = {
          itemId: item.id,
          origin: "RETRABALHO",
          result: "APROVADO",
          quantity: String(rework),
          reason: "",
        };
      }
    }
    setResolutionDraft(draft);
    setNewForecast("");
    setQualityKey(createIdempotencyKey("quality-resolution"));
    setResolutionOpen(true);
  };

  const submitQuality = async () => {
    const movements: QualityMovementInput[] = [];
    let hasRework = false;
    for (const item of items) {
      const pending = Math.max(
        quantity(item.quantidade)
          - quantity(item.quantidade_aprovada)
          - quantity(item.quantidade_retida)
          - quantity(item.quantidade_retrabalho),
        0,
      );
      const draft = qualityDraft[item.id];
      if (!draft) continue;
      const entries = [
        ["APROVADO", quantity(draft.approved)],
        ["RETIDO", quantity(draft.retained)],
        ["RETRABALHO", quantity(draft.rework)],
      ] as const;
      const classified = entries.reduce((sum, [, value]) => sum + value, 0);
      if (classified > pending + 0.0005) {
        toast.error(`A classificação de ${item.produto?.nome || "um item"} excede a quantidade pendente.`);
        return;
      }
      for (const [result, value] of entries) {
        if (value <= 0) continue;
        if (result !== "APROVADO" && draft.reason.trim().length < 3) {
          toast.error(`Informe o motivo de retenção/retrabalho de ${item.produto?.nome || "um item"}.`);
          return;
        }
        if (result === "RETRABALHO") hasRework = true;
        movements.push({
          item_id: item.id,
          origem: "PENDENTE",
          resultado: result,
          quantidade: value,
          motivo: result === "APROVADO" ? undefined : draft.reason.trim(),
        });
      }
    }
    if (movements.length === 0) {
      toast.error("Informe ao menos um resultado de qualidade.");
      return;
    }
    if (hasRework && !newForecast) {
      toast.error("Defina a nova previsão dos itens em retrabalho.");
      return;
    }
    await registerQuality.mutateAsync({
      movements,
      newForecast: newForecast || undefined,
      idempotencyKey: qualityKey,
    });
    setQualityOpen(false);
  };

  const submitDelivery = async () => {
    try {
      const selectedItems = items.flatMap((item) => {
        const selected = quantity(deliveryDraft[item.id]);
        const available = Math.max(quantity(item.quantidade_aprovada) - quantity(item.quantidade_entregue), 0);
        if (selected > available + 0.0005) {
          throw new Error(`A entrega de ${item.produto?.nome || "um item"} excede o disponível.`);
        }
        return selected > 0 ? [{ item_id: item.id, quantidade: selected }] : [];
      });
      if (!receiverName.trim()) {
        toast.error("Informe quem recebeu.");
        return;
      }
      if (selectedItems.length === 0) {
        toast.error("Selecione ao menos um item aprovado para entrega.");
        return;
      }
      const hasBalance = paymentStatus !== "pago" && paymentCondition !== "faturado";
      if (hasBalance && !authorizeWithBalance) {
        toast.error("O pedido tem saldo. Marque a liberação administrativa ou receba antes da entrega.");
        return;
      }
      if (hasBalance && balanceReason.trim().length < 10) {
        toast.error("Explique a liberação com saldo em pelo menos 10 caracteres.");
        return;
      }
      await registerDelivery.mutateAsync({
        items: selectedItems,
        receiverName,
        receiverDocument,
        notes: deliveryNotes,
        authorizeWithBalance: hasBalance && authorizeWithBalance,
        balanceAuthorizationReason: hasBalance ? balanceReason : undefined,
        idempotencyKey: deliveryKey,
      });
      setDeliveryOpen(false);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("A entrega de")) toast.error(error.message);
    }
  };

  const submitResolution = async () => {
    const movements: QualityMovementInput[] = [];
    let hasRework = false;
    for (const draft of Object.values(resolutionDraft)) {
      const item = items.find((candidate) => candidate.id === draft.itemId);
      const available = draft.origin === "RETIDO"
        ? quantity(item?.quantidade_retida)
        : quantity(item?.quantidade_retrabalho);
      const selected = quantity(draft.quantity);
      if (selected <= 0) continue;
      if (selected > available + 0.0005) {
        toast.error(`A correção de ${item?.produto?.nome || "um item"} excede a quantidade disponível.`);
        return;
      }
      if (draft.result === draft.origin) {
        toast.error("Escolha um destino diferente da situação atual.");
        return;
      }
      if (draft.result !== "APROVADO" && draft.reason.trim().length < 3) {
        toast.error(`Informe o motivo da nova situação de ${item?.produto?.nome || "um item"}.`);
        return;
      }
      if (draft.result === "RETRABALHO") hasRework = true;
      movements.push({
        item_id: draft.itemId,
        origem: draft.origin,
        resultado: draft.result,
        quantidade: selected,
        motivo: draft.result === "APROVADO" ? undefined : draft.reason.trim(),
      });
    }
    if (movements.length === 0) {
      toast.error("Informe ao menos uma correção de qualidade.");
      return;
    }
    if (hasRework && !newForecast) {
      toast.error("Defina a nova previsão dos itens enviados a retrabalho.");
      return;
    }
    await registerQuality.mutateAsync({
      movements,
      newForecast: newForecast || undefined,
      idempotencyKey: qualityKey,
    });
    setResolutionOpen(false);
  };

  const hasFinancialBalance = paymentStatus !== "pago" && paymentCondition !== "faturado";

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" /> Qualidade e entrega por item
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Itens retidos continuam visíveis e não impedem entregar o que já foi aprovado.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={openQuality} disabled={totals.pendingQuality <= 0}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Classificar pendentes
          </Button>
          <Button variant="outline" size="sm" onClick={openResolution} disabled={totals.retained + totals.rework <= 0}>
            <ClipboardCheck className="mr-2 h-4 w-4" /> Tratar pendências
          </Button>
          <Button size="sm" onClick={openDelivery} disabled={totals.availableDelivery <= 0}>
            <Truck className="mr-2 h-4 w-4" /> Registrar entrega
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Total", totals.total],
            ["Aguardando qualidade", totals.pendingQuality],
            ["Aprovado", totals.approved],
            ["Retido", totals.retained],
            ["Retrabalho", totals.rework],
            ["Entregue", totals.delivered],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{Number(value).toLocaleString("pt-BR")}</p>
            </div>
          ))}
        </div>

        {(totals.retained > 0 || totals.rework > 0) && (
          <Alert className="border-warning/30 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription>
              {formatQuantity(totals.retained + totals.rework)} ainda {totals.retained + totals.rework === 1 ? "está" : "estão"} sob responsabilidade da lavanderia.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          {items.map((item) => {
            const approved = quantity(item.quantidade_aprovada);
            const retained = quantity(item.quantidade_retida);
            const rework = quantity(item.quantidade_retrabalho);
            const delivered = quantity(item.quantidade_entregue);
            const pending = Math.max(quantity(item.quantidade) - approved - retained - rework, 0);
            return (
              <div key={item.id} className="rounded-lg border p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium">{item.produto?.nome || "Item"}</p>
                  <p className="text-xs text-muted-foreground">{formatQuantity(quantity(item.quantidade), item.produto?.unidade)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-0 sm:justify-end">
                  {pending > 0 && <Badge variant="secondary">{formatQuantity(pending)} pendente</Badge>}
                  {approved > 0 && <Badge className="bg-success/10 text-success hover:bg-success/10">{formatQuantity(approved)} aprovado</Badge>}
                  {retained > 0 && <Badge className="bg-warning/10 text-warning hover:bg-warning/10">{formatQuantity(retained)} retido</Badge>}
                  {rework > 0 && <Badge className="bg-info/10 text-info hover:bg-info/10">{formatQuantity(rework)} retrabalho</Badge>}
                  {delivered > 0 && <Badge variant="outline">{formatQuantity(delivered)} entregue</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {(qualityHistory.data?.length || deliveries.data?.length) ? (
          <>
            <Separator />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Últimos registros de qualidade</h4>
                {qualityHistory.data?.slice(0, 4).map((record) => (
                  <div key={record.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{record.item?.produto?.nome || "Item"}</span>
                      <Badge variant="outline">{record.resultado.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatQuantity(quantity(record.quantidade), record.item?.produto?.unidade)} · {format(new Date(record.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    {record.motivo && <p className="mt-1 text-xs">{record.motivo}</p>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Comprovantes de entrega</h4>
                {deliveries.data?.slice(0, 4).map((delivery) => (
                  <div key={delivery.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{delivery.nome_recebedor}</span>
                      <Badge variant="outline">{delivery.itens?.reduce((sum, item) => sum + quantity(item.quantidade), 0) || 0} itens</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {delivery.autorizada_com_saldo ? " · liberada com saldo" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>

      <Dialog open={qualityOpen} onOpenChange={setQualityOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar resultado de qualidade</DialogTitle>
            <DialogDescription>
              Distribua somente a quantidade ainda pendente. Retenção e retrabalho exigem motivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {items.map((item) => {
              const pending = Math.max(
                quantity(item.quantidade)
                  - quantity(item.quantidade_aprovada)
                  - quantity(item.quantidade_retida)
                  - quantity(item.quantidade_retrabalho),
                0,
              );
              if (pending <= 0) return null;
              const draft = qualityDraft[item.id] || { approved: "", retained: "", rework: "", reason: "" };
              return (
                <div key={item.id} className="space-y-3 rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.produto?.nome || "Item"}</p>
                      <p className="text-xs text-muted-foreground">Pendente: {formatQuantity(pending, item.produto?.unidade)}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["approved", "Aprovado"],
                      ["retained", "Retido"],
                      ["rework", "Retrabalho"],
                    ].map(([field, label]) => (
                      <div key={field} className="space-y-1.5">
                        <Label htmlFor={`${item.id}-${field}`}>{label}</Label>
                        <Input
                          id={`${item.id}-${field}`}
                          type="number"
                          min="0"
                          max={pending}
                          step="0.001"
                          value={draft[field as keyof QualityDraft]}
                          onChange={(event) => setQualityDraft((current) => ({
                            ...current,
                            [item.id]: { ...draft, [field]: event.target.value },
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                  {(quantity(draft.retained) > 0 || quantity(draft.rework) > 0) && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${item.id}-reason`}>Motivo *</Label>
                      <Input
                        id={`${item.id}-reason`}
                        value={draft.reason}
                        onChange={(event) => setQualityDraft((current) => ({
                          ...current,
                          [item.id]: { ...draft, reason: event.target.value },
                        }))}
                        placeholder="Ex.: mancha persistente, costura sensível..."
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="space-y-1.5">
              <Label htmlFor="quality-forecast">Nova previsão quando houver retrabalho</Label>
              <Input id="quality-forecast" type="date" value={newForecast} onChange={(event) => setNewForecast(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQualityOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitQuality()} disabled={registerQuality.isPending}>
              {registerQuality.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar qualidade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolutionOpen} onOpenChange={setResolutionOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tratar itens retidos ou em retrabalho</DialogTitle>
            <DialogDescription>
              Mova somente a quantidade tratada. O histórico anterior permanece preservado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {Object.entries(resolutionDraft).map(([key, draft]) => {
              const item = items.find((candidate) => candidate.id === draft.itemId);
              const available = draft.origin === "RETIDO"
                ? quantity(item?.quantidade_retida)
                : quantity(item?.quantidade_retrabalho);
              return (
                <div key={key} className="space-y-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{item?.produto?.nome || "Item"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuantity(available, item?.produto?.unidade)} em {draft.origin === "RETIDO" ? "retenção" : "retrabalho"}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${key}-resolution-result`}>Nova situação</Label>
                      <Select
                        value={draft.result}
                        onValueChange={(value: ResolutionDraft["result"]) => setResolutionDraft((current) => ({
                          ...current,
                          [key]: { ...draft, result: value },
                        }))}
                      >
                        <SelectTrigger id={`${key}-resolution-result`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APROVADO">Aprovado</SelectItem>
                          {draft.origin !== "RETIDO" && <SelectItem value="RETIDO">Retido</SelectItem>}
                          {draft.origin !== "RETRABALHO" && <SelectItem value="RETRABALHO">Retrabalho</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${key}-resolution-quantity`}>Quantidade tratada</Label>
                      <Input
                        id={`${key}-resolution-quantity`}
                        type="number"
                        min="0"
                        max={available}
                        step="0.001"
                        value={draft.quantity}
                        onChange={(event) => setResolutionDraft((current) => ({
                          ...current,
                          [key]: { ...draft, quantity: event.target.value },
                        }))}
                      />
                    </div>
                  </div>
                  {draft.result !== "APROVADO" && (
                    <div className="space-y-1.5">
                      <Label htmlFor={`${key}-resolution-reason`}>Motivo *</Label>
                      <Input
                        id={`${key}-resolution-reason`}
                        value={draft.reason}
                        onChange={(event) => setResolutionDraft((current) => ({
                          ...current,
                          [key]: { ...draft, reason: event.target.value },
                        }))}
                        placeholder="Descreva a correção ou a permanência da pendência"
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="space-y-1.5">
              <Label htmlFor="resolution-forecast">Nova previsão quando houver retrabalho</Label>
              <Input id="resolution-forecast" type="date" value={newForecast} onChange={(event) => setNewForecast(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolutionOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitResolution()} disabled={registerQuality.isPending}>
              {registerQuality.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar tratamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deliveryOpen} onOpenChange={setDeliveryOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar entrega dos itens aprovados</DialogTitle>
            <DialogDescription>
              Informe somente o que saiu agora. O restante continuará no pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {items.map((item) => {
              const available = Math.max(quantity(item.quantidade_aprovada) - quantity(item.quantidade_entregue), 0);
              if (available <= 0) return null;
              return (
                <div key={item.id} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_160px]">
                  <div>
                    <p className="text-sm font-medium">{item.produto?.nome || "Item"}</p>
                    <p className="text-xs text-muted-foreground">Disponível: {formatQuantity(available, item.produto?.unidade)}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${item.id}-delivery`}>Entregar agora</Label>
                    <Input
                      id={`${item.id}-delivery`}
                      type="number"
                      min="0"
                      max={available}
                      step="0.001"
                      value={deliveryDraft[item.id] || ""}
                      onChange={(event) => setDeliveryDraft((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </div>
                </div>
              );
            })}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="receiver-name">Quem recebeu *</Label>
                <Input id="receiver-name" value={receiverName} onChange={(event) => setReceiverName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receiver-document">Documento</Label>
                <Input id="receiver-document" value={receiverDocument} onChange={(event) => setReceiverDocument(event.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delivery-notes">Observações</Label>
              <Textarea id="delivery-notes" value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} />
            </div>
            {hasFinancialBalance && (
              <Alert className="border-warning/30 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="space-y-3">
                  <p>Este pedido ainda tem saldo. A liberação exige perfil administrativo e fica auditada.</p>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox checked={authorizeWithBalance} onCheckedChange={(checked) => setAuthorizeWithBalance(checked === true)} />
                    Autorizar entrega parcial com saldo
                  </label>
                  {authorizeWithBalance && (
                    <Textarea
                      value={balanceReason}
                      onChange={(event) => setBalanceReason(event.target.value)}
                      placeholder="Motivo da autorização (mínimo 10 caracteres)"
                    />
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitDelivery()} disabled={registerDelivery.isPending}>
              {registerDelivery.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
