import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  History,
  Layers3,
  Loader2,
  PackageCheck,
  Search,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OrdemServico } from "@/hooks/useOrdensServico";
import type { HistoricoProducao } from "@/hooks/useHistoricoProducao";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { useProductionOperations } from "@/hooks/useProductionOperations";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  canBatchProductionStage,
  getNextProductionStage,
  productionStageLabels,
  PRODUCTION_STAGE_SEQUENCE,
  requiresProductionResource,
  type ProductionStage,
} from "@/lib/productionWorkflow";
import { cn } from "@/lib/utils";

const priorityWeight: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

function isOverdue(order: OrdemServico) {
  return Boolean(
    order.data_previsao_entrega
      && isBefore(parseISO(order.data_previsao_entrega), startOfDay(new Date())),
  );
}

function stageTone(stage: string) {
  if (stage === "expedicao") return "bg-success/10 text-success border-success/20";
  if (stage === "embalagem") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  if (stage === "lavagem" || stage === "secagem") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
}

interface ProductionQueueWorkspaceProps {
  orders: OrdemServico[];
  isLoading: boolean;
  onAdvance: (order: OrdemServico, nextStage: string) => void;
}

export function ProductionQueueWorkspace({
  orders,
  isLoading,
  onAdvance,
}: ProductionQueueWorkspaceProps) {
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dialogMode, setDialogMode] = useState<"advance" | "incident" | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [resource, setResource] = useState("");
  const [occurrence, setOccurrence] = useState("");
  const [newForecast, setNewForecast] = useState("");
  const [commandKey, setCommandKey] = useState("");
  const { data: employees = [] } = useFuncionarios();
  const { operations, processQueue, registerOccurrence } = useProductionOperations();

  const activeOrders = useMemo(
    () => orders.filter((order) => !["entregue", "cancelada", "expedicao"].includes(order.status)),
    [orders],
  );

  useEffect(() => {
    const availableIds = new Set(activeOrders.map((order) => order.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [activeOrders]);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("pt-BR");
    return activeOrders
      .filter((order) => stageFilter === "all" || order.status === stageFilter)
      .filter((order) => !normalized
        || order.numero.toLocaleLowerCase("pt-BR").includes(normalized)
        || order.cliente?.razao_social?.toLocaleLowerCase("pt-BR").includes(normalized))
      .sort((left, right) => {
        const overdueDelta = Number(isOverdue(right)) - Number(isOverdue(left));
        if (overdueDelta) return overdueDelta;
        const dateDelta = (left.data_previsao_entrega || "9999-12-31")
          .localeCompare(right.data_previsao_entrega || "9999-12-31");
        if (dateDelta) return dateDelta;
        return (priorityWeight[left.prioridade] ?? 9) - (priorityWeight[right.prioridade] ?? 9);
      });
  }, [activeOrders, search, stageFilter]);

  const selectedOrders = useMemo(
    () => activeOrders.filter((order) => selectedIds.includes(order.id)),
    [activeOrders, selectedIds],
  );
  const selectedStages = new Set(selectedOrders.map((order) => order.status));
  const selectedStage = selectedStages.size === 1 ? selectedOrders[0]?.status : null;
  const nextStage = selectedStage ? getNextProductionStage(selectedStage) : null;
  const batchAllowed = Boolean(
    selectedStage
      && nextStage
      && selectedOrders.length > 1
      && canBatchProductionStage(selectedStage),
  );
  const occurrenceAllowed = Boolean(selectedStage && selectedOrders.length > 0);
  const activeEmployees = employees.filter((employee) => employee.ativo);

  const overdueCount = activeOrders.filter(isOverdue).length;
  const qualityPendingCount = activeOrders.filter((order) =>
    order.status === "embalagem" && order.status_qualidade !== "aprovada").length;
  const dueSoonCount = activeOrders.filter((order) => {
    if (!order.data_previsao_entrega || isOverdue(order)) return false;
    const delta = parseISO(order.data_previsao_entrega).getTime() - startOfDay(new Date()).getTime();
    return delta <= 2 * 24 * 60 * 60 * 1000;
  }).length;

  const toggleOrder = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked
      ? [...new Set([...current, id])]
      : current.filter((selectedId) => selectedId !== id));
  };

  const openCommand = (mode: "advance" | "incident") => {
    setDialogMode(mode);
    setEmployeeId("");
    setResource("");
    setOccurrence("");
    setNewForecast("");
    setCommandKey(createIdempotencyKey(mode === "advance" ? "production-batch" : "production-incident"));
  };

  const closeCommand = () => {
    if (processQueue.isPending || registerOccurrence.isPending) return;
    setDialogMode(null);
    setCommandKey("");
  };

  const submitCommand = async () => {
    if (!selectedStage) return;
    if (dialogMode === "advance" && nextStage) {
      await processQueue.mutateAsync({
        orders: selectedOrders.map((order) => ({
          id: order.id,
          dadosFormulario: {
            recurso: resource,
            maquina_utilizada: resource,
            operacao_em_lote: true,
          },
        })),
        expectedStage: selectedStage,
        nextStage,
        employeeId,
        resource,
        occurrence,
        newForecast,
        idempotencyKey: commandKey,
      });
    } else if (dialogMode === "incident") {
      await registerOccurrence.mutateAsync({
        orderIds: selectedIds,
        expectedStage: selectedStage,
        employeeId,
        occurrence,
        newForecast,
        idempotencyKey: commandKey,
      });
    }
    setSelectedIds([]);
    closeCommand();
  };

  const isCommandPending = processQueue.isPending || registerOccurrence.isPending;
  const requiresResource = Boolean(selectedStage && requiresProductionResource(selectedStage));
  const canSubmit = dialogMode === "advance"
    ? batchAllowed && (!requiresResource || resource.trim().length >= 2)
    : occurrenceAllowed && occurrence.trim().length >= 3;

  return (
    <div className="space-y-4" data-testid="production-queue-workspace">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          icon={TriangleAlert}
          label="Prazo vencido"
          value={overdueCount}
          tone={overdueCount ? "danger" : "neutral"}
        />
        <MetricCard icon={CalendarClock} label="Vencem em até 2 dias" value={dueSoonCount} tone="warning" />
        <MetricCard icon={ClipboardCheck} label="Qualidade pendente" value={qualityPendingCount} tone="info" />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar OS ou cliente"
              className="h-10 pl-9"
              aria-label="Buscar na fila de produção"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-10 w-full lg:w-[220px]" aria-label="Filtrar etapa">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {PRODUCTION_STAGE_SEQUENCE.filter((stage) => stage !== "expedicao").map((stage) => (
                <SelectItem key={stage} value={stage}>{productionStageLabels[stage]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="min-h-10 flex-1 gap-2 lg:flex-none"
              disabled={!occurrenceAllowed}
              onClick={() => openCommand("incident")}
            >
              <AlertTriangle className="h-4 w-4" /> Ocorrência
            </Button>
            <Button
              className="min-h-10 flex-1 gap-2 lg:flex-none"
              disabled={!batchAllowed}
              onClick={() => openCommand("advance")}
              data-testid="production-batch-action"
            >
              <Layers3 className="h-4 w-4" /> Avançar lote
            </Button>
          </div>
        </div>

        {selectedOrders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary/[0.04] px-4 py-2 text-sm">
            <Badge>{selectedOrders.length} selecionada{selectedOrders.length > 1 ? "s" : ""}</Badge>
            <span className="text-muted-foreground">
              {selectedStage
                ? productionStageLabels[selectedStage as ProductionStage]
                : "Selecione ordens da mesma etapa"}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds([])}>
              Limpar seleção
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando fila...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <CheckCircle2 className="h-9 w-9 text-success" />
            <p className="font-medium">Nenhuma ordem nesta fila</p>
            <p className="text-sm text-muted-foreground">Altere os filtros ou confira a expedição.</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredOrders.map((order) => {
              const next = getNextProductionStage(order.status);
              const overdue = isOverdue(order);
              const selected = selectedIds.includes(order.id);
              const qualityBlocksExpedition = order.status === "embalagem"
                && order.status_qualidade !== "aprovada";
              return (
                <div
                  key={order.id}
                  className={cn(
                    "grid gap-3 p-4 transition-colors md:grid-cols-[auto_minmax(0,1.3fr)_minmax(130px,.7fr)_minmax(130px,.7fr)_auto] md:items-center",
                    selected && "bg-primary/[0.04]",
                  )}
                  data-testid="production-queue-row"
                >
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => toggleOrder(order.id, checked === true)}
                    aria-label={`Selecionar ${order.numero}`}
                    className="mt-1 md:mt-0"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.numero}</span>
                      <Badge variant="outline" className={cn("font-normal", stageTone(order.status))}>
                        {productionStageLabels[order.status as ProductionStage] || order.status}
                      </Badge>
                      {overdue && <Badge variant="destructive">Atrasada</Badge>}
                    </div>
                    <p className="mt-1 truncate font-semibold">{order.cliente?.razao_social || "Cliente não definido"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prazo</p>
                    <p className={cn("mt-1 text-sm", overdue && "font-semibold text-destructive")}>
                      {order.data_previsao_entrega
                        ? format(parseISO(order.data_previsao_entrega), "dd MMM yyyy", { locale: ptBR })
                        : "Sem previsão"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Controle</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="capitalize">{order.prioridade || "normal"}</Badge>
                      {order.status === "embalagem" && (
                        <Badge variant={order.status_qualidade === "aprovada" ? "default" : "outline"}>
                          {order.status_qualidade === "aprovada" ? "Qualidade OK" : "Qualidade pendente"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-10 w-full gap-2 md:w-auto"
                    disabled={!next || qualityBlocksExpedition}
                    onClick={() => next && onAdvance(order, next)}
                  >
                    {qualityBlocksExpedition ? "Aguardando qualidade" : "Registrar etapa"}
                    {!qualityBlocksExpedition && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Últimas operações</h3>
          <Badge variant="secondary" className="ml-auto">auditável</Badge>
        </div>
        {operations.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando histórico...</p>
        ) : !operations.data?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma operação registrada.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {operations.data.slice(0, 6).map((operation) => (
              <div key={operation.id} className="rounded-xl border bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {operation.tipo === "OCORRENCIA" ? "Ocorrência" : operation.lote?.numero_lote || "Avanço individual"}
                  </span>
                  <Badge variant="outline">{operation.ordens_servico_ids.length} OS</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {productionStageLabels[operation.etapa_anterior as ProductionStage] || operation.etapa_anterior}
                  {operation.etapa_nova ? ` → ${productionStageLabels[operation.etapa_nova as ProductionStage] || operation.etapa_nova}` : ""}
                </p>
                {operation.ocorrencia && <p className="mt-2 line-clamp-2 text-xs">{operation.ocorrencia}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {format(parseISO(operation.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  {operation.funcionario?.nome ? ` · ${operation.funcionario.nome}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeCommand()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogMode === "advance" ? "Avançar lote de produção" : "Registrar ocorrência"}</DialogTitle>
            <DialogDescription>
              {selectedOrders.length} OS em {selectedStage
                ? productionStageLabels[selectedStage as ProductionStage]
                : "etapas diferentes"}.
              {dialogMode === "advance" && nextStage
                ? ` Todas avançam para ${productionStageLabels[nextStage]} ou nenhuma será alterada.`
                : " A ocorrência ficará na trilha de cada ordem."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employee.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dialogMode === "advance" && requiresResource && (
              <div className="space-y-2">
                <Label htmlFor="production-resource">Máquina ou recurso *</Label>
                <Input
                  id="production-resource"
                  value={resource}
                  onChange={(event) => setResource(event.target.value)}
                  placeholder={selectedStage === "lavagem" ? "Ex.: Lavadora 02" : "Ex.: Secadora 01"}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="production-occurrence">
                {dialogMode === "incident" ? "Ocorrência *" : "Observação do lote"}
              </Label>
              <Textarea
                id="production-occurrence"
                value={occurrence}
                onChange={(event) => setOccurrence(event.target.value)}
                placeholder="Descreva desvios, retenções ou instruções para o próximo turno"
                rows={3}
                autoFocus={dialogMode === "incident"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="production-forecast">Nova previsão, se o prazo mudou</Label>
              <Input
                id="production-forecast"
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={newForecast}
                onChange={(event) => setNewForecast(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCommand} disabled={isCommandPending}>Cancelar</Button>
            <Button onClick={submitCommand} disabled={!canSubmit || isCommandPending}>
              {isCommandPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogMode === "advance" ? "Confirmar lote" : "Salvar ocorrência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExpeditionWorkspace({
  orders,
  histories,
  onAdvance,
}: {
  orders: OrdemServico[];
  histories: Record<string, HistoricoProducao[]>;
  onAdvance: (order: OrdemServico, nextStage: string) => void;
}) {
  const expeditionOrders = orders
    .filter((order) => order.status === "embalagem" || order.status === "expedicao")
    .sort((left, right) => (left.data_previsao_entrega || "9999-12-31").localeCompare(right.data_previsao_entrega || "9999-12-31"));
  const expeditionOrderIds = expeditionOrders.map((order) => order.id);
  const itemsQuery = useQuery({
    queryKey: ["production-expedition-items", expeditionOrderIds],
    enabled: expeditionOrderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_ordem_servico")
        .select("ordem_servico_id, quantidade, quantidade_aprovada, quantidade_retida, quantidade_retrabalho, quantidade_entregue")
        .in("ordem_servico_id", expeditionOrderIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4" data-testid="expedition-workspace">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/[0.08] via-card to-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><PackageCheck className="h-5 w-5" /></div>
          <div>
            <h3 className="font-semibold">Conferência de expedição</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Libere somente materiais com qualidade aprovada, volumes, embalagem e etiqueta conferidos.
            </p>
          </div>
        </div>
      </div>
      {expeditionOrders.length === 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-16 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-9 w-9 text-success" />
          <p className="mt-3 font-medium">Expedição sem pendências</p>
          <p className="mt-1 text-sm text-muted-foreground">Nenhuma OS aguarda conferência ou retirada.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {expeditionOrders.map((order) => {
            const latestPackaging = [...(histories[order.id] || [])]
              .reverse()
              .find((history) => history.etapa_anterior === "embalagem");
            const form = latestPackaging?.dados_formulario || {};
            const ready = order.status === "expedicao";
            const itemTotals = (itemsQuery.data || [])
              .filter((item) => item.ordem_servico_id === order.id)
              .reduce((totals, item) => ({
                total: totals.total + Number(item.quantidade || 0),
                available: totals.available
                  + Math.max(Number(item.quantidade_aprovada || 0) - Number(item.quantidade_entregue || 0), 0),
                pending: totals.pending
                  + Number(item.quantidade_retida || 0)
                  + Number(item.quantidade_retrabalho || 0),
              }), { total: 0, available: 0, pending: 0 });
            return (
              <article key={order.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-primary">{order.numero}</p>
                    <h3 className="mt-1 truncate font-semibold">{order.cliente?.razao_social || "Cliente não definido"}</h3>
                  </div>
                  <Badge className={ready ? "bg-success text-success-foreground" : ""} variant={ready ? "default" : "secondary"}>
                    {ready ? "Liberada" : "Conferência pendente"}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/30 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Qualidade</p>
                    <p className={cn("mt-1 font-medium", order.status_qualidade !== "aprovada" && "text-warning")}>
                      {order.status_qualidade === "aprovada" ? "Aprovada" : "Pendente"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volumes</p>
                    <p className="mt-1 font-medium">{String(form.quantidade_volumes || "A conferir")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Embalagem</p>
                    <p className="mt-1 font-medium capitalize">{String(form.tipo_embalagem || "A conferir")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Localização</p>
                    <p className="mt-1 font-medium">{String(form.localizacao_estoque || "Não informada")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Liberado para saída</p>
                    <p className="mt-1 font-medium">{itemTotals.available} de {itemTotals.total}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Retido / retrabalho</p>
                    <p className={cn("mt-1 font-medium", itemTotals.pending > 0 && "text-warning")}>
                      {itemTotals.pending}
                    </p>
                  </div>
                </div>
                <Button
                  className="mt-4 min-h-10 w-full gap-2"
                  variant={ready ? "outline" : "default"}
                  disabled={ready || order.status_qualidade !== "aprovada"}
                  onClick={() => onAdvance(order, "expedicao")}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  {ready
                    ? "Disponível para rota ou retirada"
                    : order.status_qualidade !== "aprovada"
                      ? "Aguardando aprovação da qualidade"
                      : "Conferir e liberar"}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Factory;
  label: string;
  value: number;
  tone: "danger" | "warning" | "info" | "neutral";
}) {
  const toneClass = {
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    info: "bg-primary/10 text-primary",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className={cn("rounded-xl p-2.5", toneClass)}><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
