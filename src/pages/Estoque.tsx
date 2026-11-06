import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Archive, ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight, Loader2, PackageOpen, Pencil, Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useEstoque, EstoqueProduto } from "@/hooks/useEstoque";
import { useStockDirectory } from "@/hooks/useStockDirectory";
import { useFornecedores } from "@/hooks/useFornecedores";
import { EstoqueDashboard } from "@/components/estoque/EstoqueDashboard";
import { EntradaEstoqueModal } from "@/components/estoque/EntradaEstoqueModal";
import { SaidaEstoqueModal } from "@/components/estoque/SaidaEstoqueModal";
import { ComprasWorkspace } from "@/components/estoque/ComprasWorkspace";
import { LocaisEstoqueWorkspace } from "@/components/estoque/LocaisEstoqueWorkspace";
import { MovimentacoesEstoqueWorkspace } from "@/components/estoque/MovimentacoesEstoqueWorkspace";
import { toast } from "sonner";
import {
  normalizeStockDirectoryCategory,
  normalizeStockDirectoryPage,
  normalizeStockDirectorySearchInput,
  normalizeStockDirectoryStatus,
  sanitizeStockDirectorySearch,
  STOCK_DIRECTORY_PAGE_SIZE,
  type StockDirectoryStatus,
} from "@/lib/stockDirectory";

const CATEGORIAS = [
  { value: "quimico", label: "Químico" },
  { value: "embalagem", label: "Embalagem" },
  { value: "epi", label: "EPI" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
];

const quantityFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const getStatus = (p: EstoqueProduto) => {
  if (p.quantidade_minima <= 0) return { label: "OK", variant: "default" as const };
  if (p.quantidade_atual <= 0) return { label: "Zerado", variant: "destructive" as const };
  if (p.quantidade_atual <= p.quantidade_minima) return { label: "Baixo", variant: "destructive" as const };
  if (p.quantidade_atual <= p.quantidade_minima * 1.5) return { label: "Atenção", variant: "secondary" as const };
  return { label: "OK", variant: "default" as const };
};

export default function Estoque() {
  const [searchParams, setSearchParams] = useSearchParams();
  const querySearchTerm = searchParams.get("q") ?? "";
  const [searchTerm, setSearchTerm] = useState(querySearchTerm);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalSaida, setModalSaida] = useState(false);
  const [editando, setEditando] = useState<EstoqueProduto | null>(null);
  const [form, setForm] = useState<Partial<EstoqueProduto>>({});
  const [activeTab, setActiveTab] = useState("insumos");
  const [produtoParaArquivar, setProdutoParaArquivar] = useState<EstoqueProduto | null>(null);

  const deferredSearchTerm = useDeferredValue(sanitizeStockDirectorySearch(searchTerm));
  const page = normalizeStockDirectoryPage(searchParams.get("pagina"));
  const selectedCategory = normalizeStockDirectoryCategory(
    searchParams.get("categoria"),
    CATEGORIAS.map((category) => category.value),
  );
  const selectedStatus = normalizeStockDirectoryStatus(searchParams.get("situacao"));
  const needsOperationalCatalog = modalEntrada || modalSaida;
  const {
    produtos,
    criarProduto,
    atualizarProduto,
    arquivarProduto,
  } = useEstoque({ enabled: needsOperationalCatalog });
  const { fornecedores } = useFornecedores({ enabled: modalProduto });
  const {
    data: directory,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useStockDirectory({
    page,
    pageSize: STOCK_DIRECTORY_PAGE_SIZE,
    search: deferredSearchTerm,
    category: selectedCategory,
    status: selectedStatus,
  });
  const directoryItems = directory?.items ?? [];
  const totalItems = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / STOCK_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalItems === 0 ? 0 : (page - 1) * STOCK_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * STOCK_DIRECTORY_PAGE_SIZE, totalItems);

  const updateDirectoryParams = useCallback((updates: {
    query?: string;
    category?: string;
    status?: StockDirectoryStatus;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.query !== undefined) {
      const normalized = normalizeStockDirectorySearchInput(updates.query);
      if (normalized) next.set("q", normalized);
      else next.delete("q");
    }
    if (updates.category !== undefined) {
      if (updates.category === "all") next.delete("categoria");
      else next.set("categoria", updates.category);
    }
    if (updates.status !== undefined) {
      if (updates.status === "active") next.delete("situacao");
      else next.set("situacao", updates.status);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("pagina", String(updates.page));
      else next.delete("pagina");
    }
    if (updates.query !== undefined || updates.category !== undefined || updates.status !== undefined) {
      next.delete("pagina");
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasFilters = Boolean(
    searchTerm || selectedCategory !== "all" || selectedStatus !== "active",
  );
  const clearFilters = () => {
    setSearchTerm("");
    updateDirectoryParams({ query: "", category: "all", status: "active" });
  };

  useEffect(() => {
    setSearchTerm(querySearchTerm);
  }, [querySearchTerm]);

  useEffect(() => {
    if (isLoading || totalItems === 0 || page <= totalPages) return;
    updateDirectoryParams({ page: totalPages });
  }, [isLoading, page, totalItems, totalPages, updateDirectoryParams]);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ ativo: true, categoria: "outros", unidade: "unidade", quantidade_minima: 0 });
    setModalProduto(true);
  };

  const abrirEditar = (p: EstoqueProduto) => {
    setEditando(p);
    setForm({ ...p });
    setModalProduto(true);
  };

  const salvar = async () => {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editando) {
      await atualizarProduto.mutateAsync({ id: editando.id, ...form });
    } else {
      await criarProduto.mutateAsync(form);
    }
    setModalProduto(false);
  };

  const reativarProduto = async (produto: EstoqueProduto) => {
    await atualizarProduto.mutateAsync({ id: produto.id, ativo: true });
  };

  return (
    <AppLayout title="Estoque" subtitle="Controle de insumos e materiais">
      <div className="page-shell">
        <PageHeader
          eyebrow="Gestão de insumos"
          title="Estoque e Compras"
          description="Saldos por local, suprimentos, recebimentos e rastreabilidade financeira"
          actions={activeTab === "insumos" ? (
            <>
              <Button variant="outline" onClick={() => setModalEntrada(true)} className="w-full gap-2 sm:w-auto"><ArrowDownToLine className="h-4 w-4" />Entrada</Button>
              <Button variant="outline" onClick={() => setModalSaida(true)} className="w-full gap-2 sm:w-auto"><ArrowUpFromLine className="h-4 w-4" />Saída</Button>
              <Button onClick={abrirNovo} className="w-full gap-2 font-bold sm:w-auto"><Plus className="h-4 w-4" />Novo Insumo</Button>
            </>
          ) : undefined}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="page-tabs-list">
              <TabsTrigger value="insumos" className="page-tab-trigger">Insumos</TabsTrigger>
              <TabsTrigger value="compras" className="page-tab-trigger">Compras</TabsTrigger>
              <TabsTrigger value="locais" className="page-tab-trigger">Locais e saldos</TabsTrigger>
              <TabsTrigger value="movimentacoes" className="page-tab-trigger">Movimentações</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="insumos" className="mt-0 space-y-4">
            <EstoqueDashboard
              activeCount={directory?.summary.activeCount}
              lowCount={directory?.summary.lowCount}
              zeroCount={directory?.summary.zeroCount}
              totalValue={directory?.summary.totalValue}
              isLoading={isLoading}
            />

            <Card className="min-w-0 shadow-none">
              <CardHeader className="space-y-4 pb-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px]">
                  <div className="relative min-w-0">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, fornecedor ou local..."
                      value={searchTerm}
                      onChange={(event) => {
                        const nextSearch = normalizeStockDirectorySearchInput(event.target.value);
                        setSearchTerm(nextSearch);
                        updateDirectoryParams({ query: nextSearch });
                      }}
                      className="pl-9 text-base md:text-sm"
                      skipUppercase
                      aria-label="Pesquisar insumos por nome, fornecedor ou local"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={(category) => updateDirectoryParams({ category })}>
                    <SelectTrigger className="w-full" aria-label="Filtrar insumos por categoria"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {CATEGORIAS.map((category) => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedStatus} onValueChange={(status) => updateDirectoryParams({ status: status as StockDirectoryStatus })}>
                    <SelectTrigger className="w-full" aria-label="Filtrar insumos por situação"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="low">Abaixo do mínimo</SelectItem>
                      <SelectItem value="zero">Saldo zerado</SelectItem>
                      <SelectItem value="archived">Arquivados</SelectItem>
                      <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Indicadores consideram todo o estoque ativo autorizado; a lista respeita os filtros desta página.
                  </p>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="gap-2" onClick={clearFilters}>
                      <RotateCcw className="h-4 w-4" />Limpar filtros
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {isFetching && !isLoading && (
                  <p className="px-4 pb-3 text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando o estoque…</p>
                )}
                {isLoading ? (
                  <div className="flex min-h-64 items-center justify-center gap-2 text-muted-foreground" role="status">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />Carregando insumos…
                  </div>
                ) : isError ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
                    <RefreshCw className="h-7 w-7 text-destructive" />
                    <div>
                      <p className="font-semibold">Não foi possível carregar o estoque</p>
                      <p className="mt-1 text-sm text-muted-foreground">Os indicadores não foram substituídos por zero. Tente novamente.</p>
                    </div>
                    <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
                  </div>
                ) : directoryItems.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                    <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary"><PackageOpen className="h-7 w-7" /></div>
                    <p className="font-semibold">{hasFilters ? "Nenhum insumo encontrado" : "Nenhum insumo ativo cadastrado"}</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {hasFilters ? "Revise a busca ou limpe os filtros para consultar o estoque autorizado." : "Cadastre o primeiro insumo para controlar saldo, mínimo e localização."}
                    </p>
                    <Button variant="link" onClick={hasFilters ? clearFilters : abrirNovo}>{hasFilters ? "Limpar filtros" : "Cadastrar primeiro insumo"}</Button>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block" data-testid="stock-directory-table-scroll">
                      <Table className="min-w-[880px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Insumo</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Saldo atual</TableHead>
                            <TableHead className="text-right">Mínimo</TableHead>
                            <TableHead className="text-right">Custo unitário</TableHead>
                            <TableHead>Fornecedor / local</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead className="w-[104px] text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {directoryItems.map((product) => {
                            const status = product.ativo ? getStatus(product) : { label: "Arquivado", variant: "outline" as const };
                            const canArchive = product.ativo && Number(product.quantidade_atual) === 0;
                            return (
                              <TableRow key={product.id} className={!product.ativo ? "opacity-70" : undefined}>
                                <TableCell><p className="max-w-[220px] truncate font-medium" title={product.nome}>{product.nome}</p><p className="text-xs text-muted-foreground">{product.unidade || "unidade"}</p></TableCell>
                                <TableCell><Badge variant="secondary">{CATEGORIAS.find((category) => category.value === product.categoria)?.label || product.categoria || "Outros"}</Badge></TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">{quantityFormatter.format(Number(product.quantidade_atual))} {product.unidade}</TableCell>
                                <TableCell className="text-right tabular-nums">{quantityFormatter.format(Number(product.quantidade_minima))} {product.unidade}</TableCell>
                                <TableCell className="text-right tabular-nums">{moneyFormatter.format(Number(product.preco_custo))}</TableCell>
                                <TableCell><p className="max-w-[180px] truncate">{product.fornecedores?.nome || "Sem fornecedor"}</p><p className="max-w-[180px] truncate text-xs text-muted-foreground">{product.localizacao || "Sem local legado"}</p></TableCell>
                                <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => abrirEditar(product)} aria-label={`Editar insumo ${product.nome}`}><Pencil className="h-4 w-4" /></Button>
                                    {product.ativo ? (
                                      <Button variant="ghost" size="icon" className="h-10 w-10" disabled={!canArchive} title={canArchive ? "Arquivar insumo" : "Zere ou transfira o saldo antes de arquivar"} onClick={() => setProdutoParaArquivar(product)} aria-label={`Arquivar insumo ${product.nome}`}><Archive className="h-4 w-4 text-muted-foreground" /></Button>
                                    ) : (
                                      <Button variant="ghost" size="sm" className="min-h-10" onClick={() => void reativarProduto(product)}>Reativar</Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid gap-3 px-3 pb-3 md:hidden" data-testid="stock-directory-cards">
                      {directoryItems.map((product) => {
                        const status = product.ativo ? getStatus(product) : { label: "Arquivado", variant: "outline" as const };
                        const canArchive = product.ativo && Number(product.quantidade_atual) === 0;
                        return (
                          <article key={product.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0"><h3 className="break-words font-semibold">{product.nome}</h3><p className="mt-1 text-xs text-muted-foreground">{CATEGORIAS.find((category) => category.value === product.categoria)?.label || product.categoria || "Outros"}</p></div>
                              <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Saldo atual</p><p className="mt-1 font-bold tabular-nums">{quantityFormatter.format(Number(product.quantidade_atual))} {product.unidade}</p></div>
                              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Mínimo</p><p className="mt-1 font-bold tabular-nums">{quantityFormatter.format(Number(product.quantidade_minima))} {product.unidade}</p></div>
                            </div>
                            <div className="mt-3 space-y-1 text-sm text-muted-foreground"><p className="break-words">{product.fornecedores?.nome || "Sem fornecedor"}</p><p className="break-words">{product.localizacao || "Sem local legado"} · {moneyFormatter.format(Number(product.preco_custo))}/un.</p></div>
                            <div className="mt-4 flex gap-2 border-t pt-3">
                              <Button variant="outline" className="min-h-11 flex-1" onClick={() => abrirEditar(product)} aria-label={`Editar insumo ${product.nome}`}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                              {product.ativo ? (
                                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={!canArchive} title={canArchive ? "Arquivar insumo" : "Zere ou transfira o saldo antes de arquivar"} onClick={() => setProdutoParaArquivar(product)} aria-label={`Arquivar insumo ${product.nome}`}><Archive className="h-4 w-4" /></Button>
                              ) : (
                                <Button variant="outline" className="min-h-11 flex-1" onClick={() => void reativarProduto(product)}>Reativar</Button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </>
                )}

                {!isLoading && !isError && totalItems > 0 && (
                  <nav className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de insumos">
                    <p className="text-sm text-muted-foreground" aria-live="polite">Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalItems} insumos</p>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de insumos"><ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline">Anterior</span></Button>
                      <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">Página {page} de {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de insumos"><span className="hidden sm:inline">Próxima</span><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </nav>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="compras" className="mt-0"><ComprasWorkspace /></TabsContent>
          <TabsContent value="locais" className="mt-0"><LocaisEstoqueWorkspace /></TabsContent>
          <TabsContent value="movimentacoes" className="mt-0"><MovimentacoesEstoqueWorkspace /></TabsContent>
        </Tabs>
      </div>

      {/* Modal Novo/Editar Produto */}
      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent className="wide-form-dialog">
          <DialogHeader><DialogTitle>{editando ? "Editar Insumo" : "Novo Insumo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={form.categoria || "outros"} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade || "unidade"} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="litro">Litro</SelectItem>
                    <SelectItem value="kg">Kg</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="metro">Metro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Qtd. Mínima</Label><Input type="number" value={form.quantidade_minima ?? 0} onChange={(e) => setForm({ ...form, quantidade_minima: Number(e.target.value) })} /></div>
              <div className="rounded-lg border bg-muted/40 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saldo e custo</p>
                <p className="mt-1 text-sm text-foreground">
                  {editando
                    ? `${editando.quantidade_atual} ${editando.unidade || "un"} · R$ ${editando.preco_custo.toFixed(2)}`
                    : "O novo insumo começa zerado."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Altere estes valores por uma entrada ou saída auditável.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Fornecedor</Label>
                <Select value={form.fornecedor_id || ""} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{fornecedores.filter(f => f.ativo).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Localização</Label><Input value={form.localizacao || ""} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex: Prateleira A3" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalProduto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={criarProduto.isPending || atualizarProduto.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntradaEstoqueModal open={modalEntrada} onOpenChange={setModalEntrada} produtos={produtos} />
      <SaidaEstoqueModal open={modalSaida} onOpenChange={setModalSaida} produtos={produtos} />
      <AlertDialog open={!!produtoParaArquivar} onOpenChange={(open) => !open && setProdutoParaArquivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar insumo?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{produtoParaArquivar?.nome}</strong> deixará de aparecer em novas compras e movimentações. Todo o histórico será preservado. Insumos com saldo precisam ser zerados antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (produtoParaArquivar) arquivarProduto.mutate(produtoParaArquivar.id);
              setProdutoParaArquivar(null);
            }}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
