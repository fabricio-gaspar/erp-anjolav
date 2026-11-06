import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Store,
  TrendingUp,
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
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NovaCobrancaModal } from "@/components/cobrancas/NovaCobrancaModal";
import {
  useContasReceberUnificado,
  type ContaReceberUnificada,
  type OrigemReceita,
} from "@/hooks/useContasReceberUnificado";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import {
  FINANCIAL_ACCOUNT_PAGE_SIZE,
  financialAccountDateRangeIsValid,
  normalizeFinancialAccountDate,
  normalizeFinancialAccountPage,
  normalizeReceivableOrigin,
  normalizeReceivableStatus,
  type ReceivableOriginFilter,
  type ReceivableStatusFilter,
} from "@/lib/financialAccountDirectory";

const origemLabel: Record<OrigemReceita, { label: string; icon: LucideIcon; className: string }> = {
  fatura: { label: "Fatura", icon: FileText, className: "border-blue-200 bg-blue-50 text-blue-700" },
  pdv_loja: { label: "PDV Doméstico", icon: Store, className: "border-green-200 bg-green-50 text-green-700" },
  pdv_industrial: { label: "PDV Industrial", icon: Store, className: "border-blue-200 bg-blue-50 text-blue-700" },
  asaas: { label: "Cobrança Asaas", icon: CreditCard, className: "border-purple-200 bg-purple-50 text-purple-700" },
  manual: { label: "Manual", icon: Receipt, className: "border-slate-200 bg-slate-50 text-slate-700" },
};

const EMPTY_SUMMARY = {
  quantidade: 0,
  quantidade_aberta: 0,
  quantidade_recebida: 0,
  valor_aberto: 0,
  valor_recebido: 0,
};

function formatDate(value: string | null) {
  return value ? format(parseISO(value), "dd/MM/yyyy") : "—";
}

function statusVariant(status: string): "success" | "danger" | "warning" | "info" | "default" {
  if (status === "recebido") return "success";
  if (status === "atrasado") return "danger";
  if (status === "parcial") return "info";
  if (status === "pendente") return "warning";
  return "default";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    recebido: "Recebido",
    atrasado: "Atrasado",
    cancelado: "Cancelado",
    estornado: "Estornado",
    parcial: "Parcial",
    pendente: "Pendente",
  };
  return labels[status] ?? status;
}

function originInfo(origin: string) {
  return origemLabel[origin as OrigemReceita] ?? origemLabel.manual;
}

function ReceivableMobileCard({ account }: { account: ContaReceberUnificada }) {
  const origin = originInfo(account.origem);
  const OriginIcon = origin.icon;
  const balance = Math.max(Number(account.valor) - Number(account.valor_recebido), 0);
  return (
    <article className="rounded-xl border bg-background p-4" aria-label={`Conta a receber ${account.descricao}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-black text-foreground">{account.descricao}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{account.cliente_nome || "Cliente não informado"}</p>
        </div>
        <StatusBadge variant={statusVariant(account.status)}>{statusLabel(account.status)}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant="outline" className={`gap-1 text-xs ${origin.className}`}>
          <OriginIcon className="h-3 w-3" />{origin.label}
        </Badge>
        <Badge variant="outline">Vence em {formatDate(account.data_vencimento)}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Valor</dt>
          <dd className="mt-1 font-black">R$ {formatNumberToCurrency(Number(account.valor))}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Saldo</dt>
          <dd className="mt-1 font-black text-amber-700">R$ {formatNumberToCurrency(balance)}</dd>
        </div>
      </dl>
    </article>
  );
}

const ContasReceberContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showNovaCobranca, setShowNovaCobranca] = useState(false);
  const search = searchParams.get("receber_q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const page = normalizeFinancialAccountPage(searchParams.get("receber_pagina"));
  const origin = normalizeReceivableOrigin(searchParams.get("receber_origem"));
  const status = normalizeReceivableStatus(searchParams.get("receber_situacao"));
  const startDate = normalizeFinancialAccountDate(searchParams.get("receber_inicio"));
  const endDate = normalizeFinancialAccountDate(searchParams.get("receber_fim"));
  const periodIsValid = financialAccountDateRangeIsValid(startDate, endDate);

  const { data, isLoading, isFetching, error, refetch } = useContasReceberUnificado({
    page,
    search: deferredSearch,
    origem: origin,
    status,
    dataInicio: startDate,
    dataFim: endDate,
    enabled: periodIsValid,
  });
  const accounts = data?.items ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const totalPages = Math.max(1, Math.ceil(total / FINANCIAL_ACCOUNT_PAGE_SIZE));
  const firstVisible = total === 0 ? 0 : (page - 1) * FINANCIAL_ACCOUNT_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * FINANCIAL_ACCOUNT_PAGE_SIZE, total);
  const hasFilters = Boolean(search || origin !== "todos" || status !== "todos" || startDate || endDate);

  const updateFilters = useCallback((updates: {
    search?: string;
    origin?: ReceivableOriginFilter;
    status?: ReceivableStatusFilter;
    startDate?: string;
    endDate?: string;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string | undefined, defaultValue = "") => {
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
    };
    if (updates.search !== undefined) setOrDelete("receber_q", updates.search.trim());
    if (updates.origin !== undefined) setOrDelete("receber_origem", updates.origin, "todos");
    if (updates.status !== undefined) setOrDelete("receber_situacao", updates.status, "todos");
    if (updates.startDate !== undefined) setOrDelete("receber_inicio", updates.startDate);
    if (updates.endDate !== undefined) setOrDelete("receber_fim", updates.endDate);
    if (updates.page !== undefined) setOrDelete("receber_pagina", updates.page > 1 ? String(updates.page) : "");
    if (
      updates.search !== undefined
      || updates.origin !== undefined
      || updates.status !== undefined
      || updates.startDate !== undefined
      || updates.endDate !== undefined
    ) next.delete("receber_pagina");
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
    return "Todos os vencimentos";
  }, [endDate, startDate]);

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="flex min-h-28 items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A receber</p>
              <p className="mt-1 truncate text-2xl font-black text-amber-700">R$ {formatNumberToCurrency(summary.valor_aberto)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.quantidade_aberta} título(s) · recorte filtrado</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700">
              <DollarSign className="h-5 w-5" />
            </span>
          </Card>
          <Card className="flex min-h-28 items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recebido</p>
              <p className="mt-1 truncate text-2xl font-black text-success">R$ {formatNumberToCurrency(summary.valor_recebido)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.quantidade_recebida} título(s) · recorte filtrado</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <CheckCircle className="h-5 w-5" />
            </span>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/70">
          <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black">Contas a receber</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Origens consolidadas sem duplicar venda, fatura ou recebimento.</p>
            </div>
            <Button className="min-h-11 w-full gap-2 bg-success font-bold hover:bg-success/90 lg:w-auto" onClick={() => setShowNovaCobranca(true)}>
              <Plus className="h-4 w-4" /> Nova cobrança Asaas
            </Button>
          </div>

          <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_170px_160px_150px_150px_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar contas a receber"
                className="min-h-11 pl-9"
                placeholder="Descrição ou cliente"
                value={search}
                onChange={(event) => updateFilters({ search: event.target.value })}
              />
            </div>
            <Select value={origin} onValueChange={(value) => updateFilters({ origin: value as ReceivableOriginFilter })}>
              <SelectTrigger className="min-h-11" aria-label="Filtrar contas a receber por origem"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                <SelectItem value="fatura">Faturas</SelectItem>
                <SelectItem value="pdv_loja">PDV Doméstico</SelectItem>
                <SelectItem value="pdv_industrial">PDV Industrial</SelectItem>
                <SelectItem value="asaas">Asaas</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => updateFilters({ status: value as ReceivableStatusFilter })}>
              <SelectTrigger className="min-h-11" aria-label="Filtrar contas a receber por situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="atrasado">Atrasadas</SelectItem>
                <SelectItem value="parcial">Parciais</SelectItem>
                <SelectItem value="recebido">Recebidas</SelectItem>
                <SelectItem value="cancelado">Canceladas</SelectItem>
                <SelectItem value="estornado">Estornadas</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="receivable-start-date">Vencimento inicial</Label>
              <Input id="receivable-start-date" className="min-h-11" type="date" value={startDate ?? ""} onChange={(event) => updateFilters({ startDate: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="receivable-end-date">Vencimento final</Label>
              <Input id="receivable-end-date" className="min-h-11" type="date" value={endDate ?? ""} onChange={(event) => updateFilters({ endDate: event.target.value })} />
            </div>
            {hasFilters && (
              <Button variant="ghost" className="min-h-11 gap-2 self-end" onClick={() => updateFilters({ search: "", origin: "todos", status: "todos", startDate: "", endDate: "" })}>
                <RotateCcw className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
            <span>{periodLabel} · {origin === "todos" ? "Todas as origens" : originInfo(origin).label}</span>
            {isFetching && !isLoading && <span role="status" aria-live="polite">Atualizando…</span>}
          </div>

          {!periodIsValid ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Período inválido</AlertTitle>
              <AlertDescription>A data inicial precisa ser anterior ou igual à data final.</AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="sr-only">Carregando contas a receber</span>
            </div>
          ) : error ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não foi possível carregar as contas a receber</AlertTitle>
              <AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>O erro não foi convertido em saldo zero. Atualize a consulta para tentar novamente.</span>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
              </AlertDescription>
            </Alert>
          ) : accounts.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
              <Receipt className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold">Nenhuma conta encontrada</p>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou registre uma nova cobrança.</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Descrição</TableHead><TableHead>Cliente</TableHead><TableHead>Origem</TableHead>
                      <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Vencimento</TableHead><TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => {
                      const accountOrigin = originInfo(account.origem);
                      const OriginIcon = accountOrigin.icon;
                      const balance = Math.max(Number(account.valor) - Number(account.valor_recebido), 0);
                      return (
                        <TableRow key={`${account.origem}-${account.id}`}>
                          <TableCell className="font-bold">{account.descricao}</TableCell>
                          <TableCell className="text-muted-foreground">{account.cliente_nome || "—"}</TableCell>
                          <TableCell><Badge variant="outline" className={`gap-1 text-xs ${accountOrigin.className}`}><OriginIcon className="h-3 w-3" />{accountOrigin.label}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">R$ {formatNumberToCurrency(Number(account.valor))}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-700">R$ {formatNumberToCurrency(balance)}</TableCell>
                          <TableCell>{formatDate(account.data_vencimento)}</TableCell>
                          <TableCell><StatusBadge variant={statusVariant(account.status)}>{statusLabel(account.status)}</StatusBadge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-3 p-4 lg:hidden">
                {accounts.map(account => <ReceivableMobileCard key={`${account.origem}-${account.id}`} account={account} />)}
              </div>
            </>
          )}

          {periodIsValid && !isLoading && !error && total > 0 && (
            <div className="flex flex-col gap-3 border-t bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de contas a receber">
              <p className="text-sm text-muted-foreground">Exibindo {firstVisible}–{lastVisible} de {total} contas a receber</p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button variant="outline" size="sm" className="min-h-10" aria-label="Página anterior de contas a receber" disabled={page <= 1 || isFetching} onClick={() => updateFilters({ page: page - 1 })}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
                </Button>
                <span className="whitespace-nowrap text-sm font-medium">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" className="min-h-10" aria-label="Próxima página de contas a receber" disabled={page >= totalPages || isFetching} onClick={() => updateFilters({ page: page + 1 })}>
                  Próxima <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <NovaCobrancaModal open={showNovaCobranca} onOpenChange={setShowNovaCobranca} />
    </>
  );
};

export default ContasReceberContent;
