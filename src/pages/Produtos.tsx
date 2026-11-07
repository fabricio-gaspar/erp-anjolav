import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ChevronLeft, ChevronRight, Copy, Download, Loader2, MoreHorizontal, Package, Pencil, Plus, RotateCcw } from "lucide-react";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { useProductDirectory } from "@/hooks/useProductDirectory";
import { toast } from "sonner";
import { CATEGORIAS, ProdutoFilters } from "@/components/produtos/ProdutoFilters";
import { ProdutoForm, ProdutoFormData } from "@/components/produtos/ProdutoForm";
import { ProdutoStats } from "@/components/produtos/ProdutoStats";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedProductUnits } from "@/lib/workspaceScope";
import {
  buildProductDirectoryCsv,
  normalizeProductDirectoryLetter,
  normalizeProductDirectoryPage,
  PRODUCT_DIRECTORY_PAGE_SIZE,
  type ProductDirectoryStatus,
} from "@/lib/productDirectory";
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

const defaultFormData: ProdutoFormData = {
  codigo: "",
  nome: "",
  categoria: "",
  preco: 0,
  unidade: "peca",
  unidade_negocio: "ambos",
  porte: "",
  status: "ativo",
  descricao: "",
  peso_medio_kg: 0,
  tempo_processo_min: 30,
  processo_lavagem: "normal",
  temperatura_maxima: 60,
  requer_secadora: true,
  cor: "branco",
  composicao: "algodao",
  instrucoes_especiais: "",
};

const getUnitLabel = (unit: string | null | undefined) => {
  if (unit === "kg") return "kg";
  if (unit === "metro") return "metro";
  if (unit === "unidade") return "un.";
  return "peça";
};

const Produtos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const { createProduto, updateProduto, setProdutoStatus } = useProdutos({ enabled: false });
  const availableBusinessUnits = getAllowedProductUnits(activeArea);
  const searchTerm = searchParams.get("q") ?? "";
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const page = normalizeProductDirectoryPage(searchParams.get("pagina"));
  const selectedLetter = normalizeProductDirectoryLetter(searchParams.get("letra"));
  const requestedCategory = searchParams.get("categoria");
  const selectedCategoria = CATEGORIAS.some(category => category.value === requestedCategory)
    ? requestedCategory as string
    : "all";
  const requestedBusinessUnit = searchParams.get("unidade");
  const validBusinessUnits = ["ID1", "ID2", "ambos"];
  const selectedUnidadeNegocio = requestedBusinessUnit && validBusinessUnits.includes(requestedBusinessUnit) &&
    (availableBusinessUnits === null || availableBusinessUnits.includes(requestedBusinessUnit))
    ? requestedBusinessUnit
    : "all";
  const requestedStatus = searchParams.get("situacao");
  const selectedStatus: ProductDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const {
    data: directory,
    isLoading,
    isFetching,
    error: productsError,
    refetch,
  } = useProductDirectory({
    page,
    pageSize: PRODUCT_DIRECTORY_PAGE_SIZE,
    search: deferredSearchTerm,
    letter: selectedLetter,
    category: selectedCategoria,
    businessUnit: selectedUnidadeNegocio,
    status: selectedStatus,
  });
  const produtos = directory?.produtos ?? [];
  const totalProdutos = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProdutos / PRODUCT_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalProdutos === 0 ? 0 : (page - 1) * PRODUCT_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * PRODUCT_DIRECTORY_PAGE_SIZE, totalProdutos);

  const [showForm, setShowForm] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoFormData>(defaultFormData);
  const [produtoToArchive, setProdutoToArchive] = useState<Produto | null>(null);

  useEffect(() => {
    const openNewProduct = searchParams.get("novo") === "1";
    if (!openNewProduct) return;
    setEditingProduto(null);
    setFormData(defaultFormData);
    setShowForm(true);
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingProduto(null);
    setShowForm(false);
  };

  const handleFormChange = (data: Partial<ProdutoFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error("Nome do produto é obrigatório");
      return;
    }

    const produtoData = {
      codigo: formData.codigo || null,
      nome: formData.nome,
      preco: formData.preco,
      unidade: formData.unidade,
      unidade_negocio: formData.unidade_negocio,
      porte: formData.porte || null,
      status: formData.status,
      descricao: formData.descricao || null,
      categoria: formData.categoria || null,
      peso_medio_kg: formData.peso_medio_kg || null,
      tempo_processo_min: formData.tempo_processo_min || null,
      processo_lavagem: formData.processo_lavagem || null,
      temperatura_maxima: formData.temperatura_maxima || null,
      requer_secadora: formData.requer_secadora,
      cor: formData.cor || null,
      composicao: formData.composicao || null,
      instrucoes_especiais: formData.instrucoes_especiais || null,
    };

    if (editingProduto) {
      updateProduto.mutate(
        { id: editingProduto.id, ...produtoData },
        { onSuccess: resetForm }
      );
    } else {
      createProduto.mutate(produtoData, { onSuccess: resetForm });
    }
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      codigo: produto.codigo || "",
      nome: produto.nome,
      categoria: produto.categoria || "",
      preco: produto.preco,
      unidade: produto.unidade || "peca",
      unidade_negocio: produto.unidade_negocio || "ambos",
      porte: produto.porte || "",
      status: produto.status || "ativo",
      descricao: produto.descricao || "",
      peso_medio_kg: produto.peso_medio_kg || 0,
      tempo_processo_min: produto.tempo_processo_min || 30,
      processo_lavagem: produto.processo_lavagem || "normal",
      temperatura_maxima: produto.temperatura_maxima || 60,
      requer_secadora: produto.requer_secadora ?? true,
      cor: produto.cor || "branco",
      composicao: produto.composicao || "algodao",
      instrucoes_especiais: produto.instrucoes_especiais || "",
    });
    setShowForm(true);
  };

  const handleDuplicate = (produto: Produto) => {
    setEditingProduto(null);
    setFormData({
      codigo: "",
      nome: `${produto.nome} (Cópia)`,
      categoria: produto.categoria || "",
      preco: produto.preco,
      unidade: produto.unidade || "peca",
      unidade_negocio: produto.unidade_negocio || "ambos",
      porte: produto.porte || "",
      status: "ativo",
      descricao: produto.descricao || "",
      peso_medio_kg: produto.peso_medio_kg || 0,
      tempo_processo_min: produto.tempo_processo_min || 30,
      processo_lavagem: produto.processo_lavagem || "normal",
      temperatura_maxima: produto.temperatura_maxima || 60,
      requer_secadora: produto.requer_secadora ?? true,
      cor: produto.cor || "branco",
      composicao: produto.composicao || "algodao",
      instrucoes_especiais: produto.instrucoes_especiais || "",
    });
    setShowForm(true);
    toast.info("Produto duplicado! Ajuste os dados e salve.");
  };

  const handleArchive = () => {
    if (!produtoToArchive) return;
    setProdutoStatus.mutate(
      { id: produtoToArchive.id, status: "inativo" },
      { onSuccess: () => setProdutoToArchive(null) },
    );
  };

  const handleReactivate = (produto: Produto) => {
    setProdutoStatus.mutate({ id: produto.id, status: "ativo" });
  };

  const handleExportCSV = () => {
    if (produtos.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }

    const headers = ["Código", "Nome", "Categoria", "Preço", "Unidade", "Un. Negócio", "Porte", "Status", "Peso Médio", "Processo", "Temperatura"];
    const rows = produtos.map(p => [
      p.codigo || "",
      p.nome,
      p.categoria || "",
      p.preco.toFixed(2),
      p.unidade || "",
      p.unidade_negocio || "",
      p.porte || "",
      p.status,
      p.peso_medio_kg || "",
      p.processo_lavagem || "",
      p.temperatura_maxima || "",
    ]);

    const csv = buildProductDirectoryCsv(headers, rows);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `produtos_pagina_${page}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    toast.success("Página exportada com sucesso!");
  };

  const updateDirectoryParams = useCallback((updates: {
    query?: string;
    letter?: string;
    category?: string;
    businessUnit?: string;
    status?: ProductDirectoryStatus;
    page?: number;
  }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.query !== undefined) {
      if (updates.query.trim()) next.set("q", updates.query);
      else next.delete("q");
    }
    if (updates.letter !== undefined) {
      if (updates.letter === "TODOS") next.delete("letra");
      else next.set("letra", updates.letter);
    }
    if (updates.category !== undefined) {
      if (updates.category === "all") next.delete("categoria");
      else next.set("categoria", updates.category);
    }
    if (updates.businessUnit !== undefined) {
      if (updates.businessUnit === "all") next.delete("unidade");
      else next.set("unidade", updates.businessUnit);
    }
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("situacao");
      else next.set("situacao", updates.status);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("pagina", String(updates.page));
      else next.delete("pagina");
    }
    if (
      updates.query !== undefined || updates.letter !== undefined || updates.category !== undefined ||
      updates.businessUnit !== undefined || updates.status !== undefined
    ) next.delete("pagina");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasFilters = Boolean(
    searchTerm || selectedLetter !== "TODOS" || selectedCategoria !== "all" ||
    selectedUnidadeNegocio !== "all" || selectedStatus !== "all",
  );
  const clearFilters = () => updateDirectoryParams({
    query: "",
    letter: "TODOS",
    category: "all",
    businessUnit: "all",
    status: "all",
  });

  useEffect(() => {
    if (isLoading || totalProdutos === 0 || page <= totalPages) return;
    updateDirectoryParams({ page: totalPages });
  }, [isLoading, page, totalPages, totalProdutos, updateDirectoryParams]);

  const isSaving = createProduto.isPending || updateProduto.isPending || setProdutoStatus.isPending;
  const areaLabel = activeArea === "residencial" ? "Doméstico" : activeArea === "industrial" ? "Industrial" : "Central";

  return (
    <AppLayout title="Produtos & Serviços" subtitle="Cadastro de produtos e serviços de lavanderia">
      <div className="page-shell">
        <PageHeader
          eyebrow={`OPERAÇÃO ${areaLabel.toLocaleUpperCase("pt-BR")} · CATÁLOGO TÉCNICO`}
          title="Produtos & Serviços"
          description={`Definições técnicas e precificação da operação ${areaLabel.toLocaleLowerCase("pt-BR")}`}
          actions={(
            <>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={produtos.length === 0}
                className="w-full gap-2 sm:w-auto"
              >
                <Download className="h-4 w-4" />Exportar página
              </Button>
              <Button
                className="w-full gap-2 font-bold sm:w-auto"
                onClick={() => {
                  if (showForm) resetForm();
                  else setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4" />Novo Produto
              </Button>
            </>
          )}
        />

        <div className="space-y-3">
          <ProdutoStats produtos={produtos} total={totalProdutos} />

          <div className="content-panel space-y-5">
            {showForm && (
              <section className="rounded-xl border bg-muted/10 p-4" aria-label={editingProduto ? "Editar produto" : "Novo produto"}>
                <h2 className="mb-3 font-semibold text-foreground">
                  {editingProduto ? "Editar produto" : "Novo produto"}
                </h2>
                <ProdutoForm
                  formData={formData}
                  onChange={handleFormChange}
                  onSubmit={handleSubmit}
                  onCancel={resetForm}
                  isEditing={!!editingProduto}
                  isSaving={isSaving}
                />
              </section>
            )}

            <div className="space-y-3">
              <ProdutoFilters
                selectedLetter={selectedLetter}
                onLetterChange={letter => updateDirectoryParams({ letter })}
                searchTerm={searchTerm}
                onSearchChange={query => updateDirectoryParams({ query })}
                selectedCategoria={selectedCategoria}
                onCategoriaChange={category => updateDirectoryParams({ category })}
                selectedUnidadeNegocio={selectedUnidadeNegocio}
                onUnidadeNegocioChange={businessUnit => updateDirectoryParams({ businessUnit })}
                selectedStatus={selectedStatus}
                onStatusChange={status => updateDirectoryParams({ status: status as ProductDirectoryStatus })}
                availableBusinessUnits={availableBusinessUnits}
              />
              <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  A consulta considera somente produtos autorizados para esta empresa e operação.
                </p>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="gap-2" onClick={clearFilters}>
                    <RotateCcw className="h-4 w-4" /> Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            {isFetching && !isLoading && (
              <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando o catálogo…</p>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
              </div>
            ) : productsError ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-destructive" role="alert">
                <p>Não foi possível carregar os produtos.</p>
                <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
              </div>
            ) : produtos.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Package className="h-7 w-7 text-primary/70" />
                </div>
                <p className="font-semibold text-foreground">
                  {hasFilters ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {hasFilters
                    ? "Revise a busca ou limpe os filtros para consultar todo o catálogo desta operação."
                    : "Cadastre o primeiro produto ou serviço para montar o catálogo desta operação."}
                </p>
                <Button
                  variant="link"
                  className="mt-1 px-0 font-semibold"
                  onClick={hasFilters ? clearFilters : () => setShowForm(true)}
                >
                  {hasFilters ? "Limpar filtros" : "Cadastrar primeiro produto"}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border" data-testid="product-directory-table">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Código</TableHead>
                      <TableHead>Produto ou serviço</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtos.map((produto) => {
                      const active = produto.status === "ativo";
                      const categoryLabel = CATEGORIAS.find(category => category.value === produto.categoria)?.label;
                      return (
                        <TableRow key={produto.id} className={!active ? "opacity-70" : undefined}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{produto.codigo || "—"}</TableCell>
                          <TableCell>
                            <p className="font-semibold text-foreground">{produto.nome}</p>
                            {categoryLabel && <p className="text-xs text-muted-foreground">{categoryLabel}</p>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getUnitLabel(produto.unidade)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            R$ {produto.preco.toFixed(2).replace(".", ",")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={active ? "default" : "secondary"}>{active ? "Ativo" : "Arquivado"}</Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9"
                                  aria-label={`Ações do produto ${produto.nome}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => handleEdit(produto)}>
                                  <Pencil className="mr-2 h-4 w-4" />Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(produto)}>
                                  <Copy className="mr-2 h-4 w-4" />Duplicar
                                </DropdownMenuItem>
                                {active ? (
                                  <DropdownMenuItem onClick={() => setProdutoToArchive(produto)}>
                                    <Archive className="mr-2 h-4 w-4" />Arquivar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => handleReactivate(produto)}>
                                    <RotateCcw className="mr-2 h-4 w-4" />Reativar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {!isLoading && !productsError && totalProdutos > 0 && (
              <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de produtos">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalProdutos} produtos
                </p>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateDirectoryParams({ page: page - 1 })}
                    disabled={page <= 1 || isFetching}
                    aria-label="Página anterior de produtos"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                  <span className="min-w-24 text-center text-sm tabular-nums text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateDirectoryParams({ page: page + 1 })}
                    disabled={page >= totalPages || isFetching}
                    aria-label="Próxima página de produtos"
                  >
                    <span className="hidden sm:inline">Próxima</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </nav>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={Boolean(produtoToArchive)} onOpenChange={open => !open && setProdutoToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar produto</AlertDialogTitle>
            <AlertDialogDescription>
              O produto deixará de aparecer entre os ativos, mas ordens, lançamentos, preços e demais históricos serão preservados. Ele poderá ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={setProdutoStatus.isPending}>
              Arquivar produto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Produtos;
