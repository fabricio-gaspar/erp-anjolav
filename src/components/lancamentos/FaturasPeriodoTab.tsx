import { useDeferredValue, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { AlertCircle, ChevronLeft, ChevronRight, FileDown, FileText, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useCreateAsaasCharge } from "@/hooks/useAsaas";
import { useDadosFaturamentoCompletos } from "@/hooks/useDadosFaturamento";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { escapeHtml, openExternalHttpsUrl, openPrintDocument, printDocumentWhenReady, safeHttpsUrl } from "@/lib/safePrint";
import { csvSafeCell } from "@/lib/faturamentoUtils";
import { buildBillingReport } from "@/lib/billingReports";
import { NfseEmissionPanel } from "@/components/faturamento/NfseEmissionPanel";
import { RecebimentosFaturaPanel } from "@/components/faturamento/RecebimentosFaturaPanel";
import { nfseStatusLabel, type FiscalOperation } from "@/lib/nfsePolicy";

interface SnapshotItem {
  id: string;
  numero_rol?: string;
  data_rol?: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

interface Invoice {
  id: string;
  cliente_id: string;
  configuracao_fiscal_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  valor_recebido: number;
  data_recebimento: string | null;
  cobranca_reservada_em: string | null;
  cobranca_reserva_vencimento: string | null;
  status: string;
  tipo_relatorio: string | null;
  itens_snapshot: unknown;
  numero_nf: string | null;
  nfse_status: string;
  operation_type: FiscalOperation | null;
  nfse: {
    id: string;
    status: string;
    ambiente: string;
    numero: string | null;
    chave_acesso: string | null;
    protocolo: string | null;
    tentativas: number;
    autorizado_em: string | null;
    cancelado_em: string | null;
    erros: unknown;
  } | null;
  link_pdf_nf: string | null;
  protocolo_nfse: string | null;
  asaas_charge_id: string | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  data_envio: string | null;
  created_at: string;
  cliente: {
    razao_social: string;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
    classificacao: string;
  };
}

const PAGE_SIZE = 25;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => format(parseISO(value), "dd/MM/yyyy");

function readInvoices(value: unknown): { total: number; items: Invoice[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Resposta de consulta inválida.");
  const payload = value as { total?: unknown; items?: unknown };
  if (!Array.isArray(payload.items) || !Number.isFinite(Number(payload.total))) {
    throw new Error("Resposta de consulta incompleta.");
  }
  return { total: Number(payload.total), items: payload.items as Invoice[] };
}

function itemsFromSnapshot(value: unknown): SnapshotItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === "object" && typeof item.produto === "string") as SnapshotItem[];
}

function downloadInvoiceCsv(invoice: Invoice) {
  const table = buildBillingReport(itemsFromSnapshot(invoice.itens_snapshot), invoice.tipo_relatorio);
  const csv = [table.headers, ...table.rows].map(row => row.map(csvSafeCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fatura-${invoice.id.slice(0, 8)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printInvoiceReport(invoice: Invoice) {
  const table = buildBillingReport(itemsFromSnapshot(invoice.itens_snapshot), invoice.tipo_relatorio);
  const rows = table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const headers = table.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("");
  if (!rows) {
    toast.error("Esta fatura não possui um relatório de itens salvo.");
    return;
  }
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de faturamento</title>
    <style>body{font:13px Arial,sans-serif;margin:28px;color:#102033}h1{font-size:21px}
    table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border:1px solid #bac6d2;padding:7px;text-align:left}
    th{background:#edf4fb}.total{text-align:right;font-size:18px;font-weight:bold;margin-top:20px}</style>
    </head><body><h1>Relatório de faturamento</h1><p><strong>Cliente:</strong> ${escapeHtml(invoice.cliente.razao_social)}</p>
    <p><strong>Documento:</strong> ${escapeHtml(invoice.cliente.cpf_cnpj || "Não informado")}</p>
    <p><strong>ROLs abertos entre:</strong> ${dateLabel(invoice.periodo_inicio)} e ${dateLabel(invoice.periodo_fim)}</p>
    ${invoice.tipo_relatorio === "mapa_pecas" ? "<p>O relatório exibe as quantidades registradas no ROL; quantidade informada separadamente pelo cliente não está disponível.</p>" : ""}
    <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
    <p class="total">Total: ${money.format(Number(invoice.valor_total))}</p></body></html>`;
  const windowRef = openPrintDocument(html);
  if (windowRef) printDocumentWhenReady(windowRef);
  else toast.error("O navegador bloqueou a janela do relatório.");
}

export function FaturasPeriodoTab({
  start = format(startOfMonth(new Date()), "yyyy-MM-dd"),
  end = format(endOfMonth(new Date()), "yyyy-MM-dd"),
}: { start?: string; end?: string } = {}) {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const queryClient = useQueryClient();
  const createCharge = useCreateAsaasCharge();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("todos");
  const deferredSearch = useDeferredValue(search.trim());
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [creatingBoleto, setCreatingBoleto] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [documents, setDocuments] = useState({ relatorio: true, nota: false, boleto: false });
  const { dados: customerData, error: customerError, isLoading: customerLoading } = useDadosFaturamentoCompletos(selected?.cliente_id ?? null);
  const validPeriod = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)
    && end >= start && (Date.parse(end) - Date.parse(start)) / 86400000 <= 366;

  useEffect(() => setPage(1), [start, end, activeArea, activeTenant?.id, deferredSearch, paymentStatus]);
  useEffect(() => setSelected(null), [start, end, activeArea, activeTenant?.id]);
  useEffect(() => {
    if (!selected || dueDate || !customerData.configPagamento) return;
    if (selected.cobranca_reserva_vencimento) { setDueDate(selected.cobranca_reserva_vencimento); return; }
    const base = parseISO(selected.periodo_fim) > new Date() ? parseISO(selected.periodo_fim) : new Date();
    const dueDay = customerData.configPagamento.dia_vencimento;
    let suggested = addDays(base, 30);
    if (dueDay && Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31) {
      const month = startOfMonth(base);
      const currentMonth = new Date(month.getFullYear(), month.getMonth(),
        Math.min(dueDay, endOfMonth(month).getDate()));
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      suggested = currentMonth >= base ? currentMonth : new Date(
        nextMonth.getFullYear(), nextMonth.getMonth(),
        Math.min(dueDay, endOfMonth(nextMonth).getDate()),
      );
    }
    setDueDate(format(suggested, "yyyy-MM-dd"));
  }, [selected, dueDate, customerData.configPagamento]);

  const invoices = useQuery({
    queryKey: ["period-invoices", activeTenant?.id, user?.id, activeArea, start, end, page, deferredSearch, paymentStatus],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("consultar_faturas_faturamento_filtradas" as never, {
        _area: activeArea, _inicio: start, _fim: end, _pagina: page, _tamanho: PAGE_SIZE,
        _busca: deferredSearch || null, _situacao: paymentStatus,
      } as never);
      if (error) throw error;
      return readInvoices(data);
    },
    enabled: Boolean(activeTenant && user && validPeriod),
  });
  const cancellation = useQuery({
    queryKey: ["invoice-cancellation", activeTenant?.id, user?.id, selected?.id],
    enabled: Boolean(activeTenant && user && selected?.status === "cancelado"),
    queryFn: async () => {
      if (!selected || !activeTenant) return null;
      const { data, error } = await supabase.from("fatura_cancelamentos" as never).select("motivo, created_at").eq("tenant_id", activeTenant.id).eq("fatura_id", selected.id).maybeSingle();
      if (error) throw error;
      return data as unknown as { motivo: string; created_at: string } | null;
    },
  });

  const openInvoice = (invoice: Invoice) => {
    setSelected(invoice);
    setDueDate("");
    setCancelReason("");
    setShowCancel(false);
    setDocuments({ relatorio: true, nota: false, boleto: false });
  };

  const cancelInvoice = async () => {
    if (!selected || cancelReason.trim().length < 5) return;
    setCancelling(true);
    try {
      const { error } = await supabase.rpc("cancelar_fatura_sem_documentos" as never, { _fatura_id: selected.id, _motivo: cancelReason.trim() } as never);
      if (error) throw error;
      setSelected(null);
      setShowCancel(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["period-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["billing-period-clients"] }),
        queryClient.invalidateQueries({ queryKey: ["billing-period-rolls"] }),
        queryClient.invalidateQueries({ queryKey: ["accounts-receivable-directory"] }),
      ]);
      toast.success("Fatura cancelada. Os ROLs foram liberados para nova conferência.");
    } catch (error) {
      toast.error(error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "Não foi possível cancelar a fatura.");
    } finally { setCancelling(false); }
  };

  const refreshSelectedInvoice = async () => {
    if (!selected || !activeTenant) return;
    const [{ data, error }, result] = await Promise.all([
      supabase.from("faturas").select("*").eq("id", selected.id).eq("tenant_id", activeTenant.id).maybeSingle(),
      invoices.refetch(),
    ]);
    if (error) throw error;
    const updated = result.data?.items.find(invoice => invoice.id === selected.id);
    if (updated) setSelected(updated);
    else if (data) setSelected((current) => current ? { ...current, ...(data as unknown as Partial<Invoice>), cliente: current.cliente, nfse: current.nfse } : current);
  };

  const generateBoleto = async () => {
    if (!selected || !activeTenant) return;
    const payment = customerData.configPagamento;
    if (payment?.condicao_pagamento !== "faturado" || payment.forma_pagamento !== "boleto") {
      toast.error("Configure boleto e condição Faturado no cadastro do cliente.");
      return;
    }
    if (!selected.cliente.cpf_cnpj || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || (!selected.cobranca_reservada_em && dueDate < format(new Date(), "yyyy-MM-dd"))) {
      toast.error("Informe documento do cliente e um vencimento válido.");
      return;
    }
    setCreatingBoleto(true);
    try {
      const { data: health, error: healthError } = await supabase.functions.invoke("create-asaas-charge", {
        body: { action: "health" },
      });
      const expectedEnvironment = import.meta.env.VITE_ASAAS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
      if (healthError || health?.success !== true || health.environment !== expectedEnvironment || health.webhookConfigured !== true) {
        throw new Error(`Asaas em ${expectedEnvironment === "sandbox" ? "homologação" : "produção"} e webhook de conciliação precisam estar configurados antes de emitir o boleto.`);
      }
      const { error: reservationError } = await supabase.rpc("reservar_boleto_fatura" as never, { _fatura_id: selected.id, _vencimento: dueDate } as never);
      if (reservationError) throw reservationError;
      setSelected((current) => current ? { ...current, cobranca_reservada_em: new Date().toISOString(), cobranca_reserva_vencimento: dueDate } : current);
      const charge = await createCharge.mutateAsync({
        customer_name: selected.cliente.razao_social,
        customer_cpf_cnpj: selected.cliente.cpf_cnpj,
        customer_email: selected.cliente.email || undefined,
        description: `Fatura ${selected.id.slice(0, 8)} · ${dateLabel(selected.periodo_inicio)} a ${dateLabel(selected.periodo_fim)}`,
        value: Number(selected.valor_total),
        due_date: dueDate,
        billing_type: "BOLETO",
        idempotency_key: `fatura:${selected.id}:boleto`,
        cliente_id: selected.cliente_id,
      });
      const boletoUrl = safeHttpsUrl(charge.bankSlipUrl);
      if (!boletoUrl || !charge.identificationField) throw new Error("O Asaas não confirmou um boleto com PDF e linha digitável.");
      const { data, error } = await supabase.rpc("vincular_boleto_fatura", {
        _fatura_id: selected.id, _charge_id: charge.id, _linha_digitavel: charge.identificationField,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || !("id" in data)) throw new Error("O vínculo do boleto não foi confirmado.");
      setSelected({ ...selected, asaas_charge_id: charge.id, boleto_url: boletoUrl,
        boleto_linha_digitavel: charge.identificationField, forma_pagamento: "boleto", data_vencimento: dueDate,
        cobranca_reservada_em: null, cobranca_reserva_vencimento: null });
      await queryClient.invalidateQueries({ queryKey: ["period-invoices"] });
      toast.success("Boleto confirmado e vinculado à fatura.");
    } catch (error) {
      toast.error(error && typeof error === "object" && "message" in error && typeof error.message === "string" ? error.message : "Não foi possível gerar o boleto.");
    } finally {
      setCreatingBoleto(false);
    }
  };

  if (!validPeriod) return <p role="alert" className="text-sm text-destructive">Corrija o período antes de consultar as faturas.</p>;

  return <div className="space-y-4">
    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
      Faturas com ROLs da operação selecionada cujo período cruza o intervalo. O relatório pode ser reaberto; nota, boleto e envio mostram apenas confirmações reais.
    </div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="invoice-client-search">Cliente ou documento</Label><Input id="invoice-client-search" maxLength={100} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente" /></div><div><Label htmlFor="invoice-payment-status">Situação do pagamento</Label><Select value={paymentStatus} onValueChange={setPaymentStatus}><SelectTrigger id="invoice-payment-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="parcial">Parcial</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="atrasado">Atrasado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select></div></div>
    <div className="flex items-center justify-between"><h2 className="font-semibold">Faturas</h2><span className="text-sm text-muted-foreground">{invoices.data?.total ?? 0} encontrada(s)</span></div>
    {invoices.isLoading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Consultando faturas...</p>
      : invoices.error ? <div role="alert" className="space-y-2"><p>Não foi possível carregar as faturas: {invoices.error.message}</p><Button variant="outline" onClick={() => void invoices.refetch()}>Tentar novamente</Button></div>
      : invoices.data?.items.length === 0 ? <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground"><Receipt className="mx-auto mb-2 h-8 w-8" /><p>Nenhuma fatura neste período.</p></div>
      : <div className="grid gap-3">{invoices.data?.items.map(invoice => <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1"><p className="font-semibold">{invoice.cliente.razao_social}</p><p className="text-xs text-muted-foreground">{dateLabel(invoice.periodo_inicio)} a {dateLabel(invoice.periodo_fim)} · cadastro: {invoice.cliente.classificacao}</p>
            <p className="text-xs text-muted-foreground">Vencimento: {invoice.data_vencimento ? dateLabel(invoice.data_vencimento) : "não informado"} · Recebido: {money.format(Number(invoice.valor_recebido || 0))}{invoice.data_recebimento ? ` em ${dateLabel(invoice.data_recebimento)}` : ""}</p>
            <p className="text-sm">Relatório {itemsFromSnapshot(invoice.itens_snapshot).length ? "pronto" : "indisponível"} · NFS-e {nfseStatusLabel(invoice.nfse_status)} · Boleto {safeHttpsUrl(invoice.boleto_url) ? "gerado" : "pendente"}</p></div>
          <div className="flex items-center gap-3"><div className="text-right"><strong>{money.format(Number(invoice.valor_total))}</strong><p className="text-xs text-muted-foreground">{invoice.status === "cancelado" ? "Cancelada" : Number(invoice.valor_recebido) >= Number(invoice.valor_total) ? "Paga" : Number(invoice.valor_recebido) > 0 ? "Pagamento parcial" : "Aguardando pagamento"} · Saldo {money.format(Math.max(0, Number(invoice.valor_total) - Number(invoice.valor_recebido || 0)))}</p></div><Button variant="outline" onClick={() => openInvoice(invoice)}>Abrir fatura</Button></div>
        </div>)}</div>}
    <div className="flex items-center justify-between gap-2 text-sm"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
      <span>Página {page} de {Math.max(1, Math.ceil((invoices.data?.total ?? 0) / PAGE_SIZE))}</span>
      <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= (invoices.data?.total ?? 0)} onClick={() => setPage(value => value + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {selected && <><DialogHeader><DialogTitle>Fatura de {selected.cliente.razao_social}</DialogTitle>
          <DialogDescription>{dateLabel(selected.periodo_inicio)} a {dateLabel(selected.periodo_fim)} · {money.format(Number(selected.valor_total))}</DialogDescription></DialogHeader>
          {selected.status === "cancelado" && <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Fatura cancelada.</strong> {cancellation.isLoading ? "Consultando histórico..." : cancellation.error ? "Não foi possível consultar o motivo do cancelamento." : cancellation.data ? `Motivo: ${cancellation.data.motivo}` : "Motivo não disponível para esta fatura antiga."}
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 rounded-lg border p-3"><FileText className="h-5 w-5 text-primary" /><h3 className="font-semibold">1. Relatório</h3>
              <p className="text-xs text-muted-foreground">Dados dos ROLs aprovados no fechamento.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!itemsFromSnapshot(selected.itens_snapshot).length} onClick={() => printInvoiceReport(selected)}><FileDown className="mr-1 h-4 w-4" />Abrir / PDF</Button>
                <Button size="sm" variant="outline" disabled={!itemsFromSnapshot(selected.itens_snapshot).length} onClick={() => downloadInvoiceCsv(selected)}>Planilha CSV</Button>
              </div></div>
            <div className="space-y-2 rounded-lg border p-3"><Receipt className="h-5 w-5 text-primary" /><h3 className="font-semibold">3. Boleto</h3>
              {safeHttpsUrl(selected.boleto_url)
                ? <><p className="text-xs">Vence em {selected.data_vencimento ? dateLabel(selected.data_vencimento) : "—"}</p><Button size="sm" variant="outline" onClick={() => openExternalHttpsUrl(selected.boleto_url)}>Abrir boleto</Button></>
                : <p className="text-xs text-muted-foreground">A cobrança só será criada após confirmação no Asaas.</p>}</div>
          </div>
          {selected.status !== "cancelado" && <NfseEmissionPanel
            faturaId={selected.id}
            configuracaoFiscalId={selected.configuracao_fiscal_id}
            preferredEmitterId={customerData.configPagamento?.cnpj_emissor_id}
            operationType={selected.operation_type}
            nfseStatus={selected.nfse_status}
            onChanged={refreshSelectedInvoice}
          />}
          <RecebimentosFaturaPanel key={selected.id} invoiceId={selected.id} boletoEmProcessamento={Boolean(selected.cobranca_reservada_em)} onChanged={refreshSelectedInvoice} />
          {selected.status !== "cancelado" && !selected.asaas_charge_id && <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Gerar boleto conforme cadastro do cliente</h3>
            {customerLoading ? <p role="status" className="text-sm">Consultando configuração...</p>
              : customerError ? <p role="alert" className="text-sm text-destructive">Não foi possível conferir a configuração do cliente.</p>
              : customerData.configPagamento?.condicao_pagamento !== "faturado" || customerData.configPagamento.forma_pagamento !== "boleto"
                ? <p className="text-sm text-muted-foreground">A condição Faturado e boleto precisam estar marcados no cadastro do cliente. A forma de pagamento não será trocada automaticamente.</p>
                : <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="invoice-due">Vencimento</Label><Input id="invoice-due" type="date" value={dueDate} disabled={Boolean(selected.cobranca_reservada_em)} onChange={event => setDueDate(event.target.value)} /></div>
                    <Button disabled={creatingBoleto || !dueDate} onClick={() => void generateBoleto()}>{creatingBoleto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar boleto no Asaas</Button></div>}
          </div>}
          <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">4. Documentos para envio</h3>
            <p className="text-sm text-muted-foreground">Selecione os documentos disponíveis. O envio automático com anexos exige um provedor de e-mail e WhatsApp com mídia configurados; esta fatura não será marcada como enviada sem confirmação.</p>
            <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={documents.relatorio} onCheckedChange={value => setDocuments(current => ({ ...current, relatorio: value === true }))} disabled={!itemsFromSnapshot(selected.itens_snapshot).length} />Relatório</label>
              <label className="flex items-center gap-2"><Checkbox checked={documents.nota} onCheckedChange={value => setDocuments(current => ({ ...current, nota: value === true }))} disabled={selected.nfse_status !== "autorizada"} />Nota fiscal</label>
              <label className="flex items-center gap-2"><Checkbox checked={documents.boleto} onCheckedChange={value => setDocuments(current => ({ ...current, boleto: value === true }))} disabled={!safeHttpsUrl(selected.boleto_url)} />Boleto</label></div>
            <p className="text-xs text-muted-foreground">E-mail: {selected.cliente.email || "não cadastrado"} · WhatsApp: {selected.cliente.telefone || "não cadastrado"}</p>
            <p role="status" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Envio com anexos pendente da integração dos canais. Você pode abrir os arquivos disponíveis acima para envio manual.</p>
          </div>
          {selected.status !== "cancelado" && <div className="space-y-2 rounded-lg border p-4">
            <h3 className="font-semibold">Cancelamento da fatura</h3>
            <p className="text-sm text-muted-foreground">O cancelamento preserva o histórico e libera os ROLs para novo fechamento. Recebimentos, boletos e documentos fiscais precisam ser conciliados antes.</p>
            {!showCancel ? <Button type="button" variant="outline" onClick={() => setShowCancel(true)}>Cancelar fatura</Button> : <div className="space-y-2">
              <Label htmlFor="invoice-cancellation-reason">Motivo do cancelamento</Label>
              <Input id="invoice-cancellation-reason" maxLength={500} value={cancelReason} onChange={event => setCancelReason(event.target.value)} />
              <div className="flex flex-wrap gap-2"><Button type="button" variant="destructive" disabled={cancelling || cancelReason.trim().length < 5} onClick={() => void cancelInvoice()}>Confirmar cancelamento e liberar ROLs</Button><Button type="button" variant="outline" disabled={cancelling} onClick={() => setShowCancel(false)}>Voltar</Button></div>
            </div>}
          </div>}
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
