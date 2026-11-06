import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStockMovementDirectory } from "@/hooks/useStockMovementDirectory";
import {
  normalizeStockMovementDirectoryPage,
  normalizeStockMovementDirectorySearchInput,
  normalizeStockMovementDirectoryType,
  sanitizeStockMovementDirectorySearch,
  STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE,
  type StockMovementDirectoryType,
} from "@/lib/stockMovementDirectory";

const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const natureLabels: Record<string, string> = {
  compra_recebimento: "Compra recebida",
  compra_devolucao: "Devolução ao fornecedor",
  transferencia_saida: "Transferência · saída",
  transferencia_entrada: "Transferência · entrada",
  ajuste_entrada: "Ajuste · entrada",
  ajuste_saida: "Ajuste · saída",
  entrada_manual: "Entrada manual",
  saida_manual: "Saída manual",
};

export function MovimentacoesEstoqueWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearch = searchParams.get("mov-busca") ?? "";
  const [search, setSearch] = useState(querySearch);
  const type = normalizeStockMovementDirectoryType(searchParams.get("mov-tipo"));
  const page = normalizeStockMovementDirectoryPage(searchParams.get("mov-pagina"));
  const deferredSearch = useDeferredValue(sanitizeStockMovementDirectorySearch(search));
  const {
    data: directory,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useStockMovementDirectory({
    page,
    pageSize: STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE,
    search: deferredSearch,
    type,
  });
  const items = directory?.items ?? [];
  const totalItems = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalItems === 0 ? 0 : (page - 1) * STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * STOCK_MOVEMENT_DIRECTORY_PAGE_SIZE, totalItems);
  const hasFilters = Boolean(search || type !== "all");

  const updateDirectoryParams = useCallback((updates: {
    query?: string;
    type?: StockMovementDirectoryType;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.query !== undefined) {
      const normalized = normalizeStockMovementDirectorySearchInput(updates.query);
      if (normalized) next.set("mov-busca", normalized);
      else next.delete("mov-busca");
    }
    if (updates.type !== undefined) {
      if (updates.type === "all") next.delete("mov-tipo");
      else next.set("mov-tipo", updates.type);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("mov-pagina", String(updates.page));
      else next.delete("mov-pagina");
    }
    if (updates.query !== undefined || updates.type !== undefined) next.delete("mov-pagina");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearch(querySearch);
  }, [querySearch]);

  useEffect(() => {
    if (isLoading || totalItems === 0 || page <= totalPages) return;
    updateDirectoryParams({ page: totalPages });
  }, [isLoading, page, totalItems, totalPages, updateDirectoryParams]);

  const clearFilters = () => {
    setSearch("");
    updateDirectoryParams({ query: "", type: "all" });
  };

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="space-y-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5" />Histórico auditável</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Entradas, saídas, transferências, compras, devoluções e ajustes com saldos antes e depois.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_190px]">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por insumo, motivo, fornecedor ou local..."
              value={search}
              onChange={(event) => {
                const nextSearch = normalizeStockMovementDirectorySearchInput(event.target.value);
                setSearch(nextSearch);
                updateDirectoryParams({ query: nextSearch });
              }}
              className="pl-9 text-base md:text-sm"
              skipUppercase
              aria-label="Pesquisar movimentações por insumo, motivo, fornecedor ou local"
            />
          </div>
          <Select value={type} onValueChange={(nextType) => updateDirectoryParams({ type: nextType as StockMovementDirectoryType })}>
            <SelectTrigger className="w-full" aria-label="Filtrar movimentações por tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as movimentações</SelectItem>
              <SelectItem value="entrada">Somente entradas</SelectItem>
              <SelectItem value="saida">Somente saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs leading-5 text-muted-foreground">A lista consulta uma página autorizada do histórico; entradas e saídas registradas não podem ser alteradas aqui.</p>
          {hasFilters && <Button variant="ghost" size="sm" className="gap-2" onClick={clearFilters}><RotateCcw className="h-4 w-4" />Limpar filtros</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isFetching && !isLoading && <p className="px-4 pb-3 text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando movimentações…</p>}
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-5 w-5 animate-spin text-primary" />Carregando movimentações…</div>
        ) : isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center" role="alert"><AlertCircle className="h-7 w-7 text-destructive" /><div><p className="font-semibold">Não foi possível carregar as movimentações</p><p className="mt-1 text-sm text-muted-foreground">O histórico não foi convertido em uma lista vazia. Tente novamente.</p></div><Button variant="outline" onClick={() => void refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div>
        ) : items.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><div className="mb-3 rounded-full bg-primary/10 p-3 text-primary"><PackageOpen className="h-7 w-7" /></div><p className="font-semibold">{hasFilters ? "Nenhuma movimentação encontrada" : "Nenhuma movimentação registrada"}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{hasFilters ? "Revise a busca ou limpe os filtros para consultar o histórico autorizado." : "As entradas e saídas aparecerão aqui assim que forem registradas."}</p>{hasFilters && <Button variant="link" onClick={clearFilters}>Limpar filtros</Button>}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block" data-testid="stock-movement-directory-table-scroll">
              <Table className="min-w-[900px]">
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Movimento</TableHead><TableHead>Insumo</TableHead><TableHead>Local</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Saldo local</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
                <TableBody>{items.map((movement) => {
                  const isEntry = movement.tipo === "entrada";
                  const location = isEntry ? movement.local_destino_codigo : movement.local_origem_codigo;
                  return <TableRow key={movement.id}><TableCell><p className="font-medium">{format(new Date(movement.created_at), "dd/MM/yyyy")}</p><p className="text-xs text-muted-foreground">{format(new Date(movement.created_at), "HH:mm")}</p></TableCell><TableCell><Badge variant={isEntry ? "default" : "secondary"} className="gap-1">{isEntry ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}{natureLabels[movement.natureza] || movement.natureza || movement.tipo}</Badge></TableCell><TableCell><p className="max-w-[200px] truncate font-medium" title={movement.produto_nome}>{movement.produto_nome}</p>{movement.fornecedor_nome && <p className="max-w-[200px] truncate text-xs text-muted-foreground">{movement.fornecedor_nome}</p>}</TableCell><TableCell>{location || "—"}</TableCell><TableCell className={isEntry ? "text-right font-semibold text-emerald-600" : "text-right font-semibold text-amber-700 dark:text-amber-300"}>{isEntry ? "+" : "−"}{quantity.format(Number(movement.quantidade))}</TableCell><TableCell className="text-right">{movement.saldo_local_anterior == null ? "—" : `${quantity.format(Number(movement.saldo_local_anterior))} → ${quantity.format(Number(movement.saldo_local_posterior))}`}</TableCell><TableCell className="max-w-[260px] truncate" title={movement.motivo || ""}>{movement.motivo || "—"}</TableCell></TableRow>;
                })}</TableBody>
              </Table>
            </div>
            <div className="grid gap-3 px-3 pb-3 md:hidden" data-testid="stock-movement-directory-cards">
              {items.map((movement) => {
                const isEntry = movement.tipo === "entrada";
                const location = isEntry ? movement.local_destino_codigo : movement.local_origem_codigo;
                return <article key={movement.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{movement.produto_nome}</h3><p className="mt-1 text-xs text-muted-foreground">{format(new Date(movement.created_at), "dd/MM/yyyy 'às' HH:mm")}</p></div><Badge variant={isEntry ? "default" : "secondary"} className="shrink-0">{isEntry ? "Entrada" : "Saída"}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Quantidade</p><p className={isEntry ? "mt-1 font-bold text-emerald-600" : "mt-1 font-bold text-amber-700 dark:text-amber-300"}>{isEntry ? "+" : "−"}{quantity.format(Number(movement.quantidade))}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Local</p><p className="mt-1 break-words font-bold">{location || "—"}</p></div></div><div className="mt-3 space-y-1 text-sm text-muted-foreground"><p className="break-words">{natureLabels[movement.natureza] || movement.natureza || movement.tipo}</p><p className="break-words">Saldo local: {movement.saldo_local_anterior == null ? "—" : `${quantity.format(Number(movement.saldo_local_anterior))} → ${quantity.format(Number(movement.saldo_local_posterior))}`}</p>{movement.motivo && <p className="break-words">{movement.motivo}</p>}</div></article>;
              })}
            </div>
          </>
        )}
        {!isLoading && !isError && totalItems > 0 && <nav className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de movimentações de estoque"><p className="text-sm text-muted-foreground" aria-live="polite">Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalItems} movimentações <span className="hidden lg:inline">· {directory?.summary.entryCount ?? 0} entradas e {directory?.summary.exitCount ?? 0} saídas no recorte</span></p><div className="flex items-center justify-between gap-2 sm:justify-end"><Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de movimentações"><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Anterior</span></Button><span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">Página {page} de {totalPages}</span><Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de movimentações"><span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4" /></Button></div></nav>}
      </CardContent>
    </Card>
  );
}
