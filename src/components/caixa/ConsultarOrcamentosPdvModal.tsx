import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Printer,
  Search,
  UserRound,
  Phone,
  IdCard,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePdvQuotes, type PdvQuote, type PdvQuoteArea, type PdvQuoteStatusFilter } from "@/hooks/usePdvQuotes";
import { useFuncionarios } from "@/hooks/useFuncionarios";

interface ConsultarOrcamentosPdvModalProps {
  area: PdvQuoteArea;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuoteItem {
  codigo?: string | null;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  subtotal: number;
  detalhes: Record<string, unknown>;
}

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);

const formatDate = (value: string | null) => {
  if (!value) return "Não definida";
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "dd/MM/yyyy", { locale: ptBR }) : "Data inválida";
};

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const customerName = (quote: PdvQuote) => quote.cliente?.nome_fantasia?.trim() || quote.cliente?.razao_social?.trim() || "Cliente sem nome";

const getQuoteItems = (quote: PdvQuote): QuoteItem[] => {
  if (!Array.isArray(quote.itens_snapshot)) return [];
  return (quote.itens_snapshot as unknown[]).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const details = item.detalhes && typeof item.detalhes === "object" && !Array.isArray(item.detalhes)
      ? item.detalhes as Record<string, unknown>
      : {};
    return [{
      codigo: typeof item.codigo === "string" ? item.codigo : null,
      descricao: typeof item.descricao === "string" ? item.descricao : "Item sem descrição",
      quantidade: Number(item.quantidade) || 0,
      unidade: typeof item.unidade === "string" ? item.unidade : "un.",
      precoUnitario: Number(item.preco_unitario) || 0,
      subtotal: Number(item.subtotal) || 0,
      detalhes: details,
    }];
  });
};

const getItemDetails = (item: QuoteItem) => {
  const labels: Array<[string, unknown]> = [
    ["Cor", item.detalhes.cor],
    ["Marca", item.detalhes.marca],
    ["Avaria", item.detalhes.defeito],
    ["Prateleira", item.detalhes.posicao],
    ["Complemento", item.detalhes.complemento],
    ["Observação", item.detalhes.observacoes],
    ["Lacre", item.detalhes.lacre],
  ];
  const textDetails = labels
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`);
  const services = item.detalhes.servicos_adicionais;
  if (Array.isArray(services)) {
    const names = services.map((service) => {
      if (typeof service === "string") return service;
      if (service && typeof service === "object" && "nome" in service) return String((service as { nome: unknown }).nome);
      return "";
    }).filter(Boolean);
    if (names.length) textDetails.push(`Serviços: ${names.join(", ")}`);
  }
  const width = Number(item.detalhes.largura_m);
  const length = Number(item.detalhes.comprimento_m);
  const area = Number(item.detalhes.metragem_m2);
  if (width > 0 && length > 0) textDetails.push(`Medida: ${width} × ${length} m${area > 0 ? ` · ${area} m²` : ""}`);
  return textDetails;
};

const statusFor = (quote: PdvQuote) => {
  if (quote.status === "aberto" && quote.validade && quote.validade < localToday()) {
    return { label: "Vencido", variant: "destructive" as const };
  }
  const labels: Record<string, string> = {
    aberto: "Em aberto",
    aprovado: "Aprovado",
    recusado: "Recusado",
    cancelado: "Cancelado",
    convertido: "Convertido em ROL",
  };
  return { label: labels[quote.status] ?? quote.status, variant: quote.status === "aberto" ? "secondary" as const : "outline" as const };
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const printQuote = (quote: PdvQuote) => {
  const items = getQuoteItems(quote);
  const client = quote.cliente;
  const rows = items.map((item) => {
    const details = getItemDetails(item).join(" · ");
    return `<tr><td><strong>${escapeHtml(item.descricao)}</strong>${details ? `<small>${escapeHtml(details)}</small>` : ""}</td><td>${escapeHtml(item.quantidade)} ${escapeHtml(item.unidade)}</td><td>${escapeHtml(currency(item.precoUnitario))}</td><td>${escapeHtml(currency(item.subtotal))}</td></tr>`;
  }).join("");
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(quote.codigo)} · Orçamento AnjoLav</title><style>
    *{box-sizing:border-box}body{margin:0;padding:34px;color:#17263d;font:14px/1.45 Arial,sans-serif}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #1d4ed8;padding-bottom:18px}.brand{font-size:22px;font-weight:700;color:#123a73}.muted{color:#64748b}.code{text-align:right}.code strong{display:block;font-size:20px}.section{margin-top:22px}.section h2{font-size:15px;margin:0 0 10px}.client{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px;border:1px solid #d7dfeb;border-radius:8px}.items{width:100%;border-collapse:collapse;margin-top:8px}.items th,.items td{text-align:left;padding:10px;border-bottom:1px solid #d7dfeb}.items th{background:#f1f5f9}.items td:nth-child(n+2),.items th:nth-child(n+2){text-align:right;white-space:nowrap}.items small{display:block;color:#64748b;margin-top:4px}.notes{white-space:pre-wrap;border:1px solid #d7dfeb;border-radius:8px;padding:12px}.total{margin:22px 0 0 auto;width:min(340px,100%);padding:14px;background:#f1f5f9;border-radius:8px;text-align:right}.total strong{display:block;font-size:22px;margin-top:3px}.foot{margin-top:32px;padding-top:12px;border-top:1px solid #d7dfeb;color:#64748b;font-size:12px}@media print{body{padding:18mm}}
  </style></head><body><header class="top"><div><div class="brand">AnjoLav · Proposta comercial</div><div class="muted">Orçamento válido até ${escapeHtml(formatDate(quote.validade))}</div></div><div class="code"><strong>${escapeHtml(quote.codigo)}</strong><span class="muted">Emitido em ${escapeHtml(formatDate(quote.created_at))}</span></div></header><section class="section"><h2>Cliente</h2><div class="client"><div><strong>${escapeHtml(client?.nome_fantasia || client?.razao_social || "Cliente")}</strong><br><span class="muted">${escapeHtml(client?.razao_social || "")}</span></div><div>${client?.telefone ? `Telefone: ${escapeHtml(client.telefone)}` : ""}<br>${client?.cpf_cnpj ? `Documento: ${escapeHtml(client.cpf_cnpj)}` : ""}</div></div></section><section class="section"><h2>Itens da proposta</h2><table class="items"><thead><tr><th>Produto ou serviço</th><th>Quantidade</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></section>${quote.observacoes ? `<section class="section"><h2>Observações</h2><div class="notes">${escapeHtml(quote.observacoes)}</div></section>` : ""}<div class="total"><span>Valor total da proposta</span><strong>${escapeHtml(currency(Number(quote.valor_total)))}</strong></div><footer class="foot">Esta proposta não representa cobrança nem reserva de capacidade. Os preços ficam válidos até a data indicada.</footer><script>window.addEventListener('load',()=>window.print());</script></body></html>`);
  printWindow.document.close();
};

export function ConsultarOrcamentosPdvModal({ area, open, onOpenChange }: ConsultarOrcamentosPdvModalProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PdvQuoteStatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = usePdvQuotes({ area, open, search, status, dateFrom, dateTo, page });
  const quotes = query.data?.quotes ?? [];
  const totalQuotes = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalQuotes / 50));
  const selectedQuote = quotes.find((quote) => quote.id === selectedId) ?? null;
  const actorIds = useMemo(() => [...new Set(quotes.map((quote) => quote.criado_por).filter((id): id is string => Boolean(id)))], [quotes]);
  const { data: funcionarios = [] } = useFuncionarios({ enabled: open && Boolean(selectedQuote?.criado_por), includeInactive: true });
  const operatorNames = useMemo(() => Object.fromEntries(
    funcionarios.flatMap((funcionario) => funcionario.user_id && actorIds.includes(funcionario.user_id)
      ? [[funcionario.user_id, funcionario.nome] as const]
      : []),
  ), [actorIds, funcionarios]);

  useEffect(() => {
    if (open) return;
    setSearch("");
    setStatus("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
    setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (!selectedId && quotes.length > 0) setSelectedId(quotes[0].id);
    else if (selectedId && quotes.length > 0 && !quotes.some((quote) => quote.id === selectedId)) setSelectedId(quotes[0].id);
    else if (quotes.length === 0) setSelectedId(null);
  }, [quotes, selectedId]);

  const areaLabel = area === "industrial" ? "Industrial" : "Doméstico";
  const searchTerm = search.trim();
  const searchTooShort = searchTerm.length > 0 && searchTerm.replace(/[%_*]/g, "").trim().length < 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(1180px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5 text-primary" /> Orçamentos salvos <Badge variant="outline">{areaLabel}</Badge></DialogTitle>
          <DialogDescription>Pesquise por código ou cliente e abra a proposta para conferir valores, validade e itens.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 border-b bg-muted/20 px-5 py-4 sm:grid-cols-[minmax(240px,1.4fr)_minmax(150px,.7fr)_minmax(140px,.6fr)_minmax(140px,.6fr)] sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="pl-9" placeholder="Código, cliente, telefone ou CPF/CNPJ" aria-label="Pesquisar orçamento" />
          </div>
          <Select value={status} onValueChange={(value) => { setStatus(value as PdvQuoteStatusFilter); setPage(0); }}>
            <SelectTrigger aria-label="Filtrar situação"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as situações</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="expired">Vencidos</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(0); }} aria-label="Data inicial de emissão" title="Data inicial" />
          <Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(0); }} aria-label="Data final de emissão" title="Data final" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(290px,.82fr)_minmax(0,1.18fr)]">
          <section className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r" aria-label="Resultados da consulta de orçamentos">
            <div className="flex items-center justify-between gap-2 px-5 py-3 sm:px-6">
              <p className="text-sm font-semibold">{query.isLoading ? "Buscando…" : `${totalQuotes} ${totalQuotes === 1 ? "proposta" : "propostas"}`}</p>
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void query.refetch()} disabled={query.isFetching}>
                {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
              </Button>
            </div>
            <ScrollArea className="min-h-0 flex-1 px-4 pb-4 sm:px-5">
              <div className="space-y-2">
                {searchTooShort && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Digite pelo menos 2 caracteres para pesquisar.</p>}
                {query.isLoading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando propostas…</div>}
                {query.isError && <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">Não foi possível consultar os orçamentos. Confira sua permissão e tente novamente.</div>}
                {!query.isLoading && !query.isError && !searchTooShort && quotes.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{searchTerm ? "Nenhum orçamento encontrado com esses filtros." : "Pesquise pelo código, cliente, telefone ou CPF/CNPJ. A lista só é consultada quando você pede."}</div>}
                {!searchTooShort && quotes.map((quote) => {
                  const quoteStatus = statusFor(quote);
                  return (
                    <button key={quote.id} type="button" onClick={() => setSelectedId(quote.id)} aria-pressed={selectedQuote?.id === quote.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/40 ${selectedQuote?.id === quote.id ? "border-primary bg-primary/[0.06]" : "bg-background"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="font-semibold leading-5">{quote.codigo}</p><p className="mt-0.5 truncate text-sm text-muted-foreground">{customerName(quote)}</p></div>
                        <Badge variant={quoteStatus.variant} className="shrink-0">{quoteStatus.label}</Badge>
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-2 text-xs text-muted-foreground">
                        <span>Emitido {formatDate(quote.created_at)} · válido até {formatDate(quote.validade)}</span>
                        <strong className="shrink-0 text-sm text-foreground">{currency(Number(quote.valor_total))}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            {totalQuotes > 50 && <div className="flex items-center justify-between gap-2 border-t px-4 py-2 sm:px-5">
              <p className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</p>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Página anterior" disabled={page === 0 || query.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Próxima página" disabled={page + 1 >= totalPages || query.isFetching} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>}
          </section>

          <section className="flex min-h-0 flex-1 flex-col" aria-label="Detalhes do orçamento selecionado">
            {selectedQuote ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold">{selectedQuote.codigo}</h2><Badge variant={statusFor(selectedQuote).variant}>{statusFor(selectedQuote).label}</Badge></div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{customerName(selectedQuote)}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-9 gap-2" onClick={() => printQuote(selectedQuote)}><Printer className="h-4 w-4" /> Imprimir proposta</Button>
                </div>
                <ScrollArea className="min-h-0 flex-1 px-5 py-4 sm:px-6">
                  <div className="space-y-4 pb-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoCell icon={<UserRound className="h-4 w-4" />} label="Cliente" value={selectedQuote.cliente?.razao_social || customerName(selectedQuote)} />
                      <InfoCell icon={<Phone className="h-4 w-4" />} label="Telefone" value={selectedQuote.cliente?.telefone || "Não informado"} />
                      <InfoCell icon={<IdCard className="h-4 w-4" />} label="CPF/CNPJ" value={selectedQuote.cliente?.cpf_cnpj || "Não informado"} />
                      <InfoCell icon={<CalendarDays className="h-4 w-4" />} label="Emissão · validade" value={`${formatDate(selectedQuote.created_at)} · ${formatDate(selectedQuote.validade)}`} />
                      <InfoCell icon={<FileText className="h-4 w-4" />} label="Operação" value={selectedQuote.area_operacao === "industrial" ? "Industrial" : selectedQuote.area_operacao === "residencial" ? "Doméstico" : "Não registrada (proposta anterior)"} />
                      <InfoCell icon={<UserRound className="h-4 w-4" />} label="Responsável" value={selectedQuote.criado_por ? operatorNames[selectedQuote.criado_por] || "Usuário não identificado" : "Não registrado (proposta anterior)"} />
                    </div>

                    <div className="overflow-hidden rounded-lg border">
                      <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">Itens da proposta</div>
                      {getQuoteItems(selectedQuote).length === 0 ? <p className="p-4 text-sm text-muted-foreground">O orçamento não contém itens registrados.</p> : (
                        <div className="divide-y">
                          {getQuoteItems(selectedQuote).map((item, index) => {
                            const details = getItemDetails(item);
                            return <div key={`${selectedQuote.id}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_100px_125px_125px] sm:items-center">
                              <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.descricao}</p>{item.codigo && <p className="text-xs text-muted-foreground">Código {item.codigo}</p>}{details.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{details.join(" · ")}</p>}</div>
                              <span className="text-xs text-muted-foreground">{item.quantidade} {item.unidade}</span>
                              <span className="text-xs text-muted-foreground">Unitário {currency(item.precoUnitario)}</span>
                              <strong className="text-right text-sm">{currency(item.subtotal)}</strong>
                            </div>;
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-3 py-3"><span className="text-sm font-semibold">Total da proposta</span><strong className="text-lg">{currency(Number(selectedQuote.valor_total))}</strong></div>
                    </div>

                    {selectedQuote.observacoes && <div className="rounded-lg border p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</p><p className="mt-1 whitespace-pre-wrap text-sm">{selectedQuote.observacoes}</p></div>}
                    <p className="text-xs text-muted-foreground">A proposta não gera cobrança nem reserva de capacidade. O status e a validade são exibidos para acompanhamento.</p>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground"><FileText className="h-8 w-8 opacity-50" /><p className="text-sm">Selecione uma proposta para ver o cliente, os itens, os valores e a validade.</p></div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border bg-background p-3"><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-1 break-words text-sm font-medium">{value}</p></div>;
}
