import { useDeferredValue, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  Loader2,
  RotateCcw,
  Search,
  UserRoundSearch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { useOrderDirectory } from "@/hooks/useOrderDirectory";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  hasActiveOrderDirectoryFilters,
  normalizeOrderDirectoryFilter,
  normalizeOrderDirectoryPage,
  ORDER_DEADLINE_FILTERS,
  ORDER_DIRECTORY_PAGE_SIZE,
  ORDER_FISCAL_FILTERS,
  ORDER_LOGISTICS_FILTERS,
  ORDER_OPERATIONAL_FILTERS,
  ORDER_PAYMENT_FILTERS,
  ORDER_QUALITY_FILTERS,
  type OrderDeadlineFilter,
  type OrderDirectoryFilters,
  type OrderFiscalFilter,
  type OrderLogisticsFilter,
  type OrderOperationalFilter,
  type OrderPaymentFilter,
  type OrderQualityFilter,
} from "@/lib/orderDirectory";
import { DetalhesOS } from "./DetalhesOS";

interface ListaOSProps {
  onNovaOS: () => void;
}

const statusConfig: Record<string, { label: string; variant: "info" | "success" | "warning" | "danger" | "default" }> = {
  retirada: { label: "Retirado", variant: "info" },
  separacao: { label: "Separação", variant: "warning" },
  lavagem: { label: "Lavagem", variant: "warning" },
  secagem: { label: "Secagem", variant: "warning" },
  passadoria: { label: "Passadoria", variant: "warning" },
  embalagem: { label: "Embalagem", variant: "info" },
  expedicao: { label: "Pronto para entrega", variant: "success" },
  entregue: { label: "Entregue", variant: "success" },
  cancelada: { label: "Cancelada", variant: "danger" },
};

const operationalLabels: Record<OrderOperationalFilter, string> = {
  all: "Todas as operações",
  open: "Em aberto",
  retirada: "Retirado",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Pronto para entrega",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const paymentLabels: Record<OrderPaymentFilter, string> = {
  all: "Todos os pagamentos",
  pendente: "Pagamento pendente",
  parcial: "Pagamento parcial",
  pago: "Pagamento concluído",
};

const qualityLabels: Record<OrderQualityFilter, string> = {
  all: "Toda qualidade",
  nao_iniciada: "Qualidade não iniciada",
  em_analise: "Qualidade em análise",
  aprovada: "Qualidade aprovada",
  com_pendencias: "Qualidade com pendências",
};

const logisticsLabels: Record<OrderLogisticsFilter, string> = {
  all: "Toda logística",
  nao_iniciada: "Logística não iniciada",
  aguardando_coleta: "Aguardando coleta",
  coletado: "Coletado",
  aguardando_entrega: "Aguardando entrega",
  em_rota: "Em rota",
  entrega_parcial: "Entrega parcial",
  entregue: "Entrega concluída",
  tentativa_falha: "Tentativa sem sucesso",
  cancelada: "Logística cancelada",
};

const fiscalLabels: Record<OrderFiscalFilter, string> = {
  all: "Toda situação fiscal",
  nao_aplicavel: "Fiscal não aplicável",
  pendente: "Fiscal pendente",
  emitida: "Fiscal emitida",
  cancelada: "Fiscal cancelada",
};

const deadlineLabels: Record<OrderDeadlineFilter, string> = {
  all: "Todos os prazos",
  late: "Prazo vencido",
  today: "Entrega hoje",
  next_7_days: "Próximos 7 dias",
  without_deadline: "Sem previsão",
};

export function ListaOS({ onNovaOS }: ListaOSProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const selectedOSId = searchParams.get("id");
  const page = normalizeOrderDirectoryPage(searchParams.get("pagina"));
  const operationalParam = searchParams.get("status") === "abertas"
    ? "open"
    : searchParams.get("status");
  const deadlineParam = searchParams.get("prazo") === "atrasado"
    ? "late"
    : searchParams.get("prazo") === "proximos_7"
      ? "next_7_days"
      : searchParams.get("prazo") === "sem_previsao"
        ? "without_deadline"
        : searchParams.get("prazo");

  const filters: OrderDirectoryFilters = {
    orderSearch: searchParams.get("q") ?? "",
    clientSearch: searchParams.get("cliente") ?? "",
    responsibleSearch: searchParams.get("responsavel") ?? "",
    operational: normalizeOrderDirectoryFilter(operationalParam, ORDER_OPERATIONAL_FILTERS, "all"),
    payment: normalizeOrderDirectoryFilter(searchParams.get("pagamento"), ORDER_PAYMENT_FILTERS, "all"),
    quality: normalizeOrderDirectoryFilter(searchParams.get("qualidade"), ORDER_QUALITY_FILTERS, "all"),
    logistics: normalizeOrderDirectoryFilter(searchParams.get("logistica"), ORDER_LOGISTICS_FILTERS, "all"),
    fiscal: normalizeOrderDirectoryFilter(searchParams.get("fiscal"), ORDER_FISCAL_FILTERS, "all"),
    deadline: normalizeOrderDirectoryFilter(deadlineParam, ORDER_DEADLINE_FILTERS, "all"),
  };
  const deferredOrderSearch = useDeferredValue(filters.orderSearch);
  const deferredClientSearch = useDeferredValue(filters.clientSearch);
  const deferredResponsibleSearch = useDeferredValue(filters.responsibleSearch);
  const queryFilters: OrderDirectoryFilters = {
    ...filters,
    orderSearch: deferredOrderSearch,
    clientSearch: deferredClientSearch,
    responsibleSearch: deferredResponsibleSearch,
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
    filters: queryFilters,
    enabled: !selectedOSId,
  });
  const orders = directory?.orders ?? [];
  const totalOrders = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / ORDER_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalOrders === 0 ? 0 : (page - 1) * ORDER_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * ORDER_DIRECTORY_PAGE_SIZE, totalOrders);
  const hasFilters = hasActiveOrderDirectoryFilters(filters);
  const areaLabel = activeArea === "industrial" ? "Industrial" : activeArea === "residencial" ? "Doméstico" : "Central";

  const updateListParams = (
    updates: Partial<OrderDirectoryFilters> & { page?: number; selectedId?: string | null },
  ) => {
    const next = new URLSearchParams(searchParams);
    const updateText = (key: "orderSearch" | "clientSearch" | "responsibleSearch", param: string) => {
      if (updates[key] === undefined) return;
      const value = updates[key] ?? "";
      if (value.trim()) next.set(param, value);
      else next.delete(param);
    };
    updateText("orderSearch", "q");
    updateText("clientSearch", "cliente");
    updateText("responsibleSearch", "responsavel");

    if (updates.operational !== undefined) {
      if (updates.operational === "all") next.delete("status");
      else next.set("status", updates.operational === "open" ? "abertas" : updates.operational);
    }
    if (updates.payment !== undefined) {
      if (updates.payment === "all") next.delete("pagamento");
      else next.set("pagamento", updates.payment);
    }
    if (updates.quality !== undefined) {
      if (updates.quality === "all") next.delete("qualidade");
      else next.set("qualidade", updates.quality);
    }
    if (updates.logistics !== undefined) {
      if (updates.logistics === "all") next.delete("logistica");
      else next.set("logistica", updates.logistics);
    }
    if (updates.fiscal !== undefined) {
      if (updates.fiscal === "all") next.delete("fiscal");
      else next.set("fiscal", updates.fiscal);
    }
    if (updates.deadline !== undefined) {
      if (updates.deadline === "all") next.delete("prazo");
      else if (updates.deadline === "late") next.set("prazo", "atrasado");
      else if (updates.deadline === "next_7_days") next.set("prazo", "proximos_7");
      else if (updates.deadline === "without_deadline") next.set("prazo", "sem_previsao");
      else next.set("prazo", updates.deadline);
    }
    const changesFilter = [
      "orderSearch",
      "clientSearch",
      "responsibleSearch",
      "operational",
      "payment",
      "quality",
      "logistics",
      "fiscal",
      "deadline",
    ].some((key) => updates[key as keyof OrderDirectoryFilters] !== undefined);
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
    orderSearch: "",
    clientSearch: "",
    responsibleSearch: "",
    operational: "all",
    payment: "all",
    quality: "all",
    logistics: "all",
    fiscal: "all",
    deadline: "all",
  });

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
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Número do pedido ou ROL"
            value={filters.orderSearch}
            onChange={(event) => updateListParams({ orderSearch: event.target.value })}
            className="h-11 pl-9 text-base sm:text-sm"
            aria-label="Pesquisar pelo número do pedido ou ROL"
          />
        </div>
        <div className="relative min-w-0">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cliente, documento ou telefone"
            value={filters.clientSearch}
            onChange={(event) => updateListParams({ clientSearch: event.target.value })}
            className="h-11 pl-9 text-base sm:text-sm"
            aria-label="Filtrar pedidos por cliente, documento ou telefone"
          />
        </div>
        <div className="relative min-w-0">
          <UserRoundSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Responsável ou motorista"
            value={filters.responsibleSearch}
            onChange={(event) => updateListParams({ responsibleSearch: event.target.value })}
            className="h-11 pl-9 text-base sm:text-sm"
            aria-label="Filtrar pedidos por responsável ou motorista"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-label={`Escopo ${areaLabel}`}>
            <Building2 className="h-4 w-4 text-primary" />
            <span><strong className="font-semibold text-foreground">{areaLabel}</strong> · situações independentes</span>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 justify-start gap-2 sm:justify-center">
              <RotateCcw className="h-4 w-4" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <DirectorySelect
            value={filters.operational}
            label="Filtrar por situação operacional"
            options={ORDER_OPERATIONAL_FILTERS.map((value) => ({ value, label: operationalLabels[value] }))}
            onChange={(value) => updateListParams({ operational: value as OrderOperationalFilter })}
          />
          <DirectorySelect
            value={filters.deadline}
            label="Filtrar por prazo"
            options={ORDER_DEADLINE_FILTERS.map((value) => ({ value, label: deadlineLabels[value] }))}
            onChange={(value) => updateListParams({ deadline: value as OrderDeadlineFilter })}
          />
          <DirectorySelect
            value={filters.payment}
            label="Filtrar por situação de pagamento"
            options={ORDER_PAYMENT_FILTERS.map((value) => ({ value, label: paymentLabels[value] }))}
            onChange={(value) => updateListParams({ payment: value as OrderPaymentFilter })}
          />
          <DirectorySelect
            value={filters.quality}
            label="Filtrar por situação de qualidade"
            options={ORDER_QUALITY_FILTERS.map((value) => ({ value, label: qualityLabels[value] }))}
            onChange={(value) => updateListParams({ quality: value as OrderQualityFilter })}
          />
          <DirectorySelect
            value={filters.logistics}
            label="Filtrar por situação logística"
            options={ORDER_LOGISTICS_FILTERS.map((value) => ({ value, label: logisticsLabels[value] }))}
            onChange={(value) => updateListParams({ logistics: value as OrderLogisticsFilter })}
          />
          <DirectorySelect
            value={filters.fiscal}
            label="Filtrar por situação fiscal"
            options={ORDER_FISCAL_FILTERS.map((value) => ({ value, label: fiscalLabels[value] }))}
            onChange={(value) => updateListParams({ fiscal: value as OrderFiscalFilter })}
          />
        </div>
      </div>

      {isFetching && !isLoading && (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando os pedidos…</p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando pedidos...</span>
        </div>
      ) : error ? (
        <div className="flex min-h-48 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center" role="alert">
          <div>
            <CircleAlert className="mx-auto h-7 w-7 text-destructive" />
            <p className="mt-2 font-semibold text-destructive">Não foi possível carregar os pedidos</p>
            <p className="mt-1 text-sm text-muted-foreground">A consulta falhou e nenhum total foi tratado como zero.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">Tentar novamente</Button>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 py-12 text-center">
          <p className="font-semibold">{hasFilters ? "Nenhum pedido corresponde aos filtros" : "Nenhum pedido cadastrado"}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasFilters
              ? "Revise os critérios ou limpe os filtros para consultar todo o histórico deste painel."
              : "Crie o primeiro pedido para iniciar o atendimento e acompanhar sua operação."}
          </p>
          <Button variant="link" onClick={hasFilters ? clearFilters : onNovaOS} className="mt-1 font-semibold">
            {hasFilters ? "Limpar filtros" : "Criar primeiro pedido"}
          </Button>
        </div>
      ) : (
        <div
          className="overflow-x-auto rounded-lg border"
          role="region"
          aria-label="Tabela de pedidos; deslize horizontalmente para ver todas as colunas"
          tabIndex={0}
        >
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Pedido</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Cliente</TableHead>
                <TableHead className="hidden text-xs font-medium uppercase text-muted-foreground md:table-cell">Motorista</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Retirada</TableHead>
                <TableHead className="hidden text-xs font-medium uppercase text-muted-foreground sm:table-cell">Previsão</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Operação</TableHead>
                <TableHead className="text-xs font-medium uppercase text-muted-foreground">Pendências</TableHead>
                <TableHead className="text-center text-xs font-medium uppercase text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const statusInfo = statusConfig[order.status] || { label: order.status, variant: "default" as const };
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium text-primary">{order.numero}</TableCell>
                    <TableCell>{order.cliente?.razao_social || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{order.motorista?.nome || "-"}</TableCell>
                    <TableCell>{format(parseISO(order.data_retirada), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {order.data_previsao_entrega
                        ? format(parseISO(order.data_previsao_entrega), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell><StatusBadge variant={statusInfo.variant}>{statusInfo.label}</StatusBadge></TableCell>
                    <TableCell>
                      <div className="flex min-w-[150px] flex-wrap gap-1">
                        {order.status_pagamento !== "pago" && (
                          <StatusBadge variant={order.status_pagamento === "parcial" ? "info" : "warning"}>
                            {order.status_pagamento === "parcial" ? "Saldo" : "Pagamento"}
                          </StatusBadge>
                        )}
                        {order.status_qualidade === "com_pendencias" && <StatusBadge variant="warning">Qualidade</StatusBadge>}
                        {order.status_logistica === "entrega_parcial" && <StatusBadge variant="warning">Entrega parcial</StatusBadge>}
                        {order.status_pagamento === "pago"
                          && order.status_qualidade !== "com_pendencias"
                          && order.status_logistica !== "entrega_parcial"
                          && <span className="text-xs text-muted-foreground">Sem bloqueios</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          onClick={() => updateListParams({ selectedId: order.id })}
                          aria-label={`Abrir pedido ${order.numero}`}
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {order.status !== "entregue" && order.status !== "cancelada" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => updateListParams({ selectedId: order.id })}
                            aria-label={`Continuar pedido ${order.numero}`}
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
        <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de pedidos">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalOrders} pedidos
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => updateListParams({ page: page - 1 })}
              disabled={page <= 1 || isFetching}
              aria-label="Página anterior de pedidos"
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
              aria-label="Próxima página de pedidos"
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
