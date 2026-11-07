import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Edit,
  Eye,
  FilterX,
  Loader2,
  Package,
  Play,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { FaturamentoModal, type DadosFaturamento } from "@/components/faturamento/FaturamentoModal";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { EditarLancamentoModal } from "@/components/faturamento/EditarLancamentoModal";
import { useDadosFaturamentoCompletos } from "@/hooks/useDadosFaturamento";
import { useItensLancamento, type Lancamento } from "@/hooks/useLancamentos";
import {
  type PendingRol,
  type PendingRolCycle,
  type PendingRolStage,
  useCancelPendingRol,
  useEditPendingRol,
  usePendingRolBillingSelection,
  usePendingRolQueue,
  useUpdatePendingRolStage,
} from "@/hooks/usePendingRolQueue";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

const stageConfig: Record<PendingRolStage, { label: string; className: string }> = {
  em_processo: { label: "Em processo", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  prateleira: { label: "Na prateleira", className: "border-warning/30 bg-warning/10 text-warning" },
  entregue: { label: "Entregue", className: "border-success/30 bg-success/10 text-success" },
};

const cycleConfig: Record<PendingRolCycle, {
  label: string;
  icon: typeof Calendar;
  headerClass: string;
  iconClass: string;
}> = {
  quinzenal: {
    label: "Fechamento quinzenal",
    icon: CalendarDays,
    headerClass: "border-info/25 bg-info/5",
    iconClass: "text-info",
  },
  mensal: {
    label: "Fechamento mensal",
    icon: Calendar,
    headerClass: "border-primary/25 bg-primary/5",
    iconClass: "text-primary",
  },
  outro: {
    label: "Avulso ou sem ciclo",
    icon: CalendarClock,
    headerClass: "border-border bg-muted/40",
    iconClass: "text-muted-foreground",
  },
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatCivilDate(value: string | null) {
  return value ? format(parseISO(value), "dd/MM/yyyy") : "—";
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function getStage(value: string | null | undefined): PendingRolStage {
  return value === "prateleira" || value === "entregue" ? value : "em_processo";
}

function readPositiveInteger(value: string | null, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function PendentesTab() {
  const { activeArea } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get("cliente") || undefined;
  const page = readPositiveInteger(searchParams.get("pend_pagina"));
  const cycleParam = searchParams.get("pend_ciclo");
  const stageParam = searchParams.get("pend_etapa");
  const cycle = cycleParam === "quinzenal" || cycleParam === "mensal" || cycleParam === "outro"
    ? cycleParam
    : undefined;
  const stage = stageParam === "em_processo" || stageParam === "prateleira" || stageParam === "entregue"
    ? stageParam
    : undefined;
  const startDate = searchParams.get("pend_inicio") || undefined;
  const endDate = searchParams.get("pend_fim") || undefined;
  const urlSearch = searchParams.get("pend_q") || "";
  const [search, setSearch] = useState(urlSearch);
  const [selectedById, setSelectedById] = useState<Record<string, PendingRol>>({});
  const [collapsedCycles, setCollapsedCycles] = useState<Record<PendingRolCycle, boolean>>({
    quinzenal: false,
    mensal: false,
    outro: false,
  });
  const [selectedLaunch, setSelectedLaunch] = useState<PendingRol | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingData, setBillingData] = useState<DadosFaturamento | null>(null);

  const updateUrl = useCallback((updates: Record<string, string | undefined>, resetPage = true) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      if (resetPage) next.delete("pend_pagina");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  useEffect(() => setSearch(urlSearch), [urlSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search.trim() !== urlSearch) updateUrl({ pend_q: search.trim() || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search, updateUrl, urlSearch]);

  const invalidPeriod = Boolean(startDate && endDate && startDate > endDate);
  const queue = usePendingRolQueue({
    page,
    pageSize: PAGE_SIZE,
    search: urlSearch || undefined,
    cycle,
    stage,
    clientId,
    startDate: invalidPeriod ? undefined : startDate,
    endDate: invalidPeriod ? undefined : endDate,
  });
  const rows = useMemo(() => queue.data?.items ?? [], [queue.data?.items]);
  const summary = queue.data?.summary;
  const totalPages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / PAGE_SIZE));

  useEffect(() => {
    if (!queue.isLoading && page > totalPages) updateUrl({ pend_pagina: String(totalPages) }, false);
  }, [page, queue.isLoading, totalPages, updateUrl]);

  const selectedIds = useMemo(() => Object.keys(selectedById), [selectedById]);
  const selectedRows = useMemo(() => Object.values(selectedById), [selectedById]);
  const selectedClient = selectedRows[0]?.cliente ?? null;
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.valor_total), 0);
  const selectedDetails = usePendingRolBillingSelection(selectedIds);
  const { data: selectedItems = [], isLoading: isLoadingItems } = useItensLancamento(selectedLaunch?.id ?? null);
  const updateStage = useUpdatePendingRolStage();
  const editLaunch = useEditPendingRol();
  const cancelLaunch = useCancelPendingRol();
  const { dados: completeCustomerData } = useDadosFaturamentoCompletos(selectedClient?.id ?? null);

  const rowsByCycle = useMemo(() => {
    const groups: Record<PendingRolCycle, Record<string, PendingRol[]>> = {
      quinzenal: {},
      mensal: {},
      outro: {},
    };
    rows.forEach((row) => {
      if (!groups[row.ciclo][row.cliente_id]) groups[row.ciclo][row.cliente_id] = [];
      groups[row.ciclo][row.cliente_id].push(row);
    });
    return groups;
  }, [rows]);

  const toggleRow = (row: PendingRol) => {
    setSelectedById((current) => {
      if (current[row.id]) {
        const next = { ...current };
        delete next[row.id];
        return next;
      }
      const currentClientId = Object.values(current)[0]?.cliente_id;
      if (currentClientId && currentClientId !== row.cliente_id) {
        toast.error("Selecione ROLs de um único cliente para gerar a fatura.");
        return current;
      }
      if (Object.keys(current).length >= 100) {
        toast.error("Selecione no máximo 100 ROLs por faturamento.");
        return current;
      }
      return { ...current, [row.id]: row };
    });
  };

  const toggleCustomerRows = (customerRows: PendingRol[]) => {
    const allSelected = customerRows.every((row) => selectedById[row.id]);
    if (allSelected) {
      setSelectedById((current) => {
        const next = { ...current };
        customerRows.forEach((row) => delete next[row.id]);
        return next;
      });
      return;
    }
    const currentClientId = selectedRows[0]?.cliente_id;
    if (currentClientId && currentClientId !== customerRows[0]?.cliente_id) {
      toast.error("Limpe a seleção atual antes de escolher outro cliente.");
      return;
    }
    setSelectedById((current) => {
      const next = { ...current };
      customerRows.slice(0, Math.max(0, 100 - Object.keys(current).length)).forEach((row) => {
        next[row.id] = row;
      });
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    updateUrl({
      pend_q: undefined,
      pend_ciclo: undefined,
      pend_etapa: undefined,
      pend_inicio: undefined,
      pend_fim: undefined,
      cliente: undefined,
    });
  };

  const handleStageChange = async (row: PendingRol, nextStage: PendingRolStage) => {
    if (getStage(row.etapa) === nextStage) return;
    try {
      await updateStage.mutateAsync({
        launchId: row.id,
        observedUpdatedAt: row.updated_at,
        stage: nextStage,
      });
      setSelectedById((current) => {
        if (!current[row.id]) return current;
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      toast.success(`Etapa atualizada para ${stageConfig[nextStage].label}.`);
    } catch (error) {
      toast.error(messageFromError(error));
    }
  };

  const handleSave = async (launch: Lancamento, data: {
    observacao: string | null;
    data_lancamento: string;
    data_entrega: string | null;
    itens: Parameters<typeof editLaunch.mutateAsync>[0]["items"];
  }) => {
    try {
      await editLaunch.mutateAsync({
        launch,
        date: data.data_lancamento,
        deliveryDate: data.data_entrega,
        note: data.observacao,
        items: data.itens,
      });
      setSelectedById((current) => {
        const next = { ...current };
        delete next[launch.id];
        return next;
      });
      toast.success("ROL atualizado com segurança.");
    } catch (error) {
      toast.error(messageFromError(error));
      throw error;
    }
  };

  const handleCancel = async () => {
    if (!selectedLaunch || selectedLaunch.ordem_servico_id || cancelReason.trim().length < 5) return;
    try {
      await cancelLaunch.mutateAsync({ launch: selectedLaunch, reason: cancelReason });
      setSelectedById((current) => {
        const next = { ...current };
        delete next[selectedLaunch.id];
        return next;
      });
      setCancelOpen(false);
      setCancelReason("");
      setSelectedLaunch(null);
      toast.success("ROL cancelado. O histórico e os itens foram preservados.");
    } catch (error) {
      toast.error(messageFromError(error));
    }
  };

  const computedBillingData = useMemo<DadosFaturamento | null>(() => {
    const launches = selectedDetails.data;
    if (!selectedClient || !launches || launches.length !== selectedIds.length || launches.length === 0) return null;
    const allItems = launches.flatMap((launch) => (launch.itens ?? []).map((item) => ({
      id: item.id,
      produto: item.produto_nome,
      quantidade: Number(item.quantidade),
      unidade: item.unidade,
      valorUnitario: Number(item.preco_unitario),
      valorTotal: Number(item.subtotal),
    })));
    const dates = launches.map((launch) => parseISO(launch.data_lancamento).getTime());
    const customer = completeCustomerData.cliente;
    return {
      clienteId: selectedClient.id,
      clienteNome: selectedClient.razao_social,
      clienteDocumento: selectedClient.cpf_cnpj || "",
      clienteEmail: customer?.email || selectedClient.email || null,
      clienteTelefone: customer?.telefone || selectedClient.telefone || null,
      clienteTipoPessoa: customer?.tipo_pessoa || "cnpj",
      clienteInscricaoMunicipal: customer?.inscricao_municipal || null,
      clienteInscricaoEstadual: customer?.inscricao_estadual || null,
      clienteRegimeTributario: customer?.regime_tributario || null,
      clienteClassificacao: selectedClient.classificacao,
      clienteEndereco: completeCustomerData.endereco || null,
      configPagamento: completeCustomerData.configPagamento || null,
      configCliente: completeCustomerData.configCliente || null,
      itens: allItems,
      valorTotal: selectedTotal,
      periodoInicio: format(new Date(Math.min(...dates)), "yyyy-MM-dd"),
      periodoFim: format(new Date(Math.max(...dates)), "yyyy-MM-dd"),
      lancamentoIds: selectedIds,
    };
  }, [completeCustomerData, selectedClient, selectedDetails.data, selectedIds, selectedTotal]);

  const openBilling = () => {
    if (selectedIds.length === 0) return;
    if (selectedDetails.isError) {
      toast.error(messageFromError(selectedDetails.error));
      return;
    }
    if (!computedBillingData || computedBillingData.itens.length === 0) {
      toast.error("Aguarde a conferência dos itens selecionados.");
      return;
    }
    setBillingData(computedBillingData);
    setBillingOpen(true);
  };

  const hasFilters = Boolean(urlSearch || cycle || stage || startDate || endDate || clientId);

  const renderActions = (row: PendingRol) => (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => { setSelectedLaunch(row); setViewOpen(true); }} aria-label={`Ver itens de ${row.numero_rol || "ROL"}`}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-10 w-10" disabled={Boolean(row.ordem_servico_id)} onClick={() => { setSelectedLaunch(row); setEditOpen(true); }} aria-label={`Editar ${row.numero_rol || "ROL"}`} title={row.ordem_servico_id ? "Gerencie este ROL pelo PDV" : "Editar ROL"}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" disabled={Boolean(row.ordem_servico_id)} onClick={() => { setSelectedLaunch(row); setCancelReason(""); setCancelOpen(true); }} aria-label={`Cancelar ${row.numero_rol || "ROL"}`} title={row.ordem_servico_id ? "Cancele pelo PDV" : "Cancelar ROL"}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderCycle = (cycleKey: PendingRolCycle) => {
    const customers = Object.entries(rowsByCycle[cycleKey]);
    if (customers.length === 0) return null;
    const config = cycleConfig[cycleKey];
    const Icon = config.icon;
    const collapsed = collapsedCycles[cycleKey];
    const cycleRows = customers.flatMap(([, customerRows]) => customerRows);

    return (
      <Card key={cycleKey} className="overflow-hidden border-border/80 shadow-sm">
        <button type="button" onClick={() => setCollapsedCycles((current) => ({ ...current, [cycleKey]: !current[cycleKey] }))} className={cn("flex min-h-14 w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted/60", config.headerClass)} aria-expanded={!collapsed}>
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Icon className={cn("h-5 w-5", config.iconClass)} />
          <span className="font-semibold">{config.label}</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">{cycleRows.length} ROL{cycleRows.length === 1 ? "" : "s"}</Badge>
          <span className={cn("ml-auto font-bold tabular-nums", config.iconClass)}>{formatCurrency(cycleRows.reduce((sum, row) => sum + Number(row.valor_total), 0))}</span>
        </button>

        {!collapsed && (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12"><span className="sr-only">Selecionar</span></TableHead>
                    <TableHead>ROL</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-36 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map(([customerId, customerRows]) => {
                    const customer = customerRows[0]?.cliente;
                    const allSelected = customerRows.every((row) => selectedById[row.id]);
                    const someSelected = customerRows.some((row) => selectedById[row.id]);
                    return [
                      <TableRow key={`${customerId}-header`} className="bg-muted/20 hover:bg-muted/30">
                        <TableCell>
                          <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={() => toggleCustomerRows(customerRows)} aria-label={`Selecionar ROLs de ${customer?.razao_social || "cliente"}`} />
                        </TableCell>
                        <TableCell colSpan={7}>
                          <div className="flex items-center gap-2">
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{customer?.razao_social || "Cliente"}</span>
                            <span className="text-xs text-muted-foreground">{customerRows.length} nesta página</span>
                            <span className="ml-auto font-semibold text-primary">{formatCurrency(customerRows.reduce((sum, row) => sum + Number(row.valor_total), 0))}</span>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...customerRows.map((row) => {
                        const rowStage = getStage(row.etapa);
                        return (
                          <TableRow key={row.id} className={selectedById[row.id] ? "bg-primary/5" : undefined}>
                            <TableCell className="pl-6"><Checkbox checked={Boolean(selectedById[row.id])} onCheckedChange={() => toggleRow(row)} aria-label={`Selecionar ${row.numero_rol || "ROL"}`} /></TableCell>
                            <TableCell><Badge variant="outline" className={cn("font-mono", stageConfig[rowStage].className)}>{row.numero_rol || "Sem número"}</Badge></TableCell>
                            <TableCell><p className="font-medium">{row.cliente?.nome_fantasia || row.cliente?.razao_social}</p>{row.ordem_servico_id && <p className="text-xs text-muted-foreground">Origem: PDV</p>}</TableCell>
                            <TableCell>{formatCivilDate(row.data_lancamento)}</TableCell>
                            <TableCell>{formatCivilDate(row.data_entrega)}</TableCell>
                            <TableCell>
                              <Select value={rowStage} onValueChange={(value) => void handleStageChange(row, value as PendingRolStage)} disabled={updateStage.isPending}>
                                <SelectTrigger className="h-10 w-40" aria-label={`Etapa de ${row.numero_rol || "ROL"}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="em_processo">Em processo</SelectItem>
                                  <SelectItem value="prateleira">Na prateleira</SelectItem>
                                  <SelectItem value="entregue">Entregue</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(Number(row.valor_total))}</TableCell>
                            <TableCell>{renderActions(row)}</TableCell>
                          </TableRow>
                        );
                      }),
                    ];
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y lg:hidden">
              {customers.map(([customerId, customerRows]) => {
                const customer = customerRows[0]?.cliente;
                const allSelected = customerRows.every((row) => selectedById[row.id]);
                const someSelected = customerRows.some((row) => selectedById[row.id]);
                return (
                  <section key={customerId} className="p-3 sm:p-4">
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-muted/40 p-3">
                      <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={() => toggleCustomerRows(customerRows)} aria-label={`Selecionar ROLs de ${customer?.razao_social || "cliente"}`} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{customer?.razao_social || "Cliente"}</p>
                        <p className="text-xs text-muted-foreground">{customerRows.length} ROL{customerRows.length === 1 ? "" : "s"} nesta página</p>
                      </div>
                      <span className="ml-auto whitespace-nowrap font-bold text-primary">{formatCurrency(customerRows.reduce((sum, row) => sum + Number(row.valor_total), 0))}</span>
                    </div>
                    <div className="space-y-3">
                      {customerRows.map((row) => {
                        const rowStage = getStage(row.etapa);
                        return (
                          <article key={row.id} className={cn("rounded-xl border bg-card p-4 shadow-sm", selectedById[row.id] && "border-primary/40 bg-primary/5")}>
                            <div className="flex items-start gap-3">
                              <Checkbox checked={Boolean(selectedById[row.id])} onCheckedChange={() => toggleRow(row)} aria-label={`Selecionar ${row.numero_rol || "ROL"}`} className="mt-1" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Badge variant="outline" className={cn("font-mono", stageConfig[rowStage].className)}>{row.numero_rol || "Sem número"}</Badge>
                                  <span className="text-lg font-bold tabular-nums">{formatCurrency(Number(row.valor_total))}</span>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                  <div><dt className="text-muted-foreground">Entrada</dt><dd className="font-medium">{formatCivilDate(row.data_lancamento)}</dd></div>
                                  <div><dt className="text-muted-foreground">Entrega</dt><dd className="font-medium">{formatCivilDate(row.data_entrega)}</dd></div>
                                </dl>
                                <div className="mt-4">
                                  <Label htmlFor={`stage-${row.id}`} className="text-xs text-muted-foreground">Etapa operacional</Label>
                                  <Select value={rowStage} onValueChange={(value) => void handleStageChange(row, value as PendingRolStage)} disabled={updateStage.isPending}>
                                    <SelectTrigger id={`stage-${row.id}`} className="mt-1.5 min-h-11 w-full" aria-label={`Etapa de ${row.numero_rol || "ROL"}`}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="em_processo">Em processo</SelectItem>
                                      <SelectItem value="prateleira">Na prateleira</SelectItem>
                                      <SelectItem value="entregue">Entregue</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t pt-2">
                                  <span className="text-xs text-muted-foreground">{row.ordem_servico_id ? "Gerado pelo PDV" : "Lançamento manual"}</span>
                                  {renderActions(row)}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Package className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">ROLs pendentes</p><p className="text-2xl font-bold tabular-nums">{integerFormatter.format(summary?.quantidade ?? 0)}</p></div></div></Card>
        <Card className="p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-info/10 p-2 text-info"><UsersRound className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">Clientes na fila</p><p className="text-2xl font-bold tabular-nums">{integerFormatter.format(summary?.clientes ?? 0)}</p></div></div></Card>
        <Card className="p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-success/10 p-2 text-success"><CircleDollarSign className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">Valor a faturar</p><p className="text-xl font-bold tabular-nums">{formatCurrency(summary?.valor_total ?? 0)}</p></div></div></Card>
        <Card className="p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-warning/10 p-2 text-warning"><CalendarDays className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">Ciclos definidos</p><p className="text-sm font-semibold">{summary?.quinzenal ?? 0} quinzenais · {summary?.mensal ?? 0} mensais</p></div></div></Card>
      </div>

      <Card className="p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1fr)_12rem_12rem_10rem_10rem_auto] xl:items-end">
          <div>
            <Label htmlFor="pending-search">Buscar ROL ou cliente</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pending-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, nome, fantasia ou documento" className="min-h-11 pl-10 pr-10" />
              {search && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" onClick={() => { setSearch(""); updateUrl({ pend_q: undefined }); }} aria-label="Limpar busca"><X className="h-4 w-4" /></Button>}
            </div>
          </div>
          <div>
            <Label htmlFor="pending-cycle">Ciclo</Label>
            <Select value={cycle ?? "todos"} onValueChange={(value) => updateUrl({ pend_ciclo: value === "todos" ? undefined : value })}>
              <SelectTrigger id="pending-cycle" className="mt-1.5 min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="quinzenal">Quinzenal</SelectItem><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="outro">Avulso / outro</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pending-stage">Etapa</Label>
            <Select value={stage ?? "todas"} onValueChange={(value) => updateUrl({ pend_etapa: value === "todas" ? undefined : value })}>
              <SelectTrigger id="pending-stage" className="mt-1.5 min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="em_processo">Em processo</SelectItem><SelectItem value="prateleira">Na prateleira</SelectItem><SelectItem value="entregue">Entregue</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="pending-start">De</Label><Input id="pending-start" type="date" value={startDate ?? ""} onChange={(event) => updateUrl({ pend_inicio: event.target.value || undefined })} className="mt-1.5 min-h-11" /></div>
          <div><Label htmlFor="pending-end">Até</Label><Input id="pending-end" type="date" value={endDate ?? ""} min={startDate} onChange={(event) => updateUrl({ pend_fim: event.target.value || undefined })} className="mt-1.5 min-h-11" /></div>
          {hasFilters && <Button variant="outline" onClick={clearFilters} className="min-h-11 gap-2"><FilterX className="h-4 w-4" /> Limpar</Button>}
        </div>
        {invalidPeriod && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />A data inicial precisa ser anterior ou igual à data final.</p>}
        {clientId && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm"><UserRound className="h-4 w-4 text-primary" /><span>Filtro recebido da ficha do cliente.</span><Button variant="ghost" size="sm" onClick={() => updateUrl({ cliente: undefined })}>Remover filtro</Button></div>}
      </Card>

      {selectedIds.length > 0 && (
        <Card className="sticky top-2 z-20 border-primary/30 bg-card/95 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Selecionados</p><p className="text-lg font-bold">{selectedIds.length} ROL{selectedIds.length === 1 ? "" : "s"}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p><p className="max-w-72 truncate font-semibold">{selectedClient?.razao_social}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p><p className="text-lg font-bold text-primary">{formatCurrency(selectedTotal)}</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setSelectedById({})}>Limpar seleção</Button>
              <Button onClick={openBilling} disabled={selectedDetails.isFetching || !computedBillingData} className="gap-2 bg-success hover:bg-success/90">
                {selectedDetails.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Conferir e gerar fatura
              </Button>
            </div>
          </div>
        </Card>
      )}

      {invalidPeriod ? (
        <Card className="flex flex-col items-center justify-center p-10 text-center"><AlertCircle className="mb-3 h-10 w-10 text-destructive" /><h3 className="font-semibold">Período inválido</h3><p className="mt-1 text-sm text-muted-foreground">Corrija as datas para consultar a fila.</p></Card>
      ) : queue.isLoading ? (
        <Card className="flex min-h-56 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Carregando ROLs pendentes</span></Card>
      ) : queue.isError ? (
        <Card role="alert" className="flex flex-col items-center justify-center p-10 text-center"><AlertCircle className="mb-3 h-10 w-10 text-destructive" /><h3 className="font-semibold">Não foi possível carregar a fila</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">{messageFromError(queue.error)}</p><Button variant="outline" onClick={() => void queue.refetch()} className="mt-4 gap-2"><RefreshCw className="h-4 w-4" /> Tentar novamente</Button></Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-10 text-center"><Package className="mb-3 h-12 w-12 text-muted-foreground/50" /><h3 className="font-semibold">{hasFilters ? "Nenhum resultado para estes filtros" : "Nenhum ROL pendente"}</h3><p className="mt-1 text-sm text-muted-foreground">{hasFilters ? "Ajuste ou limpe os filtros para ampliar a busca." : "Os novos atendimentos faturados aparecerão aqui."}</p>{hasFilters && <Button variant="outline" onClick={clearFilters} className="mt-4">Limpar filtros</Button>}</Card>
      ) : (
        <div className={cn("space-y-4", queue.isFetching && "opacity-70")} aria-busy={queue.isFetching}>
          {renderCycle("quinzenal")}
          {renderCycle("mensal")}
          {renderCycle("outro")}
        </div>
      )}

      {!queue.isLoading && !queue.isError && (queue.data?.total ?? 0) > 0 && (
        <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-sm text-muted-foreground sm:text-left">Página {page} de {totalPages} · {integerFormatter.format(queue.data?.total ?? 0)} resultado{queue.data?.total === 1 ? "" : "s"}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={page <= 1 || queue.isFetching} onClick={() => updateUrl({ pend_pagina: String(page - 1) }, false)} className="min-h-11 gap-2"><ChevronLeft className="h-4 w-4" /> Anterior</Button>
            <Button variant="outline" disabled={page >= totalPages || queue.isFetching} onClick={() => updateUrl({ pend_pagina: String(page + 1) }, false)} className="min-h-11 gap-2">Próxima <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </Card>
      )}

      <FaturamentoModal open={billingOpen} onOpenChange={(open) => { setBillingOpen(open); if (!open) setBillingData(null); }} dados={billingData} onComplete={() => { setSelectedById({}); setBillingData(null); setBillingOpen(false); }} faturaExistente={null} />
      <VisualizarItensModal open={viewOpen} onOpenChange={setViewOpen} lancamento={selectedLaunch} itens={selectedItems} isLoading={isLoadingItems} />
      <EditarLancamentoModal open={editOpen && Boolean(selectedLaunch) && !selectedLaunch?.ordem_servico_id} onOpenChange={setEditOpen} lancamento={selectedLaunch} itens={selectedItems} onSave={handleSave} isSaving={editLaunch.isPending} />

      <AlertDialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) setCancelReason(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar {selectedLaunch?.numero_rol || "ROL"}?</AlertDialogTitle>
            <AlertDialogDescription>O lançamento não será apagado. Itens, valores e autoria permanecerão no histórico para auditoria.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-rol-reason">Motivo do cancelamento</Label>
            <Textarea id="cancel-rol-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={500} placeholder="Informe por que este ROL está sendo cancelado" rows={4} />
            <p className="text-right text-xs text-muted-foreground">{cancelReason.trim().length}/500</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLaunch.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleCancel(); }} disabled={cancelReason.trim().length < 5 || cancelLaunch.isPending || Boolean(selectedLaunch?.ordem_servico_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelLaunch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cancelar ROL
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
