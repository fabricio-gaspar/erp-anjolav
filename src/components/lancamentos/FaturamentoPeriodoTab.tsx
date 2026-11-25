import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, FileCheck2, FileDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { escapeHtml, openPrintDocument, printDocumentWhenReady } from "@/lib/safePrint";
import { csvSafeCell } from "@/lib/faturamentoUtils";
import { buildBillingReport, type BillingReportItem } from "@/lib/billingReports";

interface BillingClient {
  cliente_id: string;
  razao_social: string;
  cpf_cnpj: string | null;
  classificacao: string;
  tipo_relatorio: string;
  forma_pagamento: string | null;
  movimentos: number;
  faturaveis: number;
  nao_faturaveis: number;
  valor_movimentado: number;
  valor_faturavel: number;
}

interface BillingRol {
  ordem_id: string;
  numero: string;
  operacao: "industrial" | "residencial";
  data_retirada: string;
  status: string;
  condicao_pagamento: string | null;
  valor_total: number;
  valor_pago: number;
  lancamento_id: string | null;
  fatura_id: string | null;
  motivo_bloqueio: string | null;
}

interface BillingItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
}

interface ReportDraft {
  client: BillingClient;
  rolls: BillingRol[];
  itemsByLaunch: Record<string, BillingItem[]>;
  total: number;
}

interface Paged<T> {
  total: number;
  items: T[];
}

const PAGE_SIZE = 25;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => format(parseISO(value), "dd/MM/yyyy");

function reportTable(draft: ReportDraft) {
  const items: BillingReportItem[] = draft.rolls.flatMap(roll =>
    (draft.itemsByLaunch[roll.lancamento_id || ""] || []).map(item => ({
      numero_rol: roll.numero, data_rol: roll.data_retirada, produto: item.produto_nome,
      quantidade: item.quantidade, unidade: item.unidade, valor_unitario: item.preco_unitario, valor_total: item.subtotal,
    }))
  );
  return buildBillingReport(items, draft.client.tipo_relatorio);
}

function readPage<T>(value: unknown): Paged<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta de consulta inválida.");
  const payload = value as { total?: unknown; items?: unknown };
  if (!Array.isArray(payload.items) || !Number.isFinite(Number(payload.total))) throw new Error("Resposta de consulta incompleta.");
  return { total: Number(payload.total), items: payload.items as T[] };
}

function downloadCsv(draft: ReportDraft, start: string, end: string) {
  const table = reportTable(draft);
  const csv = [table.headers, ...table.rows].map(row => row.map(csvSafeCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `faturamento-${draft.client.cliente_id.slice(0, 8)}-${start}-${end}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printReport(draft: ReportDraft, start: string, end: string) {
  const table = reportTable(draft);
  const rows = table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const headers = table.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de faturamento</title>
  <style>body{font:13px Arial,sans-serif;margin:28px;color:#102033}h1{font-size:21px}p{margin:6px 0}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bac6d2;padding:7px;text-align:left}th{background:#edf4fb}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}</style>
  </head><body><h1>Relatório de faturamento</h1><p><strong>Cliente:</strong> ${escapeHtml(draft.client.razao_social)}</p>
  <p><strong>Documento:</strong> ${escapeHtml(draft.client.cpf_cnpj || "Não informado")}</p>
  <p><strong>ROLs abertos entre:</strong> ${dateLabel(start)} e ${dateLabel(end)}</p>
  <p><strong>Operação:</strong> ${draft.rolls[0]?.operacao === "industrial" ? "Industrial" : "Doméstico"}</p>
  <p><strong>Formato cadastrado:</strong> ${escapeHtml(draft.client.tipo_relatorio)}</p>
  ${draft.client.tipo_relatorio === "mapa_pecas" ? "<p>O relatório exibe as quantidades registradas no ROL; quantidade informada separadamente pelo cliente não está disponível.</p>" : ""}
  <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
  <p class="total">Total: ${money.format(draft.total)}</p></body></html>`;
  const windowRef = openPrintDocument(html);
  if (!windowRef) {
    toast.error("O navegador bloqueou a janela do relatório.");
    return;
  }
  printDocumentWhenReady(windowRef);
}

export function FaturamentoPeriodoTab({
  start, end, onClosed,
}: {
  start: string;
  end: string;
  onClosed: () => void;
}) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const [clientPage, setClientPage] = useState(1);
  const [rollPage, setRollPage] = useState(1);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState<BillingClient | null>(null);
  const [selected, setSelected] = useState<Record<string, BillingRol>>({});
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  const commandKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const validPeriod = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)
    && end >= start && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366;

  useEffect(() => {
    setClient(null);
    setSelected({});
    setClientPage(1);
    setRollPage(1);
    setDraft(null);
    commandKey.current = null;
  }, [start, end, activeArea, activeTenant?.id]);

  const clients = useQuery({
    queryKey: ["billing-period-clients", activeTenant?.id, user?.id, activeArea, start, end, clientPage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_clientes_faturamento_periodo", {
        _area: activeArea, _inicio: start, _fim: end, _pagina: clientPage, _tamanho: PAGE_SIZE,
      });
      if (error) throw error;
      return readPage<BillingClient>(data);
    },
    enabled: Boolean(activeTenant && user && validPeriod),
  });
  const rolls = useQuery({
    queryKey: ["billing-period-rolls", activeTenant?.id, user?.id, activeArea, start, end, client?.cliente_id, rollPage],
    queryFn: async () => {
      if (!client) return { total: 0, items: [] } as Paged<BillingRol>;
      const { data, error } = await supabase.rpc("consultar_rols_faturamento_periodo", {
        _area: activeArea, _cliente_id: client.cliente_id,
        _inicio: start, _fim: end, _pagina: rollPage, _tamanho: PAGE_SIZE,
      });
      if (error) throw error;
      return readPage<BillingRol>(data);
    },
    enabled: Boolean(activeTenant && user && client && validPeriod),
  });

  const visibleClients = useMemo(() => (clients.data?.items ?? []).filter(row =>
    `${row.razao_social} ${row.cpf_cnpj || ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR").trim())
  ), [clients.data?.items, search]);
  const selectedRows = useMemo(() => Object.values(selected), [selected]);
  const selectedTotal = selectedRows.reduce((sum, row) => sum + Number(row.valor_total), 0);
  const selectableRows = useMemo(
    () => (rolls.data?.items ?? []).filter((row) => Boolean(row.lancamento_id) && !row.motivo_bloqueio),
    [rolls.data?.items],
  );
  const selectionOperation = selectedRows[0]?.operacao ?? selectableRows[0]?.operacao;
  const selectablePageRows = selectableRows.filter((row) => !selectionOperation || row.operacao === selectionOperation);
  const selectedOnPage = selectablePageRows.filter((row) => Boolean(row.lancamento_id && selected[row.lancamento_id]));
  const pageSelectionState = selectedOnPage.length === 0
    ? false
    : selectedOnPage.length === selectablePageRows.length ? true : "indeterminate";

  const togglePageSelection = () => {
    const ids = selectablePageRows.map((row) => row.lancamento_id as string);
    if (!ids.length) return;
    if (pageSelectionState === true) {
      setSelected((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))));
      return;
    }
    const availableSlots = Math.max(0, 100 - selectedRows.length);
    const rowsToAdd = selectablePageRows.filter((row) => !selected[row.lancamento_id as string]);
    if (rowsToAdd.length > availableSlots) toast.error("A fatura aceita no máximo 100 ROLs. Selecione até esse limite.");
    setSelected((current) => {
      const next = { ...current };
      rowsToAdd.slice(0, availableSlots).forEach((row) => { next[row.lancamento_id as string] = row; });
      return next;
    });
  };

  const closeBilling = useMutation({
    mutationFn: async (current: ReportDraft) => {
      const ids = current.rolls.map(row => row.lancamento_id as string).sort();
      const fingerprint = JSON.stringify([activeArea, current.client.cliente_id, start, end, ids]);
      if (commandKey.current?.fingerprint !== fingerprint) {
        commandKey.current = { fingerprint, key: `billing-period:${crypto.randomUUID()}` };
      }
      const { data, error } = await supabase.rpc("fechar_faturamento_rols", {
        _area: activeArea, _cliente_id: current.client.cliente_id,
        _periodo_inicio: start, _periodo_fim: end, _lancamento_ids: ids,
        _idempotency_key: commandKey.current.key, _observacao: note.trim() || null,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || !("id" in data)) throw new Error("Fechamento sem confirmação do servidor.");
      return data;
    },
    onSuccess: async () => {
      commandKey.current = null;
      setDraft(null);
      setSelected({});
      setReviewed(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["billing-period-clients"] }),
        queryClient.invalidateQueries({ queryKey: ["billing-period-rolls"] }),
        queryClient.invalidateQueries({ queryKey: ["faturas"] }),
        queryClient.invalidateQueries({ queryKey: ["central-pending-rol-summary"] }),
      ]);
      toast.success("Fatura criada com os ROLs conferidos.");
      onClosed();
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível fechar o faturamento."),
  });

  const prepareReport = async () => {
    if (!client || selectedRows.length === 0 || selectedRows.length > 100 || !activeTenant) return;
    setPreparing(true);
    try {
      const ids = selectedRows.map(row => row.lancamento_id as string);
      const { data, error } = await supabase.from("lancamentos")
        .select("id, valor_total, itens:itens_lancamento(id, produto_nome, quantidade, unidade, preco_unitario, subtotal)")
        .eq("tenant_id", activeTenant.id).in("id", ids);
      if (error) throw error;
      if (!data || data.length !== ids.length) throw new Error("Alguns lançamentos não estão disponíveis. Atualize a lista.");
      const { data: orderFees, error: feesError } = await supabase.from("ordens_servico")
        .select("id, taxa_entrega, valor_total").eq("tenant_id", activeTenant.id).in("id", selectedRows.map((row) => row.ordem_id));
      if (feesError) throw feesError;
      if (!orderFees || orderFees.length !== selectedRows.length) throw new Error("Não foi possível conferir as taxas dos ROLs.");
      const feesByOrder = new Map(orderFees.map((order) => [order.id, order]));
      const itemsByLaunch: Record<string, BillingItem[]> = {};
      for (const launch of data) {
        const items = [...(launch.itens || [])] as BillingItem[];
        const itemTotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
        const row = selectedRows.find((order) => order.lancamento_id === launch.id);
        const order = row && feesByOrder.get(row.ordem_id);
        const deliveryFee = Number(order?.taxa_entrega || 0);
        if (!order || Math.abs(Number(order.valor_total) - Number(launch.valor_total)) > 0.009 || !items.length || Math.abs(itemTotal + deliveryFee - Number(launch.valor_total)) > 0.009) {
          throw new Error("Os itens de um ROL não conferem com o valor cobrado. Revise o PDV.");
        }
        if (deliveryFee > 0) items.push({ id: `${order.id}:delivery`, produto_nome: "Taxa de delivery", quantidade: 1, unidade: "serviço", preco_unitario: deliveryFee, subtotal: deliveryFee });
        itemsByLaunch[launch.id] = items;
      }
      setDraft({ client, rolls: selectedRows, itemsByLaunch, total: selectedTotal });
      setReviewed(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao preparar o relatório.");
    } finally {
      setPreparing(false);
    }
  };

  const selectClient = (value: BillingClient) => {
    setClient(value);
    setSelected({});
    setRollPage(1);
    setDraft(null);
    setNote("");
  };
  const toggleRol = (row: BillingRol) => {
    if (!row.lancamento_id || row.motivo_bloqueio) return;
    setSelected(current => {
      if (current[row.lancamento_id!]) {
        const next = { ...current };
        delete next[row.lancamento_id!];
        return next;
      }
      if (Object.keys(current).length >= 100) {
        toast.error("Feche no máximo 100 ROLs por fatura.");
        return current;
      }
      if (Object.values(current).some(selectedRow => selectedRow.operacao !== row.operacao)) {
        toast.error("Selecione ROLs de uma operação por fatura: Doméstico ou Industrial.");
        return current;
      }
      return { ...current, [row.lancamento_id!]: row };
    });
  };

  if (!validPeriod) return <p role="alert" className="text-sm text-destructive">Informe um intervalo válido de até 366 dias.</p>;

  return <div className="space-y-5">
    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
      Período baseado na <strong className="text-foreground">data de abertura do ROL</strong>. A operação é a registrada no ROL; somente ROLs com condição “Faturado”, sem pagamento e sem fatura podem ser selecionados. Cada fatura reúne uma operação.
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,2fr)_minmax(340px,3fr)]">
      <section className="space-y-3" aria-label="Clientes com movimento">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Empresas com movimento</h2><span className="text-sm text-muted-foreground">{clients.data?.total ?? 0} cliente(s)</span></div>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar clientes desta página" aria-label="Filtrar clientes desta página" /></div>
        {clients.isLoading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Consultando movimentos...</p>
          : clients.error ? <div role="alert" className="space-y-2 text-sm"><p>Não foi possível consultar as empresas: {clients.error.message}</p><Button variant="outline" onClick={() => void clients.refetch()}>Tentar novamente</Button></div>
          : clients.data?.total === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Nenhum ROL aberto neste período.</p>
          : visibleClients.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma empresa corresponde ao filtro nesta página.</p>
          : visibleClients.map(row => <button key={row.cliente_id} type="button" onClick={() => selectClient(row)}
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50 ${client?.cliente_id === row.cliente_id ? "border-primary bg-primary/5" : "bg-card"}`}>
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><span className="font-semibold text-foreground">{row.razao_social}</span><span className="text-xs font-medium text-muted-foreground">{row.classificacao} · {row.movimentos} ROL(s)</span></span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{row.cpf_cnpj || "Sem documento"} · {row.faturaveis} faturáveis{row.nao_faturaveis > 0 ? ` · ${row.nao_faturaveis} bloqueado(s)` : ""}</span>
              <span className="mt-1 block text-xs text-muted-foreground">Total dos ROLs: {money.format(Number(row.valor_movimentado || 0))} · <strong className="text-foreground">Disponível para faturar: {money.format(Number(row.valor_faturavel))}</strong></span>
            </button>)}
        <div className="flex items-center justify-between gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={clientPage <= 1} onClick={() => setClientPage(page => page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
          <span>Página {clientPage} de {Math.max(1, Math.ceil((clients.data?.total ?? 0) / PAGE_SIZE))}</span>
          <Button variant="outline" size="sm" disabled={clientPage * PAGE_SIZE >= (clients.data?.total ?? 0)} onClick={() => setClientPage(page => page + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </section>

      <section className="space-y-3" aria-label="ROLs do cliente selecionado">
        <div><h2 className="font-semibold">Conferência de ROLs</h2><p className="text-sm text-muted-foreground">{client ? client.razao_social : "Selecione uma empresa para ver seus ROLs."}</p></div>
        {client && <>
          <p className="rounded-lg border bg-card p-3 text-sm">Relatório: <strong>{client.tipo_relatorio || "detalhado"}</strong> · Pagamento cadastrado: <strong>{client.forma_pagamento || "não definido"}</strong></p>
          {rolls.isLoading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando ROLs...</p>
            : rolls.error ? <div role="alert" className="space-y-2 text-sm"><p>Falha ao consultar ROLs: {rolls.error.message}</p><Button variant="outline" onClick={() => void rolls.refetch()}>Tentar novamente</Button></div>
            : rolls.data?.items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum ROL desta empresa no intervalo.</p>
            : <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox checked={pageSelectionState} onCheckedChange={togglePageSelection} disabled={selectablePageRows.length === 0 || rolls.isFetching} aria-label="Selecionar ROLs faturáveis desta página" />
                  Selecionar elegíveis desta página
                </label>
                <span className="text-xs text-muted-foreground">{selectablePageRows.length} elegível(is) · até 100 por fatura</span>
              </div>
              {rolls.data?.items.map(row => <label key={row.ordem_id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${row.motivo_bloqueio || !row.lancamento_id ? "bg-muted/30" : "bg-card"}`}>
                <Checkbox checked={Boolean(row.lancamento_id && selected[row.lancamento_id])} onCheckedChange={() => toggleRol(row)} disabled={Boolean(row.motivo_bloqueio || !row.lancamento_id)} aria-label={`Selecionar ROL ${row.numero}`} />
                <span className="min-w-0 flex-1"><span className="block font-medium">ROL {row.numero} · {dateLabel(row.data_retirada)} · {row.operacao === "industrial" ? "Industrial" : "Doméstico"}</span>
                  <span className="block text-xs text-muted-foreground">{row.motivo_bloqueio || (!row.lancamento_id ? "Lançamento do PDV ausente" : "Pronto para conferência")} · {row.status}</span></span>
                <strong className="whitespace-nowrap text-sm">{money.format(Number(row.valor_total))}</strong>
              </label>)}</div>}
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={rollPage <= 1} onClick={() => setRollPage(page => page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
            <span>Página {rollPage} de {Math.max(1, Math.ceil((rolls.data?.total ?? 0) / PAGE_SIZE))}</span>
            <Button variant="outline" size="sm" disabled={rollPage * PAGE_SIZE >= (rolls.data?.total ?? 0)} onClick={() => setRollPage(page => page + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div><p className="font-semibold">{selectedRows.length} ROL(s) selecionado(s)</p><p className="text-sm text-muted-foreground">Total {money.format(selectedTotal)}</p></div>
            <Button disabled={!selectedRows.length || preparing || !["detalhado", "mapa", "mapa_pecas", "mapa_mensal"].includes(client.tipo_relatorio || "detalhado")} onClick={() => void prepareReport()}>
              {preparing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}Conferir relatório
            </Button>
          </div>
          {!["detalhado", "mapa", "mapa_pecas", "mapa_mensal"].includes(client.tipo_relatorio || "detalhado") && <p role="alert" className="text-sm text-destructive">O modelo de relatório cadastrado precisa ser configurado antes do fechamento.</p>}
        </>}
      </section>
    </div>

    <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open) setDraft(null); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {draft && <>
          <DialogHeader><DialogTitle>Conferir relatório antes de fechar</DialogTitle><DialogDescription>{draft.client.razao_social} · {dateLabel(start)} a {dateLabel(end)} · {draft.rolls.length} ROL(s)</DialogDescription></DialogHeader>
          {draft.client.tipo_relatorio === "mapa_pecas" && <p className="text-sm text-muted-foreground">O relatório exibe as quantidades registradas no ROL. A quantidade informada separadamente pelo cliente não está disponível.</p>}
          <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-muted"><tr>{reportTable(draft).headers.map((header, index) => <th key={index} className="p-2 text-left whitespace-nowrap">{header}</th>)}</tr></thead>
            <tbody>{reportTable(draft).rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t">{row.map((cell, index) => <td key={index} className="p-2 whitespace-nowrap">{cell}</td>)}</tr>)}</tbody></table></div>
          <p className="text-right text-lg font-bold">Total a faturar: {money.format(draft.total)}</p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => printReport(draft, start, end)}><FileDown className="mr-2 h-4 w-4" />Abrir relatório / salvar PDF</Button><Button variant="outline" onClick={() => downloadCsv(draft, start, end)}>Baixar planilha CSV</Button></div>
          <div className="space-y-2"><Label htmlFor="billing-note">Observação da fatura (opcional)</Label><Textarea id="billing-note" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></div>
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={reviewed} onCheckedChange={value => setReviewed(value === true)} /><span>Conferi os ROLs, itens, período e valor. Aprovo a criação da fatura com estes dados.</span></label>
          <div className="flex justify-end"><Button disabled={!reviewed || closeBilling.isPending} onClick={() => void closeBilling.mutateAsync(draft).catch(() => undefined)}>
            {closeBilling.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Aprovar e fechar fatura
          </Button></div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
