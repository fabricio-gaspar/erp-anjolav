import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import {
  Archive,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useFornecedores, type Fornecedor, type FornecedorInput } from "@/hooks/useFornecedores";
import { useSupplierDirectory } from "@/hooks/useSupplierDirectory";
import { useContasPagar } from "@/hooks/useContasPagar";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { buscarCnpj } from "@/services/apiServices";
import { validarCNPJ, validarCPF } from "@/lib/validacoesFiscais";
import { toast } from "sonner";
import { formatCurrencyInput, formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";
import {
  buildSupplierDirectoryCsv,
  getNextSupplierDueDate,
  normalizeSupplierDirectoryLetter,
  normalizeSupplierDirectoryPage,
  SUPPLIER_DIRECTORY_PAGE_SIZE,
  type SupplierDirectoryRecurrence,
  type SupplierDirectoryStatus,
} from "@/lib/supplierDirectory";

const SUPPLIER_CATEGORIES = [
  { value: "produtos_limpeza", label: "Produtos de limpeza" },
  { value: "quimicos", label: "Químicos e solventes" },
  { value: "embalagens", label: "Embalagens" },
  { value: "energia_agua", label: "Energia, água e gás" },
  { value: "aluguel", label: "Aluguel" },
  { value: "transporte", label: "Transporte e logística" },
  { value: "equipamentos", label: "Equipamentos e máquinas" },
  { value: "manutencao", label: "Manutenção" },
  { value: "outros", label: "Outros" },
] as const;

const SUPPLIER_FREQUENCIES = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
  { value: "avulso", label: "Avulso" },
] as const;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type SupplierFormState = Omit<Partial<FornecedorInput>, "valor_recorrente"> & {
  valor_recorrente?: number | string | null;
};

const DEFAULT_FORM: SupplierFormState = {
  ativo: true,
  categoria: "outros",
  endereco: {},
  frequencia_pagamento: "mensal",
  valor_recorrente: "",
  dia_vencimento: null,
};

const categoryLabel = (category: string | null) => (
  SUPPLIER_CATEGORIES.find(item => item.value === category)?.label ?? category ?? "Outros"
);

const frequencyLabel = (frequency: string | null) => (
  SUPPLIER_FREQUENCIES.find(item => item.value === frequency)?.label ?? frequency ?? "Mensal"
);

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function SupplierActions({
  supplier,
  accountPending,
  canCreateAccount,
  onCreateAccount,
  onEdit,
  onArchive,
  onReactivate,
}: {
  supplier: Fornecedor;
  accountPending: boolean;
  canCreateAccount: boolean;
  onCreateAccount: (supplier: Fornecedor) => void;
  onEdit: (supplier: Fornecedor) => void;
  onArchive: (supplier: Fornecedor) => void;
  onReactivate: (supplier: Fornecedor) => void;
}) {
  const hasRecurrence = Number(supplier.valor_recorrente) > 0
    && Boolean(supplier.dia_vencimento)
    && supplier.frequencia_pagamento === "mensal";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label={`Ações do fornecedor ${supplier.nome}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {canCreateAccount && supplier.ativo && hasRecurrence && (
          <DropdownMenuItem onClick={() => onCreateAccount(supplier)} disabled={accountPending}>
            <Receipt className="mr-2 h-4 w-4" />Gerar próxima despesa
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(supplier)}>
          <Pencil className="mr-2 h-4 w-4" />Editar cadastro
        </DropdownMenuItem>
        {supplier.ativo ? (
          <DropdownMenuItem onClick={() => onArchive(supplier)} className="text-destructive focus:text-destructive">
            <Archive className="mr-2 h-4 w-4" />Arquivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onReactivate(supplier)}>
            <Undo2 className="mr-2 h-4 w-4" />Reativar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Fornecedores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get("q") ?? "";
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const page = normalizeSupplierDirectoryPage(searchParams.get("pagina"));
  const selectedLetter = normalizeSupplierDirectoryLetter(searchParams.get("letra"));
  const requestedCategory = searchParams.get("categoria");
  const selectedCategory = SUPPLIER_CATEGORIES.some(item => item.value === requestedCategory)
    ? requestedCategory as string
    : "all";
  const requestedStatus = searchParams.get("situacao");
  const selectedStatus: SupplierDirectoryStatus = requestedStatus === "active" || requestedStatus === "inactive"
    ? requestedStatus
    : "all";
  const requestedRecurrence = searchParams.get("recorrencia");
  const selectedRecurrence: SupplierDirectoryRecurrence = requestedRecurrence === "configured" || requestedRecurrence === "not_configured"
    ? requestedRecurrence
    : "all";

  const {
    data: directory,
    isLoading,
    isFetching,
    error: directoryError,
    refetch,
  } = useSupplierDirectory({
    page,
    pageSize: SUPPLIER_DIRECTORY_PAGE_SIZE,
    search: deferredSearchTerm,
    letter: selectedLetter,
    category: selectedCategory,
    status: selectedStatus,
    recurrence: selectedRecurrence,
  });
  const { criarFornecedor, atualizarFornecedor, setFornecedorStatus } = useFornecedores({ enabled: false });
  const { allowed: canManageAccounts } = usePermissaoModulo("contas_pagar");
  const { createConta } = useContasPagar(false);
  const suppliers = directory?.fornecedores ?? [];
  const totalSuppliers = directory?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSuppliers / SUPPLIER_DIRECTORY_PAGE_SIZE));
  const firstVisible = totalSuppliers === 0 ? 0 : (page - 1) * SUPPLIER_DIRECTORY_PAGE_SIZE + 1;
  const lastVisible = Math.min(page * SUPPLIER_DIRECTORY_PAGE_SIZE, totalSuppliers);
  const activeOnPage = suppliers.filter(supplier => supplier.ativo).length;
  const recurrentOnPage = suppliers.filter(supplier => Number(supplier.valor_recorrente) > 0).length;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<SupplierFormState>(DEFAULT_FORM);
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [supplierToArchive, setSupplierToArchive] = useState<Fornecedor | null>(null);
  const [supplierForAccount, setSupplierForAccount] = useState<Fornecedor | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<"nome" | "cnpj_cpf" | "telefone" | "email" | "valor_recorrente" | "dia_vencimento", string>>>({});

  const openNew = useCallback(() => {
    setEditingSupplier(null);
    setForm(DEFAULT_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    openNew();
    const next = new URLSearchParams(searchParams);
    next.delete("novo");
    setSearchParams(next, { replace: true });
  }, [openNew, searchParams, setSearchParams]);

  const openEdit = (supplier: Fornecedor) => {
    setFormErrors({});
    setEditingSupplier(supplier);
    setForm({
      nome: supplier.nome,
      razao_social: supplier.razao_social,
      cnpj_cpf: supplier.cnpj_cpf,
      telefone: supplier.telefone,
      email: supplier.email,
      contato_nome: supplier.contato_nome,
      endereco: supplier.endereco ?? {},
      categoria: supplier.categoria,
      observacoes: supplier.observacoes,
      ativo: supplier.ativo,
      valor_recorrente: supplier.valor_recorrente
        ? formatNumberToCurrency(Number(supplier.valor_recorrente))
        : "",
      dia_vencimento: supplier.dia_vencimento,
      frequencia_pagamento: supplier.frequencia_pagamento,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSupplier(null);
    setForm(DEFAULT_FORM);
    setFormErrors({});
  };

  const saveSupplier = () => {
    const name = form.nome?.trim();
    const recurringValue = typeof form.valor_recorrente === "number"
      ? form.valor_recorrente
      : parseCurrencyToNumber(String(form.valor_recorrente ?? ""));
    const dueDay = form.dia_vencimento == null || form.dia_vencimento === 0
      ? null
      : Number(form.dia_vencimento);
    const document = form.cnpj_cpf?.replace(/\D/g, "") ?? "";
    const email = form.email?.trim() ?? "";
    const phone = form.telefone?.replace(/\D/g, "") ?? "";
    const errors: typeof formErrors = {};
    if (!name || name.length < 2 || name.length > 160) errors.nome = "Informe um nome entre 2 e 160 caracteres";
    if (document && !(document.length === 11 ? validarCPF(document) : document.length === 14 && validarCNPJ(document))) errors.cnpj_cpf = "Informe um CPF ou CNPJ válido";
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = "Informe um e-mail válido";
    if (phone && (phone.length < 10 || phone.length > 15)) errors.telefone = "Informe um telefone com 10 a 15 dígitos";
    if (!Number.isFinite(recurringValue) || recurringValue < 0) errors.valor_recorrente = "Informe um valor válido";
    if (recurringValue > 0 && (!Number.isInteger(dueDay) || dueDay == null || dueDay < 1 || dueDay > 31)) errors.dia_vencimento = "Informe um dia entre 1 e 31";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Revise os campos destacados antes de salvar");
      return;
    }

    const payload: FornecedorInput = {
      nome: name,
      razao_social: nullableText(form.razao_social),
      cnpj_cpf: nullableText(form.cnpj_cpf),
      telefone: nullableText(form.telefone),
      email: nullableText(form.email)?.toLocaleLowerCase("pt-BR") ?? null,
      contato_nome: nullableText(form.contato_nome),
      endereco: form.endereco ?? {},
      categoria: form.categoria ?? "outros",
      observacoes: nullableText(form.observacoes),
      ativo: form.ativo ?? true,
      valor_recorrente: recurringValue > 0 ? recurringValue : null,
      dia_vencimento: recurringValue > 0 ? dueDay : null,
      frequencia_pagamento: recurringValue > 0 ? form.frequencia_pagamento ?? "mensal" : null,
    };

    if (editingSupplier) {
      atualizarFornecedor.mutate({ id: editingSupplier.id, ...payload }, { onSuccess: closeModal });
    } else {
      criarFornecedor.mutate(payload, { onSuccess: closeModal });
    }
  };

  const lookupCnpj = async () => {
    const cnpj = form.cnpj_cpf?.replace(/\D/g, "");
    if (!cnpj || cnpj.length !== 14) {
      toast.error("Informe um CNPJ com 14 dígitos");
      return;
    }
    setLookingUpCnpj(true);
    try {
      const data = await buscarCnpj(cnpj);
      if (!data) {
        toast.error("CNPJ não encontrado");
        return;
      }
      setForm(previous => ({
        ...previous,
        nome: data.nome_fantasia || data.razao_social || previous.nome,
        razao_social: data.razao_social || previous.razao_social,
        telefone: data.ddd_telefone_1
          ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}`
          : previous.telefone,
        email: data.email || previous.email,
        endereco: {
          cep: data.cep,
          logradouro: data.logradouro,
          numero: data.numero,
          bairro: data.bairro,
          cidade: data.municipio,
          uf: data.uf,
        },
      }));
      toast.success("Dados do CNPJ carregados");
    } catch {
      toast.error("Não foi possível consultar o CNPJ agora");
    } finally {
      setLookingUpCnpj(false);
    }
  };

  const createNextAccount = (supplier: Fornecedor) => {
    if (!canManageAccounts) {
      toast.error("Sem permissão para criar despesas");
      return;
    }
    if (supplier.frequencia_pagamento !== "mensal") {
      toast.error("A geração assistida está disponível somente para recorrência mensal");
      return;
    }
    const dueDate = getNextSupplierDueDate(Number(supplier.dia_vencimento));
    if (!dueDate || !supplier.valor_recorrente || Number(supplier.valor_recorrente) <= 0) {
      toast.error("Configure valor e dia de vencimento antes de gerar a despesa");
      return;
    }
    const monthYear = format(parseISO(dueDate), "MMMM 'de' yyyy", { locale: ptBR });
    createConta.mutate({
      descricao: `Pagamento ${supplier.nome} — ${monthYear}`,
      fornecedor: supplier.nome,
      fornecedor_id: supplier.id,
      valor: Number(supplier.valor_recorrente),
      vencimento: dueDate,
      categoria: categoryLabel(supplier.categoria),
      observacoes: `Gerado do cadastro recorrente do fornecedor ${supplier.nome}`,
      idempotencyKey: `supplier:${supplier.id}:${dueDate.slice(0, 7)}`,
    }, { onSuccess: () => setSupplierForAccount(null) });
  };

  const archiveSupplier = () => {
    if (!supplierToArchive) return;
    setFornecedorStatus.mutate(
      { id: supplierToArchive.id, ativo: false },
      { onSuccess: () => setSupplierToArchive(null) },
    );
  };

  const reactivateSupplier = (supplier: Fornecedor) => {
    setFornecedorStatus.mutate({ id: supplier.id, ativo: true });
  };

  const exportPage = () => {
    if (suppliers.length === 0) {
      toast.error("Nenhum fornecedor para exportar");
      return;
    }
    const headers = [
      "Nome", "Razão social", "CNPJ/CPF", "Categoria", "Contato", "Telefone", "E-mail",
      "Valor recorrente", "Dia do vencimento", "Frequência", "Situação",
    ];
    const rows = suppliers.map(supplier => [
      supplier.nome,
      supplier.razao_social,
      supplier.cnpj_cpf,
      categoryLabel(supplier.categoria),
      supplier.contato_nome,
      supplier.telefone,
      supplier.email,
      supplier.valor_recorrente ? Number(supplier.valor_recorrente).toFixed(2) : "",
      supplier.dia_vencimento,
      frequencyLabel(supplier.frequencia_pagamento),
      supplier.ativo ? "Ativo" : "Arquivado",
    ]);
    const csv = buildSupplierDirectoryCsv(headers, rows);
    const objectUrl = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `fornecedores_pagina_${page}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    toast.success("Página exportada com sucesso");
  };

  const updateDirectoryParams = useCallback((updates: {
    query?: string;
    letter?: string;
    category?: string;
    status?: SupplierDirectoryStatus;
    recurrence?: SupplierDirectoryRecurrence;
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
    if (updates.status !== undefined) {
      if (updates.status === "all") next.delete("situacao");
      else next.set("situacao", updates.status);
    }
    if (updates.recurrence !== undefined) {
      if (updates.recurrence === "all") next.delete("recorrencia");
      else next.set("recorrencia", updates.recurrence);
    }
    if (updates.page !== undefined) {
      if (updates.page > 1) next.set("pagina", String(updates.page));
      else next.delete("pagina");
    }
    if (
      updates.query !== undefined || updates.letter !== undefined || updates.category !== undefined ||
      updates.status !== undefined || updates.recurrence !== undefined
    ) next.delete("pagina");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const hasFilters = Boolean(
    searchTerm || selectedLetter !== "TODOS" || selectedCategory !== "all" ||
    selectedStatus !== "all" || selectedRecurrence !== "all",
  );
  const clearFilters = () => updateDirectoryParams({
    query: "",
    letter: "TODOS",
    category: "all",
    status: "all",
    recurrence: "all",
  });

  useEffect(() => {
    if (isLoading || totalSuppliers === 0 || page <= totalPages) return;
    updateDirectoryParams({ page: totalPages });
  }, [isLoading, page, totalPages, totalSuppliers, updateDirectoryParams]);

  const address = (form.endereco ?? {}) as Record<string, string>;
  const updateAddress = (field: string, value: string) => {
    setForm(previous => ({ ...previous, endereco: { ...address, [field]: value } }));
  };
  const mutationPending = criarFornecedor.isPending || atualizarFornecedor.isPending || setFornecedorStatus.isPending;
  const accountDueDate = supplierForAccount ? getNextSupplierDueDate(Number(supplierForAccount.dia_vencimento)) : null;

  return (
    <AppLayout title="Fornecedores" subtitle="Parceiros de compras, estoque e despesas">
      <div className="page-shell">
        <PageHeader
          eyebrow="SUPRIMENTOS · PARCEIROS COMERCIAIS"
          title="Fornecedores"
          description="Cadastros compartilhados entre compras, estoque e contas a pagar"
          actions={(
            <>
              <Button variant="outline" onClick={exportPage} disabled={suppliers.length === 0} className="w-full gap-2 sm:w-auto">
                <Download className="h-4 w-4" />Exportar página
              </Button>
              <Button onClick={openNew} className="w-full gap-2 font-bold sm:w-auto">
                <Plus className="h-4 w-4" />Novo fornecedor
              </Button>
            </>
          )}
        />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Resumo do diretório de fornecedores">
          <div className="content-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">No filtro atual</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{totalSuppliers}</p>
            <p className="text-xs text-muted-foreground">fornecedores em todas as páginas</p>
          </div>
          <div className="content-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nesta página</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{activeOnPage}</p>
            <p className="text-xs text-muted-foreground">ativos entre {suppliers.length} exibidos</p>
          </div>
          <div className="content-panel p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorrência</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{recurrentOnPage}</p>
            <p className="text-xs text-muted-foreground">configurados nesta página</p>
          </div>
        </section>

        <div className="content-panel space-y-4">
          <section className="space-y-3" aria-label="Filtros de fornecedores">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_170px_210px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={event => updateDirectoryParams({ query: event.target.value })}
                  placeholder="Nome, documento, contato, telefone ou e-mail"
                  aria-label="Pesquisar fornecedores por nome, documento, contato, telefone ou e-mail"
                  className="pl-10 text-base md:text-sm"
                  skipUppercase
                />
              </div>
              <Select value={selectedCategory} onValueChange={category => updateDirectoryParams({ category })}>
                <SelectTrigger aria-label="Filtrar fornecedores por categoria"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {SUPPLIER_CATEGORIES.map(category => (
                    <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={status => updateDirectoryParams({ status: status as SupplierDirectoryStatus })}>
                <SelectTrigger aria-label="Filtrar fornecedores por situação"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as situações</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Arquivados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedRecurrence} onValueChange={recurrence => updateDirectoryParams({ recurrence: recurrence as SupplierDirectoryRecurrence })}>
                <SelectTrigger aria-label="Filtrar fornecedores por recorrência"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda recorrência</SelectItem>
                  <SelectItem value="configured">Recorrência configurada</SelectItem>
                  <SelectItem value="not_configured">Sem recorrência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-1" aria-label="Filtrar fornecedores pela inicial do nome">
              <Button type="button" variant={selectedLetter === "TODOS" ? "default" : "outline"} size="sm" className="h-9 px-3" onClick={() => updateDirectoryParams({ letter: "TODOS" })}>
                Todos
              </Button>
              {ALPHABET.map(letter => (
                <Button
                  key={letter}
                  type="button"
                  variant={selectedLetter === letter ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9"
                  aria-label={`Fornecedores iniciados por ${letter}`}
                  onClick={() => updateDirectoryParams({ letter })}
                >
                  {letter}
                </Button>
              ))}
            </div>

            <div className="flex min-h-9 flex-wrap items-center justify-between gap-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">A consulta respeita usuário, empresa ativa e permissões de suprimentos.</p>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="gap-2" onClick={clearFilters}>
                  <RotateCcw className="h-4 w-4" />Limpar filtros
                </Button>
              )}
            </div>
          </section>

          {isFetching && !isLoading && <p className="text-xs text-muted-foreground" role="status" aria-live="polite">Atualizando fornecedores…</p>}

          {isLoading ? (
            <div className="flex items-center justify-center py-16" role="status">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Carregando fornecedores…</span>
            </div>
          ) : directoryError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-destructive" role="alert">
              <p>Não foi possível carregar os fornecedores.</p>
              <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Building2 className="h-7 w-7 text-primary/70" /></div>
              <p className="font-semibold text-foreground">{hasFilters ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {hasFilters
                  ? "Revise a busca ou limpe os filtros para consultar todo o diretório desta empresa."
                  : "Cadastre o primeiro parceiro para vinculá-lo às compras, ao estoque e às despesas."}
              </p>
              <Button variant="link" className="mt-1 px-0 font-semibold" onClick={hasFilters ? clearFilters : openNew}>
                {hasFilters ? "Limpar filtros" : "Cadastrar primeiro fornecedor"}
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {suppliers.map(supplier => (
                  <article key={supplier.id} className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-primary" />
                          <h2 className="truncate font-semibold text-foreground">{supplier.nome}</h2>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{supplier.cnpj_cpf || supplier.razao_social || "Documento não informado"}</p>
                      </div>
                      <SupplierActions supplier={supplier} accountPending={createConta.isPending} canCreateAccount={canManageAccounts} onCreateAccount={setSupplierForAccount} onEdit={openEdit} onArchive={setSupplierToArchive} onReactivate={reactivateSupplier} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="secondary">{categoryLabel(supplier.categoria)}</Badge>
                      <Badge variant={supplier.ativo ? "default" : "outline"}>{supplier.ativo ? "Ativo" : "Arquivado"}</Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm min-[390px]:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Contato</dt>
                        <dd className="mt-0.5 break-words text-foreground">{supplier.contato_nome || supplier.telefone || supplier.email || "Não informado"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Pagamento recorrente</dt>
                        <dd className="mt-0.5 text-foreground">
                          {supplier.valor_recorrente ? `R$ ${formatNumberToCurrency(Number(supplier.valor_recorrente))} · dia ${supplier.dia_vencimento ?? "—"}` : "Não configurado"}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border md:block" role="region" aria-label="Tabela de fornecedores" tabIndex={0}>
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Pagamento recorrente</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-16 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map(supplier => (
                      <TableRow key={supplier.id}>
                        <TableCell>
                          <div className="max-w-[260px]">
                            <p className="truncate font-semibold text-foreground">{supplier.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">{supplier.cnpj_cpf || supplier.razao_social || "Documento não informado"}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{categoryLabel(supplier.categoria)}</Badge></TableCell>
                        <TableCell>
                          <div className="max-w-[220px] space-y-0.5 text-sm">
                            {supplier.contato_nome && <p className="truncate font-medium">{supplier.contato_nome}</p>}
                            {supplier.telefone && <p className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{supplier.telefone}</p>}
                            {supplier.email && <p className="flex items-center gap-1 truncate text-muted-foreground"><Mail className="h-3 w-3 shrink-0" />{supplier.email}</p>}
                            {!supplier.contato_nome && !supplier.telefone && !supplier.email && <span className="text-muted-foreground">Não informado</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {supplier.valor_recorrente ? (
                            <div className="text-sm">
                              <p className="font-semibold text-foreground">R$ {formatNumberToCurrency(Number(supplier.valor_recorrente))}</p>
                              <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3 w-3" />Dia {supplier.dia_vencimento ?? "—"} · {frequencyLabel(supplier.frequencia_pagamento)}</p>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">Não configurado</span>}
                        </TableCell>
                        <TableCell><Badge variant={supplier.ativo ? "default" : "outline"}>{supplier.ativo ? "Ativo" : "Arquivado"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <SupplierActions supplier={supplier} accountPending={createConta.isPending} canCreateAccount={canManageAccounts} onCreateAccount={setSupplierForAccount} onEdit={openEdit} onArchive={setSupplierToArchive} onReactivate={reactivateSupplier} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {!isLoading && !directoryError && totalSuppliers > 0 && (
            <nav className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginação de fornecedores">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Exibindo <span className="font-semibold text-foreground">{firstVisible}–{lastVisible}</span> de {totalSuppliers} fornecedores
              </p>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page - 1 })} disabled={page <= 1 || isFetching} aria-label="Página anterior de fornecedores">
                  <ChevronLeft className="h-4 w-4" />Anterior
                </Button>
                <span className="min-w-24 text-center text-sm font-medium">Página {page} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => updateDirectoryParams({ page: page + 1 })} disabled={page >= totalPages || isFetching} aria-label="Próxima página de fornecedores">
                  Próxima<ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={open => { if (!open) closeModal(); else setModalOpen(true); }}>
        <DialogContent className="wide-form-dialog max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <section className="space-y-3" aria-labelledby="supplier-basic-data">
              <h3 id="supplier-basic-data" className="text-sm font-semibold text-foreground">Identificação</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="supplier-document">CNPJ ou CPF</Label>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <Input id="supplier-document" value={form.cnpj_cpf || ""} onChange={event => { setForm(previous => ({ ...previous, cnpj_cpf: event.target.value })); setFormErrors(previous => ({ ...previous, cnpj_cpf: undefined })); }} placeholder="00.000.000/0000-00" className="flex-1 text-base md:text-sm" aria-invalid={Boolean(formErrors.cnpj_cpf)} aria-describedby={formErrors.cnpj_cpf ? "supplier-document-error" : undefined} />
                    <Button type="button" variant="outline" onClick={() => void lookupCnpj()} disabled={lookingUpCnpj}>{lookingUpCnpj ? "Consultando…" : "Consultar CNPJ"}</Button>
                  </div>
                  {formErrors.cnpj_cpf && <p id="supplier-document-error" className="mt-1 text-xs text-destructive">{formErrors.cnpj_cpf}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">A consulta externa é opcional; revise os dados antes de salvar.</p>
                </div>
                <div>
                  <Label htmlFor="supplier-category">Categoria</Label>
                  <Select value={form.categoria || "outros"} onValueChange={value => setForm(previous => ({ ...previous, categoria: value }))}>
                    <SelectTrigger id="supplier-category" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPLIER_CATEGORIES.map(category => <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="supplier-name">Nome do fornecedor *</Label>
                  <Input id="supplier-name" value={form.nome || ""} onChange={event => { setForm(previous => ({ ...previous, nome: event.target.value })); setFormErrors(previous => ({ ...previous, nome: undefined })); }} className="mt-1 text-base md:text-sm" aria-invalid={Boolean(formErrors.nome)} aria-describedby={formErrors.nome ? "supplier-name-error" : undefined} />
                  {formErrors.nome && <p id="supplier-name-error" className="mt-1 text-xs text-destructive">{formErrors.nome}</p>}
                </div>
                <div>
                  <Label htmlFor="supplier-legal-name">Razão social</Label>
                  <Input id="supplier-legal-name" value={form.razao_social || ""} onChange={event => setForm(previous => ({ ...previous, razao_social: event.target.value }))} className="mt-1 text-base md:text-sm" />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3" aria-labelledby="supplier-contact-data">
              <h3 id="supplier-contact-data" className="text-sm font-semibold text-foreground">Contato</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="supplier-contact">Pessoa de contato</Label>
                  <Input id="supplier-contact" value={form.contato_nome || ""} onChange={event => setForm(previous => ({ ...previous, contato_nome: event.target.value }))} className="mt-1 text-base md:text-sm" />
                </div>
                <div>
                  <Label htmlFor="supplier-phone">Telefone</Label>
                  <Input id="supplier-phone" inputMode="tel" value={form.telefone || ""} onChange={event => { setForm(previous => ({ ...previous, telefone: event.target.value })); setFormErrors(previous => ({ ...previous, telefone: undefined })); }} className="mt-1 text-base md:text-sm" aria-invalid={Boolean(formErrors.telefone)} aria-describedby={formErrors.telefone ? "supplier-phone-error" : undefined} />
                  {formErrors.telefone && <p id="supplier-phone-error" className="mt-1 text-xs text-destructive">{formErrors.telefone}</p>}
                </div>
                <div>
                  <Label htmlFor="supplier-email">E-mail</Label>
                  <Input id="supplier-email" type="email" value={form.email || ""} onChange={event => { setForm(previous => ({ ...previous, email: event.target.value })); setFormErrors(previous => ({ ...previous, email: undefined })); }} className="mt-1 text-base md:text-sm" skipUppercase aria-invalid={Boolean(formErrors.email)} aria-describedby={formErrors.email ? "supplier-email-error" : undefined} />
                  {formErrors.email && <p id="supplier-email-error" className="mt-1 text-xs text-destructive">{formErrors.email}</p>}
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3" aria-labelledby="supplier-recurrence-data">
              <div>
                <h3 id="supplier-recurrence-data" className="text-sm font-semibold text-foreground">Pagamento recorrente opcional</h3>
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma conta é criada automaticamente. O atalho de geração usa somente a frequência mensal; semanal, quinzenal e anual permanecem informativas até existir um calendário próprio.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="supplier-recurring-value">Valor de referência</Label>
                  <Input id="supplier-recurring-value" inputMode="decimal" value={form.valor_recorrente ?? ""} onChange={event => { setForm(previous => ({ ...previous, valor_recorrente: formatCurrencyInput(event.target.value) })); setFormErrors(previous => ({ ...previous, valor_recorrente: undefined })); }} placeholder="0,00" className="mt-1 text-base md:text-sm" aria-invalid={Boolean(formErrors.valor_recorrente)} />
                  {formErrors.valor_recorrente && <p className="mt-1 text-xs text-destructive">{formErrors.valor_recorrente}</p>}
                </div>
                <div>
                  <Label htmlFor="supplier-due-day">Dia do vencimento</Label>
                  <Input id="supplier-due-day" type="number" min={1} max={31} value={form.dia_vencimento ?? ""} onChange={event => { setForm(previous => ({ ...previous, dia_vencimento: event.target.value ? Number(event.target.value) : null })); setFormErrors(previous => ({ ...previous, dia_vencimento: undefined })); }} className="mt-1 text-base md:text-sm" aria-invalid={Boolean(formErrors.dia_vencimento)} />
                  {formErrors.dia_vencimento && <p className="mt-1 text-xs text-destructive">{formErrors.dia_vencimento}</p>}
                </div>
                <div>
                  <Label htmlFor="supplier-frequency">Frequência de referência</Label>
                  <Select value={form.frequencia_pagamento || "mensal"} onValueChange={value => setForm(previous => ({ ...previous, frequencia_pagamento: value }))}>
                    <SelectTrigger id="supplier-frequency" className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUPPLIER_FREQUENCIES.map(frequency => <SelectItem key={frequency.value} value={frequency.value}>{frequency.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-3" aria-labelledby="supplier-address-data">
              <h3 id="supplier-address-data" className="flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className="h-4 w-4" />Endereço</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <Label htmlFor="supplier-zip">CEP</Label>
                  <Input id="supplier-zip" value={address.cep || ""} onChange={event => updateAddress("cep", event.target.value)} placeholder="00000-000" className="mt-1 text-base md:text-sm" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="supplier-street">Logradouro</Label>
                  <Input id="supplier-street" value={address.logradouro || ""} onChange={event => updateAddress("logradouro", event.target.value)} className="mt-1 text-base md:text-sm" />
                </div>
                <div>
                  <Label htmlFor="supplier-number">Número</Label>
                  <Input id="supplier-number" value={address.numero || ""} onChange={event => updateAddress("numero", event.target.value)} className="mt-1 text-base md:text-sm" />
                </div>
                <div>
                  <Label htmlFor="supplier-district">Bairro</Label>
                  <Input id="supplier-district" value={address.bairro || ""} onChange={event => updateAddress("bairro", event.target.value)} className="mt-1 text-base md:text-sm" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="supplier-city">Cidade</Label>
                  <Input id="supplier-city" value={address.cidade || ""} onChange={event => updateAddress("cidade", event.target.value)} className="mt-1 text-base md:text-sm" />
                </div>
                <div>
                  <Label htmlFor="supplier-state">UF</Label>
                  <Input id="supplier-state" value={address.uf || ""} onChange={event => updateAddress("uf", event.target.value)} maxLength={2} className="mt-1 text-base md:text-sm" />
                </div>
              </div>
            </section>

            <div>
              <Label htmlFor="supplier-notes">Observações comerciais</Label>
              <Textarea id="supplier-notes" value={form.observacoes || ""} onChange={event => setForm(previous => ({ ...previous, observacoes: event.target.value }))} rows={3} className="mt-1 text-base md:text-sm" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="button" onClick={saveSupplier} disabled={mutationPending}>
              {mutationPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingSupplier ? "Salvar alterações" : "Cadastrar fornecedor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(supplierForAccount)} onOpenChange={open => { if (!open) setSupplierForAccount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar próxima despesa</AlertDialogTitle>
            <AlertDialogDescription>
              Revise a conta antes de criá-la: {supplierForAccount?.nome}, valor de {Number(supplierForAccount?.valor_recorrente ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              {accountDueDate ? `, vencimento em ${format(parseISO(accountDueDate), "dd/MM/yyyy")}.` : ". Configure um dia de vencimento válido."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!canManageAccounts || !accountDueDate || createConta.isPending} onClick={(event) => { event.preventDefault(); if (supplierForAccount) createNextAccount(supplierForAccount); }}>Criar despesa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(supplierToArchive)} onOpenChange={open => { if (!open) setSupplierToArchive(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{supplierToArchive?.nome}</strong> deixará de aparecer em novas compras e despesas. Pedidos de compra, contas, créditos e movimentações já vinculados continuarão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={archiveSupplier} disabled={setFornecedorStatus.isPending}>Arquivar fornecedor</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
