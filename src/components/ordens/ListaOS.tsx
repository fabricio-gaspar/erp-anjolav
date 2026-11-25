import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Eye,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { useOrderDirectory } from "@/hooks/useOrderDirectory";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  classifyRolReportPayment,
  classifyRolReportStatus,
  hasActiveOrderDirectoryFilters,
  normalizeOrderDirectoryDate,
  normalizeOrderDirectoryFilter,
  normalizeOrderDirectoryPage,
  ORDER_DIRECTORY_PAGE_SIZE,
  ORDER_REPORT_PAYMENT_FILTERS,
  ORDER_ROL_STATUS_FILTERS,
  type OrderDirectoryFilters,
  type OrderReportPaymentFilter,
  type OrderRolStatusFilter,
  type RolReportStatus,
} from "@/lib/orderDirectory";
import { DetalhesOS } from "./DetalhesOS";
import { downloadCsv } from "@/lib/csvExport";

interface ListaOSProps {
  onNovaOS: () => void;
}

const rolStatusLabels: Record<OrderRolStatusFilter | "cancelado", string> = {
  all: "Todos os ROLs",
  entregue: "ROL entregue",
  nao_entregue: "ROL não entregue",
  retirado: "ROL retirado",
  a_retirar: "ROL a retirar",
  cancelado: "Cancelado",
};

const paymentLabels: Record<OrderReportPaymentFilter, string> = {
  all: "Todos os pagamentos",
  pago: "Pago",
  nao_pago: "Não pago",
};

const rolStatusVariants: Record<RolReportStatus, "info" | "success" | "warning" | "danger" | "default"> = {
  entregue: "success",
  nao_entregue: "warning",
  retirado: "info",
  a_retirar: "success",
  cancelado: "danger",
};

export function ListaOS({ onNovaOS }: ListaOSProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const selectedOSId = searchParams.get("id");
  const page = normalizeOrderDirectoryPage(searchParams.get("pagina"));

  const filters: OrderDirectoryFilters = {
    rolStatus: normalizeOrderDirectoryFilter(searchParams.get("situacao"), ORDER_ROL_STATUS_FILTERS, "all"),
    payment: normalizeOrderDirectoryFilter(searchParams.get("pagamento"), ORDER_REPORT_PAYMENT_FILTERS, "all"),
    dataInicio: normalizeOrderDirectoryDate(searchParams.get("inicio")),
    dataFim: normalizeOrderDirectoryDate(searchParams.get("fim")),
  };
  const {
    data: directory,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOrderDirectory({
    page,
    pageSize: ORDER_DIRECTORY_PAGE_SIZE,
    filters,
    enabled: !selectedOSId,
  });
  const orders = directory?.orders ?? [];
  const totalOrders = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDER_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalOrders === 0 ? 0 : (page - 1) * ORDER_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * ORDER_DIRECTORY_PAGE_SIZE, totalOrders);
  const hasFilters = hasActiveOrderDirectoryFilters(filters);

  const updateListParams = (
    updates: Partial<OrderDirectoryFilters> & { page?: number; selectedId?: string | null },
  ) => {
    const next = new URLSearchParams(searchParams);
    if (updates.rolStatus !== undefined) {
      if (updates.rolStatus === "all") next.delete("situacao");
      else next.set("situacao", updates.rolStatus);
    }
    if (updates.payment !== undefined) {
      if (updates.payment === "all") next.delete("pagamento");
      else next.set("pagamento", updates.payment);
    }
    if (updates.dataInicio !== undefined) {
      if (updates.dataInicio) next.set("inicio", updates.dataInicio);
      else next.delete("inicio");
    }
    if (updates.dataFim !== undefined) {
      if (updates.dataFim) next.set("fim", updates.dataFim);
      else next.delete("fim");
    }
    const changesFilter = ["rolStatus", "payment", "dataInicio", "dataFim"]
      .some((key) => updates[key as keyof OrderDirectoryFilters] !== undefined);
    if (changesFilter) next.delete("pagina");
    else if (updates.page !== undefined) {
      if (updates.page > 1) next.set("pagina", String(updates.page));
      else next.delete("pagina");
    }
    if (updates.selectedId !== undefined) {
      if (updates.selectedId) next.set("id", updates.selectedId);
      else next.delete("id");
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => updateListParams({
    rolStatus: "all",
    payment: "all",
    dataInicio: "",
    dataFim: "",
  });

  const exportCurrentPage = () => {
    downloadCsv(`rols-${activeArea}-pagina-${page}.csv`, orders, [
      { header: "ROL", value: (order) => order.numero },
      { header: "Cliente", value: (order) => order.cliente?.razao_social },
      { header: "Operação", value: (order) => order.cliente?.classificacao === "industrial" ? "Industrial" : "Doméstico" },
      { header: "Entrada/retirada", value: (order) => order.data_retirada },
      { header: "Situação do ROL", value: (order) => rolStatusLabels[classifyRolReportStatus(order.status)] },
      { header: "Pagamento", value: (order) => paymentLabels[classifyRolReportPayment(order.status_pagamento)] },
      { header: "Valor total", value: (order) => order.valor_total },
    ]);
  };

  useEffect(() => {
    if (selectedOSId || isLoading || error || !directory || page <= totalPages) return;
    const next = new URLSearchParams(searchParams);
    if (totalPages > 1) next.set("pagina", String(totalPages));
    else next.delete("pagina");
    setSearchParams(next, { replace: true });
  }, [directory, error, isLoading, page, searchParams, selectedOSId, setSearchParams, totalPages]);

  if (selectedOSId) {
    return (
      <DetalhesOS
        ordemServicoId={selectedOSId}
        onBack={() => updateListParams({ selectedId: null })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Relatório de ROLs</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte os ROLs por período de entrada, situação e pagamento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCurrentPage} disabled={orders.length === 0} className="h-10 gap-2">
              <Download className="h-4 w-4" />Exportar página
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 gap-2">
                <RotateCcw className="h-4 w-4" />Limpar filtros
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="grid gap-1.5 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Data inicial</span>
            <Input
              type="date"
              value={filters.dataInicio}
              max={filters.dataFim || undefined}
              onChange={(event) => updateListParams({
                dataInicio: event.target.value,
                ...(filters.dataFim && event.target.value > filters.dataFim ? { dataFim: "" } : {}),
              })}
              className="h-11"
              aria-label="Data inicial do período de entrada"
            />
          </div>
          <div className="grid gap-1.5 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />Data final</span>
            <Input
              type="date"
              value={filters.dataFim}
              min={filters.dataInicio || undefined}
              onChange={(event) => updateListParams({
                dataFim: event.target.value,
                ...(filters.dataInicio && event.target.value && event.target.value < filters.dataInicio ? { dataInicio: "" } : {}),
              })}
              className="h-11"
              aria-label="Data final do período de entrada"
            />
          </div>
          <div className="grid gap-1.5 text-sm font-medium text-foreground">
            <span>Situação do ROL</span>
            <DirectorySelect
              value={filters.rolStatus}
              label="Filtrar por situação do ROL"
              options={ORDER_ROL_STATUS_FILTERS.map((value) => ({ value, label: rolStatusLabels[value] }))}
              onChange={(value) => updateListParams({ rolStatus: value as OrderRolStatusFilter })}
            />
          </div>
          <div className="grid gap-1.5 text-sm font-medium text-foreground">
            <span>Pagamento</span>
            <DirectorySelect
              value={filters.payment}
              label="Filtrar por pagamento"
              options={ORDER_REPORT_PAYMENT_FILTERS.map((value) => ({ value, label: paymentLabels[value] }))}
              onChange={(value) => updateListParams({ payment: value as OrderReportPaymentFilter })}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          “ROL não entregue” reúne ROLs em atendimento ou produção. “A retirar” indica ROLs prontos para retirada.
        </p>
      </section>

      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando os ROLs…</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando ROLs...</span>
        </div>
      ) : error ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center" role="alert">
          <div>
            <CircleAlert className="mx-auto h-7 w-7 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Não foi possível carregar os ROLs</p>
            <p className="mt-1 text-sm text-muted-foreground">A consulta falhou e nenhum total foi tratado como zero.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">Tentar novamente</Button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center">
          <p className="font-semibold">{hasFilters ? "Nenhum ROL corresponde aos filtros" : "Nenhum ROL cadastrado"}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? "Revise os critérios ou limpe os filtros para consultar todo o histórico deste painel."
              : "Crie o primeiro ROL para iniciar o atendimento e acompanhar sua operação."}
          </p>
          <Button variant="link" onClick={hasFilters ? clearFilters : onNovaOS} className="mt-1 font-semibold">
            {hasFilters ? "Limpar filtros" : "Criar primeiro ROL"}
          </Button>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          aria-label="Tabela de ROLs; deslize horizontalmente para ver todas as colunas"
          tabIndex={0}
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">ROL</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Entrada</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Situação</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Pagamento</TableHead>
                <TableHead className="text-right text-xs font-medium uppercase text-muted-foreground">Valor</TableHead>
                <TableHead className="text-center text-xs font-medium uppercase text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const rolStatus = classifyRolReportStatus(order.status);
                const paymentStatus = classifyRolReportPayment(order.status_pagamento);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium text-primary">ROL {order.numero}</TableCell>
                    <TableCell>{order.cliente?.razao_social || "-"}</TableCell>
                    <TableCell>{format(parseISO(order.data_retirada), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell><StatusBadge variant={rolStatusVariants[rolStatus]}>{rolStatusLabels[rolStatus]}</StatusBadge></TableCell>
                    <TableCell><StatusBadge variant={paymentStatus === "pago" ? "success" : "warning"}>{paymentLabels[paymentStatus]}</StatusBadge></TableCell>
                    <TableCell className="text-right font-medium">
                      {(order.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => updateListParams({ selectedId: order.id })}
                          aria-label={`Abrir ROL ${order.numero}`}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {order.status !== "entregue" && order.status !== "cancelada" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => updateListParams({ selectedId: order.id })}
                            aria-label={`Continuar ROL ${order.numero}`}
                          >
                            <ArrowRight className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && !error && totalOrders > 0 && (
        <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de ROLs">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalOrders} ROLs
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => updateListParams({ page: page - 1 })}
              disabled={page <= 1 || isFetching}
              aria-label="Página anterior de ROLs"
            >
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Anterior</span>
            </Button>
            <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">Página {page} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => updateListParams({ page: page + 1 })}
              disabled={page >= totalPages || isFetching}
              aria-label="Próxima página de ROLs"
            >
              <span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function DirectorySelect({
  value,
  label,
  options,
  onChange,
}: {
  value: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-full bg-background text-left" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
