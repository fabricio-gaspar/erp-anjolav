import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, FilterX, Loader2, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditEvents, type AuditEventAction } from "@/hooks/useAuditEvents";

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { value: "all", label: "Todas as ações" },
  { value: "INSERT", label: "Criações" },
  { value: "UPDATE", label: "Alterações" },
  { value: "DELETE", label: "Exclusões" },
] as const;

const ENTITY_OPTIONS = [
  { value: "all", label: "Todas as entidades" },
  { value: "asaas_charges", label: "Cobranças" },
  { value: "configuracoes_fiscais", label: "Configurações fiscais" },
  { value: "faturas", label: "Faturas" },
  { value: "ordens_servico", label: "Ordens de Serviço" },
  { value: "pdv_pagamentos", label: "Pagamentos PDV" },
  { value: "tenant_memberships", label: "Vínculos de empresa" },
  { value: "user_roles", label: "Perfis de acesso" },
  { value: "whatsapp_instancias", label: "Integrações WhatsApp" },
] as const;

const ACTION_LABELS: Record<AuditEventAction, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

const ENTITY_LABELS = new Map<string, string>(
  ENTITY_OPTIONS
    .filter((option) => option.value !== "all")
    .map((option) => [option.value, option.label]),
);

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

interface AuditFilterState {
  action: AuditEventAction | "";
  entity: string;
  from: string;
  to: string;
}

const INITIAL_FILTERS: AuditFilterState = {
  action: "",
  entity: "",
  from: "",
  to: "",
};

function actionFromSelect(value: string): AuditEventAction | "" {
  return value === "INSERT" || value === "UPDATE" || value === "DELETE" ? value : "";
}

function entityFromSelect(value: string): string {
  return ENTITY_OPTIONS.some((option) => option.value === value && option.value !== "all")
    ? value
    : "";
}

function formatEntity(table: string): string {
  return ENTITY_LABELS.get(table) ?? "Registro do sistema";
}

function formatAction(action: string): string {
  return action === "INSERT" || action === "UPDATE" || action === "DELETE"
    ? ACTION_LABELS[action]
    : "Ação registrada";
}

function formatOccurredAt(occurredAt: string): string {
  const date = new Date(occurredAt);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : dateTimeFormatter.format(date);
}

export default function Auditoria() {
  const [filters, setFilters] = useState<AuditFilterState>(INITIAL_FILTERS);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([]);
  const {
    data,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useAuditEvents({ cursor, limit: PAGE_SIZE, filters });

  const events = data?.events ?? [];
  const hasFilters = Boolean(filters.action || filters.entity || filters.from || filters.to);
  const previousCursor = cursorHistory[cursorHistory.length - 1] ?? null;

  const updateFilters = (next: Partial<AuditFilterState>) => {
    setFilters((current) => ({ ...current, ...next }));
    setCursor(null);
    setCursorHistory([]);
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCursor(null);
    setCursorHistory([]);
  };

  const goToNextPage = () => {
    if (!data?.nextCursor) return;
    setCursorHistory((history) => [...history, cursor]);
    setCursor(data.nextCursor);
  };

  const goToPreviousPage = () => {
    if (cursorHistory.length === 0) return;
    setCursor(previousCursor);
    setCursorHistory((history) => history.slice(0, -1));
  };

  return (
    <AppLayout title="Auditoria" subtitle="Eventos administrativos da empresa ativa">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Administração</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Registro de auditoria</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Consulta somente leitura das ações registradas para a empresa ativa.
              </p>
            </div>
          </div>
          <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Detalhes e dados sensíveis não são exibidos nesta tela.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Refine os eventos por ação, entidade ou período.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="audit-action">Ação</Label>
                <Select value={filters.action || "all"} onValueChange={(value) => updateFilters({ action: actionFromSelect(value) })}>
                  <SelectTrigger id="audit-action" aria-label="Filtrar por ação">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-entity">Entidade</Label>
                <Select value={filters.entity || "all"} onValueChange={(value) => updateFilters({ entity: entityFromSelect(value) })}>
                  <SelectTrigger id="audit-entity" aria-label="Filtrar por entidade">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-from">A partir de</Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilters({ from: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-to">Até</Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilters({ to: event.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasFilters}>
                <FilterX className="h-4 w-4" aria-hidden="true" />
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6" role="status" aria-live="polite">
                <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Carregando eventos de auditoria…</p>
              </div>
            ) : isError ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
                <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold">Não foi possível carregar os eventos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void refetch()}>
                  Tentar novamente
                </Button>
              </div>
            ) : events.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-6 text-center" role="status" aria-live="polite">
                <ShieldCheck className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                <h2 className="font-semibold">Nenhum evento encontrado</h2>
                <p className="text-sm text-muted-foreground">
                  {hasFilters ? "Ajuste os filtros para ampliar a busca." : "Ainda não há eventos para exibir."}
                </p>
              </div>
            ) : (
              <Table aria-busy={isFetching}>
                <TableCaption className="sr-only">Eventos de auditoria da empresa ativa</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead className="text-right">Data e hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{formatAction(event.action)}</TableCell>
                      <TableCell>{formatEntity(event.entity_table)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatOccurredAt(event.occurred_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação da auditoria">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Página {cursorHistory.length + 1}{isFetching ? " — atualizando…" : ""}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={goToPreviousPage} disabled={cursorHistory.length === 0 || isFetching}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </Button>
            <Button type="button" variant="outline" onClick={goToNextPage} disabled={!data?.nextCursor || isFetching}>
              Próxima
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
