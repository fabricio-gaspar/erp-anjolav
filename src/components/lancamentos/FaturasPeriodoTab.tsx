import { useEffect, useState } from "react";
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
import { escapeHtml, openExternalHttpsUrl, openPrintDocument, printDocumentWhenReady, safeHttpsUrl } from "@/lib/safePrint";
import { csvSafeCell } from "@/lib/faturamentoUtils";

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
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status: string;
  tipo_relatorio: string | null;
  itens_snapshot: unknown;
  numero_nf: string | null;
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

function itemsFromSnapshot(value: unknown): SnapshotItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === "object" && typeof item.produto === "string") as SnapshotItem[];
}

function itemsForReport(invoice: Invoice): SnapshotItem[] {
  const detailed = itemsFromSnapshot(invoice.itens_snapshot);
  return invoice.tipo_relatorio === "mapa"
    ? [...detailed.reduce((grouped, item) => {
        const key = JSON.stringify([item.produto, item.unidade, item.valor_unitario]);
        const existing = grouped.get(key);
        if (existing) {
          existing.quantidade += Number(item.quantidade);
          existing.valor_total += Number(item.valor_total);
        } else {
          grouped.set(key, { ...item, numero_rol: "—", data_rol: undefined,
            quantidade: Number(item.quantidade), valor_total: Number(item.valor_total) });
        }
        return grouped;
      }, new Map<string, SnapshotItem>()).values()]
    : detailed;
}

function downloadInvoiceCsv(invoice: Invoice) {
  const rows = [
    ["ROL", "Data do ROL", "Peça ou serviço", "Quantidade", "Unidade", "Valor unitário", "Subtotal"],
    ...itemsForReport(invoice).map(item => [
      item.numero_rol || "—", item.data_rol ? dateLabel(item.data_rol) : "—",
      item.produto, item.quantidade, item.unidade,
      Number(item.valor_unitario).toFixed(2), Number(item.valor_total).toFixed(2),
    ]),
  ];
  const csv = rows.map(row => row.map(csvSafeCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fatura-${invoice.id.slice(0, 8)}.csv`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printInvoiceReport(invoice: Invoice) {
  const reportItems = itemsForReport(invoice);
  const rows = reportItems.map(item =>
    `<tr><td>${escapeHtml(item.numero_rol || "—")}</td><td>${escapeHtml(item.data_rol ? dateLabel(item.data_rol) : "—")}</td>
    <td>${escapeHtml(item.produto)}</td><td>${escapeHtml(item.quantidade)} ${escapeHtml(item.unidade)}</td>
    <td>${money.format(Number(item.valor_unitario))}</td><td>${money.format(Number(item.valor_total))}</td></tr>`
  ).join("");
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
    <table><thead><tr><th>ROL</th><th>Data</th><th>Peça ou serviço</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
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
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [creatingBoleto, setCreatingBoleto] = useState(false);
  const [documents, setDocuments] = useState({ relatorio: true, nota: false, boleto: false });
  const { dados: customerData, error: customerError, isLoading: customerLoading } = useDadosFaturamentoCompletos(selected?.cliente_id ?? null);
  const validPeriod = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start;

  useEffect(() => setPage(1), [start, end, activeArea, activeTenant?.id]);
  useEffect(() => {
    if (!selected || dueDate || !customerData.configPagamento) return;
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
    queryKey: ["period-invoices", activeTenant?.id, user?.id, activeArea, start, end, page],
    queryFn: async () => {
      let query = supabase.from("faturas")
        .select(`id, cliente_id, periodo_inicio, periodo_fim, valor_total, status, tipo_relatorio,
          itens_snapshot, numero_nf, link_pdf_nf, protocolo_nfse, asaas_charge_id,
          boleto_url, boleto_linha_digitavel, forma_pagamento, data_vencimento, data_envio, created_at,
          cliente:clientes!faturas_cliente_id_fkey!inner(razao_social, cpf_cnpj, email, telefone, classificacao)`,
          { count: "exact" })
        .eq("tenant_id", activeTenant!.id)
        .lte("periodo_inicio", end).gte("periodo_fim", start)
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
      if (activeArea !== "central") query = query.eq("cliente.classificacao", activeArea);
      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data || []) as unknown as Invoice[], total: count ?? 0 };
    },
    enabled: Boolean(activeTenant && user && validPeriod),
  });

  const openInvoice = (invoice: Invoice) => {
    setSelected(invoice);
    setDueDate("");
    setDocuments({ relatorio: true, nota: false, boleto: false });
  };

  const generateBoleto = async () => {
    if (!selected || !activeTenant) return;
    const payment = customerData.configPagamento;
    if (payment?.condicao_pagamento !== "faturado" || payment.forma_pagamento !== "boleto") {
      toast.error("Configure boleto e condição Faturado no cadastro do cliente.");
      return;
    }
    if (!selected.cliente.cpf_cnpj || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < format(new Date(), "yyyy-MM-dd")) {
      toast.error("Informe documento do cliente e um vencimento válido.");
      return;
    }
    setCreatingBoleto(true);
    try {
      const { data: health, error: healthError } = await supabase.functions.invoke("create-asaas-charge", {
        body: { action: "health" },
      });
      if (healthError || health?.success !== true || health.environment !== "production" || health.webhookConfigured !== true) {
        throw new Error("Asaas de produção e webhook de conciliação precisam estar ativos antes de emitir o boleto.");
      }
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
        boleto_linha_digitavel: charge.identificationField, forma_pagamento: "boleto", data_vencimento: dueDate });
      await queryClient.invalidateQueries({ queryKey: ["period-invoices"] });
      toast.success("Boleto confirmado e vinculado à fatura.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o boleto.");
    } finally {
      setCreatingBoleto(false);
    }
  };

  if (!validPeriod) return <p role="alert" className="text-sm text-destructive">Corrija o período antes de consultar as faturas.</p>;

  return <div className="space-y-4">
    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
      Faturas cujo período de ROLs cruza o intervalo selecionado. O relatório pode ser reaberto; nota, boleto e envio mostram apenas confirmações reais.
    </div>
    <div className="flex items-center justify-between"><h2 className="font-semibold">Faturas</h2><span className="text-sm text-muted-foreground">{invoices.data?.total ?? 0} encontrada(s)</span></div>
    {invoices.isLoading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Consultando faturas...</p>
      : invoices.error ? <div role="alert" className="space-y-2"><p>Não foi possível carregar as faturas: {invoices.error.message}</p><Button variant="outline" onClick={() => void invoices.refetch()}>Tentar novamente</Button></div>
      : invoices.data?.items.length === 0 ? <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground"><Receipt className="mx-auto mb-2 h-8 w-8" /><p>Nenhuma fatura neste período.</p></div>
      : <div className="grid gap-3">{invoices.data?.items.map(invoice => <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1"><p className="font-semibold">{invoice.cliente.razao_social}</p><p className="text-xs text-muted-foreground">{dateLabel(invoice.periodo_inicio)} a {dateLabel(invoice.periodo_fim)} · {invoice.cliente.classificacao}</p>
            <p className="text-sm">Relatório {itemsFromSnapshot(invoice.itens_snapshot).length ? "pronto" : "indisponível"} · NFS-e {invoice.numero_nf && safeHttpsUrl(invoice.link_pdf_nf) ? "emitida" : "pendente"} · Boleto {safeHttpsUrl(invoice.boleto_url) ? "gerado" : "pendente"}</p></div>
          <div className="flex items-center gap-3"><strong>{money.format(Number(invoice.valor_total))}</strong><Button variant="outline" onClick={() => openInvoice(invoice)}>Abrir fatura</Button></div>
        </div>)}</div>}
    <div className="flex items-center justify-between gap-2 text-sm"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Anterior</Button>
      <span>Página {page} de {Math.max(1, Math.ceil((invoices.data?.total ?? 0) / PAGE_SIZE))}</span>
      <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= (invoices.data?.total ?? 0)} onClick={() => setPage(value => value + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4" /></Button></div>

    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {selected && <><DialogHeader><DialogTitle>Fatura de {selected.cliente.razao_social}</DialogTitle>
          <DialogDescription>{dateLabel(selected.periodo_inicio)} a {dateLabel(selected.periodo_fim)} · {money.format(Number(selected.valor_total))}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 rounded-lg border p-3"><FileText className="h-5 w-5 text-primary" /><h3 className="font-semibold">1. Relatório</h3>
              <p className="text-xs text-muted-foreground">Dados dos ROLs aprovados no fechamento.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!itemsFromSnapshot(selected.itens_snapshot).length} onClick={() => printInvoiceReport(selected)}><FileDown className="mr-1 h-4 w-4" />Abrir / PDF</Button>
                <Button size="sm" variant="outline" disabled={!itemsFromSnapshot(selected.itens_snapshot).length} onClick={() => downloadInvoiceCsv(selected)}>Planilha CSV</Button>
              </div></div>
            <div className="space-y-2 rounded-lg border p-3"><Receipt className="h-5 w-5 text-primary" /><h3 className="font-semibold">2. NFS-e</h3>
              {selected.numero_nf && safeHttpsUrl(selected.link_pdf_nf)
                ? <><p className="text-xs">Nº {selected.numero_nf}</p><Button size="sm" variant="outline" onClick={() => openExternalHttpsUrl(selected.link_pdf_nf)}>Abrir nota</Button></>
                : <p className="text-xs text-muted-foreground">Emissão indisponível até homologar o adaptador fiscal conforme regime e competência. Nenhuma nota foi simulada.</p>}</div>
            <div className="space-y-2 rounded-lg border p-3"><Receipt className="h-5 w-5 text-primary" /><h3 className="font-semibold">3. Boleto</h3>
              {safeHttpsUrl(selected.boleto_url)
                ? <><p className="text-xs">Vence em {selected.data_vencimento ? dateLabel(selected.data_vencimento) : "—"}</p><Button size="sm" variant="outline" onClick={() => openExternalHttpsUrl(selected.boleto_url)}>Abrir boleto</Button></>
                : <p className="text-xs text-muted-foreground">A cobrança só será criada após confirmação no Asaas.</p>}</div>
          </div>
          {!selected.asaas_charge_id && <div className="space-y-3 rounded-lg border p-4">
            <h3 className="font-semibold">Gerar boleto conforme cadastro do cliente</h3>
            {customerLoading ? <p role="status" className="text-sm">Consultando configuração...</p>
              : customerError ? <p role="alert" className="text-sm text-destructive">Não foi possível conferir a configuração do cliente.</p>
              : customerData.configPagamento?.condicao_pagamento !== "faturado" || customerData.configPagamento.forma_pagamento !== "boleto"
                ? <p className="text-sm text-muted-foreground">A condição Faturado e boleto precisam estar marcados no cadastro do cliente. A forma de pagamento não será trocada automaticamente.</p>
                : <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="invoice-due">Vencimento</Label><Input id="invoice-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} /></div>
                    <Button disabled={creatingBoleto || !dueDate} onClick={() => void generateBoleto()}>{creatingBoleto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar boleto no Asaas</Button></div>}
          </div>}
          <div className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">4. Documentos para envio</h3>
            <p className="text-sm text-muted-foreground">Selecione os documentos disponíveis. O envio automático com anexos exige um provedor de e-mail e WhatsApp com mídia configurados; esta fatura não será marcada como enviada sem confirmação.</p>
            <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><Checkbox checked={documents.relatorio} onCheckedChange={value => setDocuments(current => ({ ...current, relatorio: value === true }))} disabled={!itemsFromSnapshot(selected.itens_snapshot).length} />Relatório</label>
              <label className="flex items-center gap-2"><Checkbox checked={documents.nota} onCheckedChange={value => setDocuments(current => ({ ...current, nota: value === true }))} disabled={!selected.numero_nf || !safeHttpsUrl(selected.link_pdf_nf)} />Nota fiscal</label>
              <label className="flex items-center gap-2"><Checkbox checked={documents.boleto} onCheckedChange={value => setDocuments(current => ({ ...current, boleto: value === true }))} disabled={!safeHttpsUrl(selected.boleto_url)} />Boleto</label></div>
            <p className="text-xs text-muted-foreground">E-mail: {selected.cliente.email || "não cadastrado"} · WhatsApp: {selected.cliente.telefone || "não cadastrado"}</p>
            <p role="status" className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Envio com anexos pendente da integração dos canais. Você pode abrir os arquivos disponíveis acima para envio manual.</p>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
