import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  WalletCards,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { useItensLancamento } from "@/hooks/useLancamentos";
import { useRolDirectory, type RolDirectoryItem } from "@/hooks/useRolDirectory";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import {
  ROL_DIRECTORY_PAGE_SIZE,
  normalizeRolDirectoryDate,
  normalizeRolDirectoryPage,
  normalizeRolDirectoryStatus,
  rolDirectoryDateRangeIsValid,
  type RolDirectoryStatus,
} from "@/lib/rolDirectory";

const EMPTY_SUMMARY = {
  quantidade: 0,
  quantidade_pendente: 0,
  quantidade_faturada: 0,
  quantidade_cancelada: 0,
  valor_total: 0,
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-amber-200 bg-amber-50 text-amber-700" },
  faturado: { label: "Faturado", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelado: { label: "Cancelado", className: "border-red-200 bg-red-50 text-red-700" },
};

function formatDate(value: string | null | undefined) {
  return value ? format(parseISO(value), "dd/MM/yyyy") : "—";
}

function statusInfo(status: string) {
  return STATUS_CONFIG[status] ?? { label: status || "Sem situação", className: "bg-muted text-muted-foreground" };
}

function RolMobileCard({ item, onView }: { item: RolDirectoryItem; onView: () => void }) {
  const status = statusInfo(item.status);
  return (
    <article className="space-y-4 rounded-xl border bg-background p-4" aria-label={`ROL ${item.numero_rol || item.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{item.numero_rol || "ROL sem número"}</p>
          <h3 className="mt-1 break-words font-black">{item.cliente?.nome_fantasia || item.cliente?.razao_social || "Cliente"}</h3>
        </div>
        <Badge variant="outline" className={status.className}>{status.label}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 text-sm">
        <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Lançamento</dt><dd className="mt-1 font-semibold">{formatDate(item.data_lancamento)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-muted-foreground">Entrega</dt><dd className="mt-1 font-semibold">{formatDate(item.data_entrega)}</dd></div>
        <div className="col-span-2 border-t pt-3"><dt className="text-xs uppercase tracking-wide text-muted-foreground">Valor</dt><dd className="mt-1 text-lg font-black">R$ {formatNumberToCurrency(Number(item.valor_total))}</dd></div>
      </dl>
      <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onView}>
        <Eye className="mr-2 h-4 w-4" aria-hidden="true" />Ver itens
      </Button>
    </article>
  );
}

export function HistoricoROLsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<RolDirectoryItem | null>(null);
  const search = searchParams.get("rol_q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const page = normalizeRolDirectoryPage(searchParams.get("rol_pagina"));
  const status = normalizeRolDirectoryStatus(searchParams.get("rol_situacao"));
  const startDate = normalizeRolDirectoryDate(searchParams.get("rol_inicio"));
  const endDate = normalizeRolDirectoryDate(searchParams.get("rol_fim"));
  const clientId = searchParams.get("cliente");
  const periodIsValid = rolDirectoryDateRangeIsValid(startDate, endDate);

  const { data, isLoading, isFetching, error, refetch } = useRolDirectory({
    page,
    search: deferredSearch,
    status,
    clientId,
    startDate,
    endDate,
    enabled: periodIsValid,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const totalPages = Math.max(1, Math.ceil(total / ROL_DIRECTORY_PAGE_SIZE));
  const firstVisible = total === 0 ? 0 : (page - 1) * ROL_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * ROL_DIRECTORY_PAGE_SIZE, total);
  const hasFilters = Boolean(search || status !== "todos" || startDate || endDate || clientId);

  const updateFilters = useCallback((updates: {
    search?: string;
    status?: RolDirectoryStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    clearClient?: boolean;
  }) => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string | undefined, defaultValue = "") => {
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
    };
    if (updates.search !== undefined) setOrDelete("rol_q", updates.search.trim());
    if (updates.status !== undefined) setOrDelete("rol_situacao", updates.status, "todos");
    if (updates.startDate !== undefined) setOrDelete("rol_inicio", updates.startDate);
    if (updates.endDate !== undefined) setOrDelete("rol_fim", updates.endDate);
    if (updates.page !== undefined) setOrDelete("rol_pagina", updates.page > 1 ? String(updates.page) : "");
    if (updates.clearClient) next.delete("cliente");
    if (updates.search !== undefined || updates.status !== undefined || updates.startDate !== undefined || updates.endDate !== undefined || updates.clearClient) {
      next.delete("rol_pagina");
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isLoading || total === 0 || page <= totalPages) return;
    updateFilters({ page: totalPages });
  }, [isLoading, page, total, totalPages, updateFilters]);

  const periodLabel = useMemo(() => {
    if (startDate && endDate) return `${formatDate(startDate)} a ${formatDate(endDate)}`;
    if (startDate) return `Desde ${formatDate(startDate)}`;
    if (endDate) return `Até ${formatDate(endDate)}`;
    return "Todos os lançamentos";
  }, [endDate, startDate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ROLs</p><p className="mt-1 text-2xl font-black">{summary.quantidade}</p><p className="mt-1 text-xs text-muted-foreground">recorte filtrado</p></div>
          <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
        </Card>
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pendentes</p><p className="mt-1 text-2xl font-black text-amber-700">{summary.quantidade_pendente}</p><p className="mt-1 text-xs text-muted-foreground">aguardando faturamento</p></div>
          <Clock3 className="h-6 w-6 text-amber-700" aria-hidden="true" />
        </Card>
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Faturados</p><p className="mt-1 text-2xl font-black text-success">{summary.quantidade_faturada}</p><p className="mt-1 text-xs text-muted-foreground">vínculo preservado</p></div>
          <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
        </Card>
        <Card className="flex min-h-28 items-center justify-between p-4">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor total</p><p className="mt-1 truncate text-xl font-black">R$ {formatNumberToCurrency(summary.valor_total)}</p><p className="mt-1 text-xs text-muted-foreground">{summary.quantidade_cancelada} cancelado(s)</p></div>
          <WalletCards className="h-6 w-6 text-primary" aria-hidden="true" />
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/70">
        <div className="border-b bg-muted/20 p-4">
          <h2 className="text-lg font-black">Histórico de ROLs</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulte lançamentos sem baixar todo o histórico da empresa.</p>
        </div>
        <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_160px_160px_auto]">
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Buscar ROLs" className="min-h-11 pl-9" placeholder="Número do ROL ou cliente" value={search} onChange={event => updateFilters({ search: event.target.value })} />
          </div>
          <Select value={status} onValueChange={value => updateFilters({ status: value as RolDirectoryStatus })}>
            <SelectTrigger className="min-h-11" aria-label="Filtrar ROLs por situação"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="faturado">Faturados</SelectItem><SelectItem value="cancelado">Cancelados</SelectItem></SelectContent>
          </Select>
          <div className="space-y-1"><Label className="text-xs" htmlFor="rol-start-date">Lançamento inicial</Label><Input id="rol-start-date" className="min-h-11" type="date" value={startDate ?? ""} onChange={event => updateFilters({ startDate: event.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs" htmlFor="rol-end-date">Lançamento final</Label><Input id="rol-end-date" className="min-h-11" type="date" value={endDate ?? ""} onChange={event => updateFilters({ endDate: event.target.value })} /></div>
          {hasFilters && <Button variant="ghost" className="min-h-11 gap-2 self-end" onClick={() => updateFilters({ search: "", status: "todos", startDate: "", endDate: "", clearClient: true })}><RotateCcw className="h-4 w-4" aria-hidden="true" />Limpar</Button>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
          <span>{periodLabel}{clientId ? " · cliente selecionado" : ""}</span>
          {isFetching && !isLoading && <span role="status" aria-live="polite">Atualizando…</span>}
        </div>

        {!periodIsValid ? (
          <Alert variant="destructive" className="m-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Período inválido</AlertTitle><AlertDescription>A data inicial não pode ser posterior à data final.</AlertDescription></Alert>
        ) : isLoading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-6" role="status" aria-live="polite"><Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" /><p className="text-sm text-muted-foreground">Carregando ROLs…</p></div>
        ) : error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center" role="alert"><AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" /><div><h3 className="font-black">Não foi possível carregar o histórico</h3><p className="mt-1 text-sm text-muted-foreground">O erro não foi convertido em uma lista vazia.</p></div><Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button></div>
        ) : items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center" role="status" aria-live="polite"><FileText className="h-9 w-9 text-muted-foreground" aria-hidden="true" /><h3 className="font-black">Nenhum ROL encontrado</h3><p className="text-sm text-muted-foreground">{hasFilters ? "Ajuste os filtros para ampliar a busca." : "Ainda não existem ROLs nesta área."}</p></div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block" role="region" aria-label="Tabela do histórico de ROLs" tabIndex={0}>
              <Table aria-busy={isFetching}>
                <TableHeader><TableRow><TableHead>ROL</TableHead><TableHead>Cliente</TableHead><TableHead>Lançamento</TableHead><TableHead>Entrega</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map(item => {
                    const itemStatus = statusInfo(item.status);
                    return <TableRow key={item.id}><TableCell className="font-mono text-xs">{item.numero_rol || "—"}</TableCell><TableCell className="font-semibold">{item.cliente?.nome_fantasia || item.cliente?.razao_social || "Cliente"}</TableCell><TableCell>{formatDate(item.data_lancamento)}</TableCell><TableCell>{formatDate(item.data_entrega)}</TableCell><TableCell className="text-right font-black">R$ {formatNumberToCurrency(Number(item.valor_total))}</TableCell><TableCell><Badge variant="outline" className={itemStatus.className}>{itemStatus.label}</Badge></TableCell><TableCell className="text-right"><Button type="button" size="icon" variant="ghost" aria-label={`Ver itens do ROL ${item.numero_rol || item.id}`} onClick={() => setSelected(item)}><Eye className="h-4 w-4" aria-hidden="true" /></Button></TableCell></TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">{items.map(item => <RolMobileCard key={item.id} item={item} onView={() => setSelected(item)} />)}</div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação do histórico de ROLs">
          <p className="text-muted-foreground" aria-live="polite">Exibindo {firstVisible}–{lastVisible} de {total} ROLs</p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button variant="outline" className="min-h-11" disabled={page <= 1 || isFetching} onClick={() => updateFilters({ page: page - 1 })} aria-label="Página anterior do histórico de ROLs"><ChevronLeft className="h-4 w-4" />Anterior</Button>
            <span className="whitespace-nowrap text-xs font-semibold">Página {page} de {totalPages}</span>
            <Button variant="outline" className="min-h-11" disabled={page >= totalPages || isFetching} onClick={() => updateFilters({ page: page + 1 })} aria-label="Próxima página do histórico de ROLs">Próxima<ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <HistoricoVisualizarWrapper lancamento={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function HistoricoVisualizarWrapper({ lancamento, onClose }: { lancamento: RolDirectoryItem | null; onClose: () => void }) {
  const { data: itens = [], isLoading } = useItensLancamento(lancamento?.id || null);
  return <VisualizarItensModal open={Boolean(lancamento)} onOpenChange={open => { if (!open) onClose(); }} lancamento={lancamento} itens={itens} isLoading={isLoading} />;
}
