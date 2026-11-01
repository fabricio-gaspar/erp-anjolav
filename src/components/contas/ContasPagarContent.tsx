import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { EditarContaPagarModal } from "@/components/contas/EditarContaPagarModal";
import { NovaContaPagarModal } from "@/components/contas/NovaContaPagarModal";
import { RegistrarPagamentoContaModal } from "@/components/contas/RegistrarPagamentoContaModal";
import {
  criarChaveOperacaoFinanceira,
  useContasPagar,
  type ContaPagar,
} from "@/hooks/useContasPagar";
import {
  useContasPagarDirectory,
  type ContaPagarDirectoryItem,
} from "@/hooks/useContasPagarDirectory";
import { formatNumberToCurrency } from "@/lib/currencyUtils";
import {
  FINANCIAL_ACCOUNT_PAGE_SIZE,
  financialAccountDateRangeIsValid,
  normalizeFinancialAccountDate,
  normalizeFinancialAccountPage,
  normalizePayableStatus,
  type PayableStatusFilter,
} from "@/lib/financialAccountDirectory";

const EMPTY_SUMMARY = {
  quantidade: 0,
  quantidade_aberta: 0,
  quantidade_vencida: 0,
  valor_aberto: 0,
  valor_pago: 0,
  valor_vencido: 0,
};

function accountStatus(status: ContaPagarDirectoryItem["status_exibicao"]) {
  if (status === "cancelado") return { label: "Cancelada", variant: "default" as const };
  if (status === "pago") return { label: "Paga", variant: "success" as const };
  if (status === "atrasado") return { label: "Atrasada", variant: "danger" as const };
  if (status === "parcial") return { label: "Parcial", variant: "info" as const };
  return { label: "Pendente", variant: "warning" as const };
}

const ContasPagarContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<ContaPagar | null>(null);
  const [accountToPay, setAccountToPay] = useState<ContaPagar | null>(null);
  const [accountToCancel, setAccountToCancel] = useState<ContaPagar | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const cancelIdempotencyKey = useRef(criarChaveOperacaoFinanceira("payable-cancel"));

  const search = searchParams.get("pagar_q") ?? "";
  const deferredSearch = useDeferredValue(search);
  const page = normalizeFinancialAccountPage(searchParams.get("pagar_pagina"));
  const status = normalizePayableStatus(searchParams.get("pagar_situacao"));
  const startDate = normalizeFinancialAccountDate(searchParams.get("pagar_inicio"));
  const endDate = normalizeFinancialAccountDate(searchParams.get("pagar_fim"));
  const periodIsValid = financialAccountDateRangeIsValid(startDate, endDate);

  const { cancelarConta } = useContasPagar(false);
  const { data, isLoading, isFetching, error, refetch } = useContasPagarDirectory({
    page,
    search: deferredSearch,
    status,
    startDate,
    endDate,
    enabled: periodIsValid,
  });
  const accounts = data?.items ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary ?? EMPTY_SUMMARY;
  const totalPages = Math.max(1, Math.ceil(total / FINANCIAL_ACCOUNT_PAGE_SIZE));
  const firstVisible = total === 0 ? 0 : (page - 1) * FINANCIAL_ACCOUNT_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * FINANCIAL_ACCOUNT_PAGE_SIZE, total);
  const hasFilters = Boolean(search || status !== "todos" || startDate || endDate);

  const updateFilters = useCallback((updates: {
    search?: string;
    status?: PayableStatusFilter;
    startDate?: string;
    endDate?: string;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string | undefined, defaultValue = "") => {
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
    };
    if (updates.search !== undefined) setOrDelete("pagar_q", updates.search.trim());
    if (updates.status !== undefined) setOrDelete("pagar_situacao", updates.status, "todos");
    if (updates.startDate !== undefined) setOrDelete("pagar_inicio", updates.startDate);
    if (updates.endDate !== undefined) setOrDelete("pagar_fim", updates.endDate);
    if (updates.page !== undefined) setOrDelete("pagar_pagina", updates.page > 1 ? String(updates.page) : "");
    if (
      updates.search !== undefined
      || updates.status !== undefined
      || updates.startDate !== undefined
      || updates.endDate !== undefined
    ) next.delete("pagar_pagina");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (isLoading || total === 0 || page <= totalPages) return;
    updateFilters({ page: totalPages });
  }, [isLoading, page, total, totalPages, updateFilters]);

  const periodLabel = useMemo(() => {
    if (startDate && endDate) return `${format(parseISO(startDate), "dd/MM/yyyy")} a ${format(parseISO(endDate), "dd/MM/yyyy")}`;
    if (startDate) return `Desde ${format(parseISO(startDate), "dd/MM/yyyy")}`;
    if (endDate) return `Até ${format(parseISO(endDate), "dd/MM/yyyy")}`;
    return "Todos os vencimentos";
  }, [endDate, startDate]);

  const openCancellation = (account: ContaPagar) => {
    setAccountToCancel(account);
    setCancelReason("");
    cancelIdempotencyKey.current = criarChaveOperacaoFinanceira("payable-cancel");
  };

  const confirmCancellation = async () => {
    if (!accountToCancel || cancelReason.trim().length < 5) return;
    try {
      await cancelarConta.mutateAsync({
        id: accountToCancel.id,
        motivo: cancelReason,
        versao: accountToCancel.versao,
        idempotencyKey: cancelIdempotencyKey.current,
      });
      setAccountToCancel(null);
      setCancelReason("");
    } catch {
      // The mutation displays the error and keeps the confirmation open.
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="flex min-h-28 items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A pagar</p>
              <p className="mt-1 truncate text-2xl font-black text-foreground">R$ {formatNumberToCurrency(summary.valor_aberto)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.quantidade_aberta} obrigação(ões) · recorte filtrado</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleDollarSign className="h-5 w-5" /></span>
          </Card>
          <Card className="flex min-h-28 items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Vencido</p>
              <p className="mt-1 truncate text-2xl font-black text-destructive">R$ {formatNumberToCurrency(summary.valor_vencido)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{summary.quantidade_vencida} obrigação(ões) · recorte filtrado</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><CalendarClock className="h-5 w-5" /></span>
          </Card>
          <Card className="flex min-h-28 items-center justify-between p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Pago</p>
              <p className="mt-1 truncate text-2xl font-black text-success">R$ {formatNumberToCurrency(summary.valor_pago)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Eventos confirmados · recorte filtrado</p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></span>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border/70">
          <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" /><h2 className="text-lg font-black">Obrigações e pagamentos</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">Pagamentos parciais permanecem auditáveis e não reescrevem o valor original.</p>
            </div>
            <Button className="min-h-11 w-full gap-2 font-bold lg:w-auto" onClick={() => setIsNewAccountOpen(true)}><Plus className="h-4 w-4" /> Nova despesa</Button>
          </div>

          <div className="grid gap-3 border-b p-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_160px_160px_auto]">
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar contas a pagar" className="min-h-11 pl-9" placeholder="Descrição ou fornecedor" value={search} onChange={(event) => updateFilters({ search: event.target.value })} />
            </div>
            <Select value={status} onValueChange={(value) => updateFilters({ status: value as PayableStatusFilter })}>
              <SelectTrigger className="min-h-11" aria-label="Filtrar contas por situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="parcial">Parciais</SelectItem><SelectItem value="atrasado">Atrasadas</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem><SelectItem value="cancelado">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payable-start-date">Vencimento inicial</Label>
              <Input id="payable-start-date" className="min-h-11" type="date" value={startDate ?? ""} onChange={(event) => updateFilters({ startDate: event.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="payable-end-date">Vencimento final</Label>
              <Input id="payable-end-date" className="min-h-11" type="date" value={endDate ?? ""} onChange={(event) => updateFilters({ endDate: event.target.value })} />
            </div>
            {hasFilters && <Button variant="ghost" className="min-h-11 gap-2 self-end" onClick={() => updateFilters({ search: "", status: "todos", startDate: "", endDate: "" })}><RotateCcw className="h-4 w-4" /> Limpar</Button>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/10 px-4 py-2 text-xs text-muted-foreground">
            <span>{periodLabel} · resumo e lista usam o mesmo recorte</span>
            {isFetching && !isLoading && <span role="status" aria-live="polite">Atualizando…</span>}
          </div>

          {!periodIsValid ? (
            <Alert variant="destructive" className="m-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Período inválido</AlertTitle><AlertDescription>A data inicial precisa ser anterior ou igual à data final.</AlertDescription></Alert>
          ) : isLoading ? (
            <div className="flex min-h-64 items-center justify-center" role="status" aria-live="polite"><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="sr-only">Carregando contas a pagar</span></div>
          ) : error ? (
            <Alert variant="destructive" className="m-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Não foi possível carregar as contas a pagar</AlertTitle><AlertDescription className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><span>O erro não foi convertido em saldo zero. Atualize a consulta para tentar novamente.</span><Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button></AlertDescription></Alert>
          ) : accounts.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><ReceiptText className="mb-3 h-10 w-10 text-muted-foreground/50" /><p className="font-semibold">Nenhuma conta encontrada</p><p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou registre uma nova despesa.</p></div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(120px,1fr)_130px_130px_150px] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground lg:grid">
                <span>Despesa</span><span>Fornecedor</span><span>Saldo</span><span>Situação</span><span className="text-right">Ações</span>
              </div>
              <div className="divide-y">
                {accounts.map((account) => {
                  const accountState = accountStatus(account.status_exibicao);
                  const balance = Math.max(Number(account.valor) - Number(account.valor_pago || 0), 0);
                  const canChangeTerms = Number(account.valor_pago) <= 0 && account.status !== "cancelado";
                  const canPay = account.status === "pendente" || account.status === "parcial";
                  return (
                    <article key={account.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,2fr)_minmax(120px,1fr)_130px_130px_150px] lg:items-center lg:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-bold text-foreground">{account.descricao}</h3><span className="lg:hidden"><StatusBadge variant={accountState.variant}>{accountState.label}</StatusBadge></span></div>
                        <p className="mt-1 text-sm text-muted-foreground">Vence em {format(parseISO(account.vencimento), "dd/MM/yyyy")}{account.categoria ? ` · ${account.categoria}` : ""}</p>
                      </div>
                      <p className="text-sm text-muted-foreground"><span className="mr-1 font-semibold text-foreground lg:hidden">Fornecedor:</span>{account.fornecedor || "Não informado"}</p>
                      <div><p className="font-black text-foreground">R$ {formatNumberToCurrency(balance)}</p>{Number(account.valor_pago) > 0 && <p className="text-xs text-success">R$ {formatNumberToCurrency(Number(account.valor_pago))} pago</p>}</div>
                      <div className="hidden lg:block"><StatusBadge variant={accountState.variant}>{accountState.label}</StatusBadge></div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {canPay && <Button size="sm" className="min-h-10 flex-1 lg:flex-none" onClick={() => setAccountToPay(account)}>Pagar</Button>}
                        {canChangeTerms && <Button variant="outline" size="icon" className="h-10 w-10" aria-label={`Editar ${account.descricao}`} onClick={() => setAccountToEdit(account)}><Pencil className="h-4 w-4" /></Button>}
                        {canChangeTerms && <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:text-destructive" aria-label={`Cancelar ${account.descricao}`} onClick={() => openCancellation(account)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {periodIsValid && !isLoading && !error && total > 0 && (
            <div className="flex flex-col gap-3 border-t bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de contas a pagar">
              <p className="text-sm text-muted-foreground">Exibindo {firstVisible}–{lastVisible} de {total} contas a pagar</p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button variant="outline" size="sm" className="min-h-10" aria-label="Página anterior de contas a pagar" disabled={page <= 1 || isFetching} onClick={() => updateFilters({ page: page - 1 })}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button>
                <span className="whitespace-nowrap text-sm font-medium">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" className="min-h-10" aria-label="Próxima página de contas a pagar" disabled={page >= totalPages || isFetching} onClick={() => updateFilters({ page: page + 1 })}>Próxima <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <NovaContaPagarModal open={isNewAccountOpen} onOpenChange={setIsNewAccountOpen} />
      <EditarContaPagarModal open={Boolean(accountToEdit)} onOpenChange={(nextOpen) => { if (!nextOpen) setAccountToEdit(null); }} conta={accountToEdit} />
      <RegistrarPagamentoContaModal open={Boolean(accountToPay)} onOpenChange={(nextOpen) => { if (!nextOpen) setAccountToPay(null); }} conta={accountToPay} />

      <AlertDialog open={Boolean(accountToCancel)} onOpenChange={(nextOpen) => { if (!nextOpen) setAccountToCancel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancelar despesa</AlertDialogTitle><AlertDialogDescription>O lançamento será preservado no histórico e deixará de compor o saldo a pagar.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><Label htmlFor="payable-cancel-reason">Motivo do cancelamento *</Label><Textarea id="payable-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Ex.: lançamento duplicado" rows={3} /></div>
          <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" disabled={cancelReason.trim().length < 5 || cancelarConta.isPending} onClick={(event) => { event.preventDefault(); void confirmCancellation(); }}>{cancelarConta.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cancelar despesa</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ContasPagarContent;
