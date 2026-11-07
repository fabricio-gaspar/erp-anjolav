import { useDeferredValue, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PdvLayout } from "@/components/layout/PdvLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ArrowLeft, Building2, ChevronLeft, ChevronRight, Eye, History, Loader2, Mail, MoreHorizontal, Pencil, Phone, Plus, RotateCcw, Search, User } from "lucide-react";
import { ClienteDadosBasicos } from "@/components/clientes/ClienteDadosBasicos";
import { ClienteEndereco } from "@/components/clientes/ClienteEndereco";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { ClienteCondicoes } from "@/components/clientes/ClienteCondicoes";
import { ClienteResumo } from "@/components/clientes/ClienteResumo";
import { useClientes, useClienteById, type Cliente } from "@/hooks/useClientes";
import { useClienteDirectory } from "@/hooks/useClienteDirectory";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { BrasilApiCnpjResponse } from "@/services/apiServices";
import {
  CLIENT_DIRECTORY_PAGE_SIZE,
  normalizeClientDirectoryPage,
  type ClientDirectoryStatus,
} from "@/lib/clientDirectory";
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
import { cn } from "@/lib/utils";
import "@/styles/pdv-client-registration.css";

const Clientes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("lista");
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [clienteToArchive, setClienteToArchive] = useState<string | null>(null);
  const [cnpjData, setCnpjData] = useState<BrasilApiCnpjResponse | null>(null);

  const { activeArea } = useWorkspace();
  const { archiveCliente, updateCliente } = useClientes({ enabled: false });
  const searchTerm = searchParams.get("q") ?? "";
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const page = normalizeClientDirectoryPage(searchParams.get("pagina"));
  const requestedStatus = searchParams.get("situacao");
  const statusFilter: ClientDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const {
    data: directory,
    isLoading,
    isFetching,
    error: clientesError,
    refetch,
  } = useClienteDirectory({
    page,
    pageSize: CLIENT_DIRECTORY_PAGE_SIZE,
    search: deferredSearchTerm,
    status: statusFilter,
  });
  const { data: selectedCliente } = useClienteById(selectedClienteId);
  const clientes = directory?.clientes ?? [];
  const totalClientes = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalClientes / CLIENT_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalClientes === 0 ? 0 : (page - 1) * CLIENT_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * CLIENT_DIRECTORY_PAGE_SIZE, totalClientes);

  const handleNovoCliente = () => {
    setSelectedClienteId(null);
    setCnpjData(null);
    setActiveTab("dados");
  };

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    handleNovoCliente();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("novo");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleEditCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCnpjData(null);
    setActiveTab("resumo");
  };

  const handleSelectCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId);
    setCnpjData(null);
    if (!location.pathname.startsWith("/pdv/")) setActiveTab("resumo");
  };

  const handleClienteSaved = (clienteId: string) => {
    setSelectedClienteId(clienteId);
  };

  const handleArchiveCliente = () => {
    if (clienteToArchive) {
      archiveCliente.mutate(clienteToArchive);
      setArchiveDialogOpen(false);
      setClienteToArchive(null);
    }
  };

  const handleToggleAtivo = (cliente: Cliente) => {
    updateCliente.mutate({
      id: cliente.id,
      ativo: !cliente.ativo,
    });
  };

  const handleBackToList = () => {
    setActiveTab("lista");
    setSelectedClienteId(clientes[0]?.id ?? null);
  };

  const getUnidadeNegocioBadge = (classificacao: string) => {
    return classificacao === "industrial" ? "ID1" : "ID2";
  };

  const areaLabel = activeArea === "residencial" ? "Doméstico" : "Industrial";
  const operationLabel = activeArea === "residencial" ? "OPERAÇÃO DOMÉSTICA" : "OPERAÇÃO INDUSTRIAL";
  const pageTitle = `Clientes ${areaLabel}`;
  const pageSubtitle = "AnjoLav";
  const isPdvClientWorkspace = location.pathname.startsWith("/pdv/");
  const pdvOperation = activeArea === "industrial" ? "industrial" : "residencial";
  const isNewClient = activeTab === "dados" && !selectedClienteId;
  const pdvTitle = isNewClient ? "Cadastro de cliente" : activeTab === "lista" ? "Consulta de clientes" : "Cadastro de cliente";
  const pdvBreadcrumb = isNewClient ? "Clientes  ›  Novo cadastro" : selectedCliente ? `Clientes  ›  ${selectedCliente.razao_social}` : "Clientes";
  const selectedClientIndex = selectedClienteId ? clientes.findIndex((cliente) => cliente.id === selectedClienteId) : -1;
  const selectedClientCode = selectedClientIndex >= 0
    ? String((page - 1) * CLIENT_DIRECTORY_PAGE_SIZE + selectedClientIndex + 1).padStart(4, "0")
    : "—";

  useEffect(() => {
    if (!isPdvClientWorkspace || activeTab !== "lista" || selectedClienteId || isLoading || clientes.length === 0) return;
    setSelectedClienteId(clientes[0].id);
  }, [activeTab, clientes, isLoading, isPdvClientWorkspace, selectedClienteId]);

  const updateDirectoryParams = (updates: { query?: string; status?: ClientDirectoryStatus; page?: number }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.query !== undefined) {
      if (updates.query.trim()) next.set("q", updates.query);
      else next.delete("q");
    }
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("situacao");
      else next.set("situacao", updates.status);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("pagina", String(updates.page));
      else next.delete("pagina");
    }
    if (updates.query !== undefined || updates.status !== undefined) next.delete("pagina");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (isLoading || totalClientes === 0 || page <= totalPages) return;
    const next = new URLSearchParams(searchParams);
    if (totalPages > 1) next.set("pagina", String(totalPages));
    else next.delete("pagina");
    setSearchParams(next, { replace: true });
  }, [isLoading, page, searchParams, setSearchParams, totalClientes, totalPages]);

  const content = (
    <>
      <div className={cn("page-shell", isPdvClientWorkspace && "pdv-client-registration")} data-testid={isPdvClientWorkspace ? "pdv-client-registration" : undefined}>
        {isPdvClientWorkspace ? (
          <header className="pdv-client-registration__heading">
            <button type="button" onClick={() => navigate(pdvOperation === "industrial" ? "/pdv/painel/industrial" : "/pdv/painel/domestico")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <span aria-hidden="true" />
            <div>
              <h1>{pdvTitle}</h1>
              <button type="button" onClick={handleBackToList}>{pdvBreadcrumb}</button>
            </div>
            <small>{operationLabel}</small>
          </header>
        ) : (
          <PageHeader
          eyebrow={operationLabel}
          title={pageTitle}
          description={`Cadastros exclusivos da operação ${areaLabel.toLowerCase()}`}
          actions={activeTab === "lista" ? (
            <Button
              onClick={handleNovoCliente}
              className="w-full gap-2 bg-primary font-bold shadow-sm hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          ) : undefined}
          />
        )}

        {!isPdvClientWorkspace && activeTab !== "lista" && Boolean(selectedCliente) && (
          <div className="surface-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                {selectedCliente ? <Building2 className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-foreground">
                    {selectedCliente?.razao_social || "Novo Cliente"}
                  </h3>
                  {selectedCliente && (
                    <StatusBadge variant={selectedCliente.classificacao === "industrial" ? "warning" : "info"}>
                      {selectedCliente.classificacao === "industrial" ? "Industrial" : "Doméstico"}
                    </StatusBadge>
                  )}
                </div>
                {selectedCliente && (
                  <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                    {selectedCliente.nome_fantasia && <span>{selectedCliente.nome_fantasia}</span>}
                    {selectedCliente.cpf_cnpj && <span>• {selectedCliente.cpf_cnpj}</span>}
                  </div>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={handleBackToList} className="w-full shrink-0 sm:w-auto">
              Voltar para Lista
            </Button>
          </div>
        )}

        {isPdvClientWorkspace && activeTab === "dados" && (
          <div className="pdv-client-form-heading">
            <h2>{selectedCliente ? "Editar cliente" : "Novo cliente"}</h2>
            <span>Cadastro completo do cliente para o atendimento.</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="max-w-full overflow-x-auto pb-1 scrollbar-hide">
            <TabsList className="page-tabs-list">
              <TabsTrigger value="lista" className="page-tab-trigger">Lista</TabsTrigger>
              <TabsTrigger value="resumo" disabled={!selectedClienteId} className="page-tab-trigger">Resumo</TabsTrigger>
              <TabsTrigger value="dados" className="page-tab-trigger">Dados</TabsTrigger>
              <TabsTrigger value="endereco" disabled={!selectedClienteId} className="page-tab-trigger">Endereço</TabsTrigger>
              <TabsTrigger value="condicoes" disabled={!selectedClienteId} className="page-tab-trigger">Condições</TabsTrigger>
              <TabsTrigger value="contrato" disabled={!selectedClienteId} className="page-tab-trigger">Contrato</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="lista" className="mt-4">
            <div className={cn(isPdvClientWorkspace && "pdv-client-list-layout")}>
            <div className="content-panel space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Nome, CPF/CNPJ ou telefone..."
                    value={searchTerm}
                    onChange={(event) => updateDirectoryParams({ query: event.target.value })}
                    className="h-10 bg-background pl-9"
                    aria-label="Pesquisar clientes por nome, CPF, CNPJ ou telefone"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex h-10 items-center gap-2 rounded-lg border bg-muted/20 px-3 text-sm font-medium text-muted-foreground" aria-label={`Escopo ${areaLabel}`}>
                    <Building2 className="h-4 w-4 text-primary" />
                    {areaLabel}
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: ClientDirectoryStatus) => updateDirectoryParams({ status: value })}
                  >
                    <SelectTrigger className="h-10 w-full bg-background sm:w-40" aria-label="Filtrar clientes por situação">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="inactive">Arquivados</SelectItem>
                    </SelectContent>
                  </Select>
                  {(searchTerm || statusFilter !== "all") && (
                    <Button
                      variant="ghost"
                      className="h-10 shrink-0 gap-2"
                      onClick={() => updateDirectoryParams({ query: "", status: "all" })}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Limpar
                    </Button>
                  )}
                  {isPdvClientWorkspace && (
                    <Button type="button" className="h-10 shrink-0 gap-2 bg-[#087ed0] font-bold hover:bg-[#0569ad]" onClick={handleNovoCliente}>
                      <Plus className="h-4 w-4" />
                      Novo cliente
                    </Button>
                  )}
                </div>
              </div>

              {isFetching && !isLoading && (
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando a lista…</p>
              )}

              <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Carregando clientes...</span>
                </div>
              ) : clientesError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-destructive" role="alert">
                  <p>Não foi possível carregar os clientes.</p>
                  <Button variant="outline" onClick={() => void refetch()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : clientes.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-muted-foreground">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <Building2 className="h-7 w-7 text-primary/70" />
                  </div>
                  <p className="font-semibold text-foreground">
                    {searchTerm || statusFilter !== "all" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                  </p>
                  <p className="mt-1 max-w-sm text-sm">
                    {searchTerm || statusFilter !== "all"
                      ? "Revise a busca ou limpe os filtros para consultar todo o cadastro desta operação."
                      : "Cadastre o primeiro cliente para começar a organizar esta operação."}
                  </p>
                  {searchTerm || statusFilter !== "all" ? (
                    <Button variant="link" onClick={() => updateDirectoryParams({ query: "", status: "all" })} className="mt-1 px-0 font-semibold">
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="link" onClick={handleNovoCliente} className="mt-1 px-0 font-semibold">
                      Cadastrar primeiro cliente
                    </Button>
                  )}
                </div>
              ) : (
                <Table className={cn(isPdvClientWorkspace && "pdv-client-table")}>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-y border-slate-200/60">
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em]">{isPdvClientWorkspace ? "Código" : "ID"}</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em]">NOME / RAZÃO SOCIAL</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em] hidden sm:table-cell">{isPdvClientWorkspace ? "TIPO" : "CPF/CNPJ"}</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em] hidden md:table-cell">{isPdvClientWorkspace ? "CONTATO" : "TELEFONE"}</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em] text-center">STATUS</TableHead>
                      <TableHead className="font-black text-[11px] text-slate-500 py-2.5 px-3 uppercase tracking-[0.1em] text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.map((cliente, index) => (
                      <TableRow key={cliente.id} className={cn("hover:bg-slate-50/50 border-b border-slate-100 transition-colors", isPdvClientWorkspace && selectedClienteId === cliente.id && "pdv-client-table-row--selected")}>
                        <TableCell className="py-3 px-3">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight", isPdvClientWorkspace ? "pdv-client-code" : "bg-amber-50 text-amber-700 border border-amber-100/50")}>
                            {isPdvClientWorkspace ? String((page - 1) * CLIENT_DIRECTORY_PAGE_SIZE + index + 1).padStart(4, "0") : getUnidadeNegocioBadge(cliente.classificacao)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3">
                          <div className="flex flex-col">
                            <button
                              type="button"
                              className="w-fit text-left font-black text-slate-900 text-[13px] uppercase tracking-tight hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                              onClick={() => handleSelectCliente(cliente.id)}
                              aria-label={`Abrir cliente ${cliente.razao_social}`}
                            >
                              {cliente.razao_social}
                            </button>
                            {cliente.nome_fantasia && (
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                {cliente.nome_fantasia}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 font-medium hidden sm:table-cell py-3 px-3 text-[13px]">
                          {isPdvClientWorkspace ? <span className="pdv-client-type-badge">{cliente.tipo_pessoa === "cnpj" ? "PJ" : "PF"}</span> : cliente.cpf_cnpj || "-"}
                        </TableCell>
                        <TableCell className="text-slate-600 font-medium hidden md:table-cell py-3 px-3 text-[13px]">
                          {isPdvClientWorkspace ? (
                            <div className="pdv-client-contact-cell">
                              {cliente.email && <span><Mail className="h-3.5 w-3.5" />{cliente.email}</span>}
                              {cliente.telefone && <span><Phone className="h-3.5 w-3.5" />{cliente.telefone}</span>}
                              {!cliente.email && !cliente.telefone && <span>—</span>}
                            </div>
                          ) : cliente.telefone || "-"}
                        </TableCell>
                        <TableCell className="py-3 px-3 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-sm",
                            cliente.ativo ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500 border border-slate-200"
                          )}>
                            {cliente.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 px-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-slate-100"
                                aria-label={`Ações do cliente ${cliente.razao_social}`}
                              >
                                <MoreHorizontal className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleSelectCliente(cliente.id)}>
                                <Eye className="w-4 h-4 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditCliente(cliente.id)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              {cliente.ativo ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setClienteToArchive(cliente.id);
                                    setArchiveDialogOpen(true);
                                  }}
                                >
                                  <Archive className="mr-2 h-4 w-4" /> Arquivar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleToggleAtivo(cliente)}>
                                  <RotateCcw className="mr-2 h-4 w-4" /> Reativar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              </div>

              {!isLoading && !clientesError && totalClientes > 0 && (
                <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de clientes">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalClientes} clientes
                  </p>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateDirectoryParams({ page: page - 1 })}
                      disabled={page <= 1 || isFetching}
                      aria-label="Página anterior de clientes"
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
                      aria-label="Próxima página de clientes"
                    >
                      <span className="hidden sm:inline">Próxima</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </nav>
              )}
            </div>
            {isPdvClientWorkspace && (
              <aside className="pdv-client-summary-card" aria-labelledby="pdv-client-summary-title">
                <h2 id="pdv-client-summary-title">Resumo do cliente</h2>
                {selectedCliente ? (
                  <>
                    <div className="pdv-client-summary-identity">
                      <User className="h-11 w-11" aria-hidden="true" />
                      <div>
                        <h3>{selectedCliente.razao_social}</h3>
                        <p>Código: {selectedClientCode}</p>
                        <span className="pdv-client-type-badge">{selectedCliente.tipo_pessoa === "cnpj" ? "PJ" : "PF"}</span>
                      </div>
                    </div>
                    <div className="pdv-client-summary-section">
                      <strong>Documento</strong>
                      <span>{selectedCliente.cpf_cnpj || "(não informado)"}</span>
                    </div>
                    <div className="pdv-client-summary-section">
                      <strong>Contato</strong>
                      {selectedCliente.email && <span><Mail className="h-4 w-4" />{selectedCliente.email}</span>}
                      {selectedCliente.telefone && <span><Phone className="h-4 w-4" />{selectedCliente.telefone}</span>}
                      {!selectedCliente.email && !selectedCliente.telefone && <span>(não informado)</span>}
                    </div>
                    <div className="pdv-client-summary-section">
                      <strong>Status</strong>
                      <span className={cn("pdv-client-status", selectedCliente.ativo ? "is-active" : "is-inactive")}>{selectedCliente.ativo ? "✓ Ativo" : "◉ Inativo"}</span>
                    </div>
                    <div className="pdv-client-summary-actions">
                      <Button type="button" className="bg-[#087ed0] font-bold hover:bg-[#0569ad]" onClick={() => setActiveTab("dados")}><Pencil className="h-4 w-4" />Abrir cadastro</Button>
                      <Button type="button" variant="outline" onClick={() => navigate(`/pdv/${pdvOperation}/rol`)}><Plus className="h-4 w-4" />Novo rol</Button>
                      <Button type="button" variant="outline" onClick={() => setActiveTab("resumo")}><History className="h-4 w-4" />Histórico</Button>
                    </div>
                  </>
                ) : (
                  <div className="pdv-client-summary-empty">
                    <User className="h-10 w-10" />
                    <p>Selecione um cliente para ver o resumo.</p>
                  </div>
                )}
              </aside>
            )}
            </div>
          </TabsContent>

          <TabsContent value="resumo" className="pdv-client-tab-panel mt-4 px-1">
            <ClienteResumo clienteId={selectedClienteId} onOpenTab={setActiveTab} />
          </TabsContent>

          <TabsContent value="dados" className="pdv-client-tab-panel mt-4 px-1">
            <ClienteDadosBasicos
              clienteId={selectedClienteId}
              onNext={() => setActiveTab("endereco")}
              onClienteSaved={handleClienteSaved}
              onOpenExistingClient={handleEditCliente}
              onCnpjDataLoaded={setCnpjData}
            />
          </TabsContent>

          <TabsContent value="endereco" className="pdv-client-tab-panel mt-4 px-1">
            <ClienteEndereco
              clienteId={selectedClienteId}
              onNext={() => setActiveTab("condicoes")}
              onSave={() => setActiveTab("condicoes")}
              cnpjData={cnpjData}
            />
          </TabsContent>

          <TabsContent value="condicoes" className="pdv-client-tab-panel mt-4 px-1">
            <ClienteCondicoes clienteId={selectedClienteId} />
          </TabsContent>

          <TabsContent value="contrato" className="pdv-client-tab-panel mt-4 px-1">
            <ClienteContrato clienteId={selectedClienteId} />
          </TabsContent>

        </Tabs>
      </div>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente deixará de aparecer entre os ativos, mas pedidos, pagamentos, contratos e demais históricos serão preservados. Ele poderá ser reativado depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveCliente}>
              Arquivar cliente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isPdvClientWorkspace) {
    return (
      <PdvLayout variant="front" operation={pdvOperation} title={pdvTitle} subtitle={pdvBreadcrumb}>
        {content}
      </PdvLayout>
    );
  }

  return <AppLayout title={pageTitle} subtitle={pageSubtitle}>{content}</AppLayout>;
};

export default Clientes;
