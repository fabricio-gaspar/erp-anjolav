import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  ShoppingCart,
  Search,
  ClipboardList,
  Printer,
  Check,
  User,
  Pencil,
  Trash2,
  FileText,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
  ChevronsUpDown,
  Package,
  AlertCircle,
  Scale,
  Boxes,
  TrendingUp,
  DollarSign,
  Play,
  Receipt,
  MoreHorizontal,
  Ban,
  Edit,
  X,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintLancamento, type LancamentosPrintData } from "@/hooks/usePrintOS";
import { useClientes } from "@/hooks/useClientes";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useConferenciaProducao, type OSConferencia, type ItemOS } from "@/hooks/useConferenciaProducao";
import { ConferenciaModal } from "@/components/lancamentos/ConferenciaModal";
import { 
  useLancamentos, 
  useLancamentosPendentes, 
  useLancamentosComItens,
  useItensLancamento,
  useCreateItemLancamento,
  type Lancamento as LancamentoType,
  type ItemLancamento,
} from "@/hooks/useLancamentos";
import { useFaturas, type Fatura } from "@/hooks/useFaturas";
import { FaturamentoModal, type DadosFaturamento, type LancamentoItem as FaturaLancamentoItem } from "@/components/faturamento/FaturamentoModal";
import { DetalhesFaturaModal } from "@/components/faturamento/DetalhesFaturaModal";
import { VisualizarItensModal } from "@/components/faturamento/VisualizarItensModal";
import { EditarLancamentoModal } from "@/components/faturamento/EditarLancamentoModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface LancamentoItem {
  id: string;
  produto: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

interface ClienteSelecionado {
  nome: string;
  documento: string;
  telefone: string;
}

// Helper para mapear status para config visual
const getStatusConfig = (status: string) => {
  switch (status) {
    case "pendente":
      return { label: "Pendente", variant: "warning" as const };
    case "relatorio_gerado":
      return { label: "Relatório Gerado", variant: "info" as const };
    case "nota_emitida":
      return { label: "Nota Emitida", variant: "info" as const };
    case "pagamento_configurado":
      return { label: "Aguardando Envio", variant: "info" as const };
    case "enviada":
    case "enviado":
      return { label: "Enviada", variant: "default" as const };
    case "pago":
      return { label: "Pago", variant: "success" as const };
    case "cancelado":
      return { label: "Cancelado", variant: "danger" as const };
    default:
      return { label: status, variant: "default" as const };
  }
};

// Helper para reconstruir DadosFaturamento de uma fatura existente
const reconstruirDadosFaturamento = (fatura: Fatura): DadosFaturamento => {
  const itensSnapshot = (fatura.itens_snapshot as Array<{
    id: string;
    produto: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
    valor_total: number;
  }>) || [];

  const itens: FaturaLancamentoItem[] = itensSnapshot.map((item) => ({
    id: item.id,
    produto: item.produto,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valorUnitario: item.valor_unitario,
    valorTotal: item.valor_total,
  }));

  return {
    clienteId: fatura.cliente_id,
    clienteNome: fatura.cliente?.razao_social || "Cliente",
    clienteDocumento: fatura.cliente?.cpf_cnpj || "",
    clienteEmail: fatura.cliente?.email || null,
    clienteTelefone: fatura.cliente?.telefone || null,
    itens,
    valorTotal: Number(fatura.valor_total),
    periodoInicio: fatura.periodo_inicio,
    periodoFim: fatura.periodo_fim,
    observacao: fatura.observacao_fatura || undefined,
  };
};

const Lancamentos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Tab from URL or default to "novo"
  const tabFromUrl = searchParams.get("tab") || "novo";
  const clienteFiltroId = searchParams.get("cliente");
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [items, setItems] = useState<LancamentoItem[]>([]);

  // Cliente selection state
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");

  // Produto selection state
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null);
  const [produtoSearchOpen, setProdutoSearchOpen] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(1);
  
  // Metragem state for metro-based billing
  const [modoMetragem, setModoMetragem] = useState<"direto" | "dimensoes">("direto");
  const [metragemDireta, setMetragemDireta] = useState<string>("");
  const [comprimento, setComprimento] = useState<string>("");
  const [largura, setLargura] = useState<string>("");

  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataEntrega, setDataEntrega] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacao, setObservacao] = useState("");
  
  // Conferência state
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOS, setSelectedOS] = useState<OSConferencia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isFinalizando, setIsFinalizando] = useState(false);

  // === Faturamento States (moved from Faturamento.tsx) ===
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLancamentos, setSelectedLancamentos] = useState<string[]>([]);
  const [faturamentoModalOpen, setFaturamentoModalOpen] = useState(false);
  const [wizardDados, setWizardDados] = useState<DadosFaturamento | null>(null);
  const [faturaParaContinuar, setFaturaParaContinuar] = useState<Fatura | null>(null);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [faturaDetalhes, setFaturaDetalhes] = useState<Fatura | null>(null);

  // Estados para gestão de lançamentos pendentes
  const [visualizarItensOpen, setVisualizarItensOpen] = useState(false);
  const [editarLancamentoOpen, setEditarLancamentoOpen] = useState(false);
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<LancamentoType | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<LancamentoType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");

  // Hooks
  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { precos: precosEspeciais, isLoading: isLoadingPrecos } = usePrecosEspeciais(selectedClienteId);
  const { data: osConferencias, isLoading: isLoadingConferencias } = useConferenciaProducao(
    undefined,
    statusFilter !== "todos" ? statusFilter : undefined
  );
  const { printROLFromData, printEtiquetaFromData, isLoading: isPrinting } = usePrintLancamento();
  const { createLancamento } = useLancamentos();
  const createItemLancamento = useCreateItemLancamento();
  
  // Faturamento hooks
  const { faturas, summary, isLoading: isLoadingFaturas, updateFatura } = useFaturas(periodoInicio, periodoFim);
  const { lancamentos: lancamentosPendentes, isLoading: isLoadingLancamentos, updateLancamento, deleteLancamento } = useLancamentosPendentes();
  const { data: lancamentosComItens, isLoading: isLoadingItens } = useLancamentosComItens(selectedLancamentos);
  const { data: itensLancamentoSelecionado = [], isLoading: isLoadingItensLancamento } = useItensLancamento(lancamentoSelecionado?.id || null);

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

  // Update tab in URL when changed
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    if (activeTab !== "novo") {
      newParams.set("tab", activeTab);
    } else {
      newParams.delete("tab");
    }
    setSearchParams(newParams, { replace: true });
  }, [activeTab]);

  // Set active tab from URL on mount
  useEffect(() => {
    if (tabFromUrl && ["novo", "pendentes", "faturas", "conferencia"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, []);

  // Get selected cliente info
  const clienteSelecionado = useMemo(() => {
    if (!selectedClienteId) return null;
    const cliente = clientes.find(c => c.id === selectedClienteId);
    if (!cliente) return null;
    return {
      nome: cliente.razao_social,
      documento: cliente.cpf_cnpj || "",
      telefone: cliente.telefone || "",
    };
  }, [selectedClienteId, clientes]);

  // Filter clientes by search
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch) return clientes.slice(0, 20);
    const searchLower = clienteSearch.toLowerCase();
    return clientes.filter((c) =>
      c.razao_social.toLowerCase().includes(searchLower) ||
      c.nome_fantasia?.toLowerCase().includes(searchLower) ||
      c.cpf_cnpj?.includes(clienteSearch) ||
      c.telefone?.includes(clienteSearch)
    ).slice(0, 20);
  }, [clientes, clienteSearch]);

  // Transform precos especiais to produto options
  const produtosDoCliente = useMemo(() => {
    return precosEspeciais.map((pe: any) => ({
      id: pe.produto_id,
      nome: pe.produto?.nome || "Produto",
      unidade: pe.produto?.unidade || "un",
      precoEspecial: pe.preco_especial,
      precoPadrao: pe.produto?.preco || 0,
      tipo: pe.tipo,
    }));
  }, [precosEspeciais]);

  // Get selected produto info
  const produtoSelecionado = useMemo(() => {
    if (!selectedProdutoId) return null;
    return produtosDoCliente.find(p => p.id === selectedProdutoId) || null;
  }, [selectedProdutoId, produtosDoCliente]);

  // Reset items when cliente changes
  useEffect(() => {
    setItems([]);
    setSelectedProdutoId(null);
    setQuantidade(1);
    resetMetragem();
  }, [selectedClienteId]);

  // Helper to check if product uses metro
  const isUnidadeMetro = (unidade: string | null | undefined): boolean => {
    if (!unidade) return false;
    const u = unidade.toLowerCase();
    return u === "m" || u === "m²" || u === "m2" || u === "metro" || u === "metros" || u.includes("metro");
  };

  // Calculate metragem based on mode
  const metragemCalculada = useMemo(() => {
    if (modoMetragem === "direto") {
      return parseFloat(metragemDireta) || 0;
    } else {
      const c = parseFloat(comprimento) || 0;
      const l = parseFloat(largura) || 0;
      return c * l;
    }
  }, [modoMetragem, metragemDireta, comprimento, largura]);

  // Reset metragem fields
  const resetMetragem = () => {
    setModoMetragem("direto");
    setMetragemDireta("");
    setComprimento("");
    setLargura("");
  };

  // Handle add item
  const handleAdicionarItem = () => {
    if (!produtoSelecionado) return;

    const usaMetro = isUnidadeMetro(produtoSelecionado.unidade);
    const qtd = usaMetro ? metragemCalculada : quantidade;
    
    if (qtd <= 0) return;

    let descricaoProduto = produtoSelecionado.nome;
    if (usaMetro && modoMetragem === "dimensoes" && comprimento && largura) {
      descricaoProduto = `${produtoSelecionado.nome} (${comprimento}m × ${largura}m)`;
    }

    const novoItem: LancamentoItem = {
      id: crypto.randomUUID(),
      produto: descricaoProduto,
      quantidade: qtd,
      unidade: produtoSelecionado.unidade,
      valorUnitario: produtoSelecionado.precoEspecial,
      valorTotal: produtoSelecionado.precoEspecial * qtd,
    };

    setItems([...items, novoItem]);
    setSelectedProdutoId(null);
    setQuantidade(1);
    resetMetragem();
  };

  // Filter conferencias by search
  const filteredConferencias = useMemo(() => {
    if (!osConferencias) return [];
    if (!searchQuery) return osConferencias;
    return osConferencias.filter((os) =>
      os.cliente.razao_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      os.numero.includes(searchQuery)
    );
  }, [osConferencias, searchQuery]);

  // Summary counts
  const conferenciasCounts = useMemo(() => {
    if (!osConferencias) return { pendente: 0, fluxo_completo: 0, divergencia: 0, lancado: 0 };
    return {
      pendente: osConferencias.filter((os) => os.statusConferencia === "pendente").length,
      fluxo_completo: osConferencias.filter((os) => os.statusConferencia === "fluxo_completo").length,
      divergencia: osConferencias.filter((os) => os.statusConferencia === "divergencia").length,
      lancado: osConferencias.filter((os) => os.statusConferencia === "lancado").length,
    };
  }, [osConferencias]);

  const handleOpenOSDetails = (os: OSConferencia) => {
    setSelectedOS(os);
    setModalOpen(true);
  };

  const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handlePrintROL = async () => {
    if (!clienteSelecionado || items.length === 0) return;

    const printData: LancamentosPrintData = {
      clienteNome: clienteSelecionado.nome,
      clienteTelefone: clienteSelecionado.telefone,
      itens: items.map(item => ({
        nome: item.produto,
        quantidade: item.quantidade,
        precoUnitario: item.valorUnitario,
        subtotal: item.valorTotal,
      })),
      valorTotal: totalValue,
      dataEmissao: new Date(dataEmissao),
      previsaoEntrega: dataEntrega ? new Date(dataEntrega) : undefined,
      observacoes: observacao || undefined,
    };

    await printROLFromData(printData);
  };

  const handlePrintEtiqueta = async () => {
    if (!clienteSelecionado || items.length === 0) return;

    const printData: LancamentosPrintData = {
      clienteNome: clienteSelecionado.nome,
      clienteTelefone: clienteSelecionado.telefone,
      itens: items.map(item => ({
        nome: item.produto,
        quantidade: item.quantidade,
        precoUnitario: item.valorUnitario,
        subtotal: item.valorTotal,
      })),
      valorTotal: totalValue,
      dataEmissao: new Date(dataEmissao),
      previsaoEntrega: dataEntrega ? new Date(dataEntrega) : undefined,
      observacoes: observacao || undefined,
    };

    await printEtiquetaFromData(printData, 1);
  };

  const handleFinalizarLancamento = async () => {
    if (!clienteSelecionado || items.length === 0 || !selectedClienteId) return;
    
    setIsFinalizando(true);
    try {
      const lancamento = await createLancamento.mutateAsync({
        cliente_id: selectedClienteId,
        data_lancamento: dataEmissao,
        data_entrega: dataEntrega || null,
        observacao: observacao || null,
        valor_total: totalValue,
        status: "pendente",
      });

      for (const item of items) {
        await createItemLancamento.mutateAsync({
          lancamento_id: lancamento.id,
          produto_nome: item.produto,
          quantidade: item.quantidade,
          unidade: item.unidade,
          preco_unitario: item.valorUnitario,
          subtotal: item.valorTotal,
        });
      }

      setItems([]);
      setSelectedClienteId(null);
      setObservacao("");
      
      toast.success("Lançamento registrado com sucesso!", {
        description: "Veja na aba 'Pendentes' para processar a cobrança.",
        action: {
          label: "Ver Pendentes",
          onClick: () => setActiveTab("pendentes"),
        },
      });
    } catch (error) {
      console.error("Erro ao finalizar lançamento:", error);
      toast.error("Erro ao finalizar lançamento");
    } finally {
      setIsFinalizando(false);
    }
  };

  const handleUsarParaLancamento = (clienteId: string, itens: ItemOS[]) => {
    setSelectedClienteId(clienteId);
    
    const novosItens: LancamentoItem[] = itens.map((item) => ({
      id: crypto.randomUUID(),
      produto: item.produto?.nome || "Produto",
      quantidade: item.quantidade,
      unidade: item.produto?.unidade || "un",
      valorUnitario: item.preco_unitario,
      valorTotal: item.subtotal,
    }));
    
    setItems(novosItens);
    setActiveTab("novo");
    
    toast.success("Itens adicionados ao lançamento", {
      description: `${itens.length} itens do cliente foram carregados`,
    });
  };

  // === Faturamento Logic ===
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Filter lancamentos by cliente when URL param is present AND only show industrial clients
  const lancamentosFiltrados = useMemo(() => {
    const industrialOnly = lancamentosPendentes.filter(l => l.cliente?.classificacao === "industrial");
    if (!clienteFiltroId) return industrialOnly;
    return industrialOnly.filter((l) => l.cliente_id === clienteFiltroId);
  }, [lancamentosPendentes, clienteFiltroId]);

  const clienteFiltroInfo = useMemo(() => {
    if (!clienteFiltroId || lancamentosFiltrados.length === 0) return null;
    return lancamentosFiltrados[0]?.cliente;
  }, [clienteFiltroId, lancamentosFiltrados]);

  useEffect(() => {
    if (clienteFiltroId && lancamentosFiltrados.length > 0 && !isLoadingLancamentos) {
      const ids = lancamentosFiltrados.map((l) => l.id);
      setSelectedLancamentos(ids);
    }
  }, [clienteFiltroId, lancamentosFiltrados, isLoadingLancamentos]);

  const handleClearFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("cliente");
    setSearchParams(newParams);
    setSelectedLancamentos([]);
  };

  const lancamentosPorCliente = useMemo(() => {
    const groups: Record<string, LancamentoType[]> = {};
    lancamentosFiltrados.forEach((l) => {
      const clienteId = l.cliente_id;
      if (!groups[clienteId]) {
        groups[clienteId] = [];
      }
      groups[clienteId].push(l);
    });
    return groups;
  }, [lancamentosFiltrados]);

  const handleToggleLancamento = (id: string) => {
    setSelectedLancamentos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleAllFromCliente = (clienteId: string, lancamentosIds: string[]) => {
    const allSelected = lancamentosIds.every((id) => selectedLancamentos.includes(id));
    if (allSelected) {
      setSelectedLancamentos((prev) => prev.filter((id) => !lancamentosIds.includes(id)));
    } else {
      setSelectedLancamentos((prev) => [...new Set([...prev, ...lancamentosIds])]);
    }
  };

  const totalSelecionado = useMemo(() => {
    return lancamentosFiltrados
      .filter((l) => selectedLancamentos.includes(l.id))
      .reduce((sum, l) => sum + Number(l.valor_total), 0);
  }, [lancamentosFiltrados, selectedLancamentos]);

  const clienteSelecionadoFaturamento = useMemo(() => {
    if (selectedLancamentos.length === 0) return null;
    const firstLancamento = lancamentosFiltrados.find((l) => selectedLancamentos.includes(l.id));
    if (!firstLancamento) return null;

    const allSameCliente = lancamentosFiltrados
      .filter((l) => selectedLancamentos.includes(l.id))
      .every((l) => l.cliente_id === firstLancamento.cliente_id);

    if (!allSameCliente) return null;
    return firstLancamento.cliente;
  }, [lancamentosFiltrados, selectedLancamentos]);

  const handleGerarFatura = () => {
    if (!clienteSelecionadoFaturamento || selectedLancamentos.length === 0) return;
    if (isLoadingItens) {
      toast.info("Carregando dados dos lançamentos...");
      return;
    }
    if (!dadosFaturamento || dadosFaturamento.itens.length === 0) {
      toast.error("Aguarde, carregando itens dos lançamentos...");
      return;
    }
    setWizardDados({ ...dadosFaturamento });
    setFaturamentoModalOpen(true);
  };

  const dadosFaturamento: DadosFaturamento | null = useMemo(() => {
    if (!clienteSelecionadoFaturamento || !lancamentosComItens || lancamentosComItens.length === 0) return null;

    const allItens = lancamentosComItens.flatMap((l) =>
      (l.itens || []).map((item) => ({
        id: item.id,
        produto: item.produto_nome,
        quantidade: Number(item.quantidade),
        unidade: item.unidade,
        valorUnitario: Number(item.preco_unitario),
        valorTotal: Number(item.subtotal),
      }))
    );

    const datas = lancamentosComItens.map((l) => new Date(l.data_lancamento));
    const pInicio = datas.length > 0 ? format(Math.min(...datas.map((d) => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
    const pFim = datas.length > 0 ? format(Math.max(...datas.map((d) => d.getTime())), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");

    return {
      clienteId: clienteSelecionadoFaturamento.id,
      clienteNome: clienteSelecionadoFaturamento.razao_social,
      clienteDocumento: clienteSelecionadoFaturamento.cpf_cnpj || "",
      clienteEmail: clienteSelecionadoFaturamento.email || null,
      clienteTelefone: clienteSelecionadoFaturamento.telefone || null,
      itens: allItens,
      valorTotal: totalSelecionado,
      periodoInicio: pInicio,
      periodoFim: pFim,
      lancamentoIds: selectedLancamentos,
    };
  }, [clienteSelecionadoFaturamento, lancamentosComItens, totalSelecionado, selectedLancamentos]);

  const handleFaturamentoConcluido = () => {
    setSelectedLancamentos([]);
    setWizardDados(null);
    setFaturaParaContinuar(null);
    setFaturamentoModalOpen(false);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setWizardDados(null);
      setFaturaParaContinuar(null);
    }
    setFaturamentoModalOpen(open);
  };

  const handleContinuarFatura = (fatura: Fatura) => {
    const dados = reconstruirDadosFaturamento(fatura);
    setWizardDados(dados);
    setFaturaParaContinuar(fatura);
    setFaturamentoModalOpen(true);
  };

  const handleVerDetalhes = (fatura: Fatura) => {
    setFaturaDetalhes(fatura);
    setDetalhesModalOpen(true);
  };

  const handleMarcarPago = (fatura: Fatura) => {
    updateFatura.mutate({ id: fatura.id, status: "pago" });
  };

  const handleCancelarFatura = (fatura: Fatura) => {
    updateFatura.mutate({ id: fatura.id, status: "cancelado" });
  };

  // Handlers para gestão de lançamentos pendentes
  const handleVisualizarItens = (lancamento: LancamentoType) => {
    setLancamentoSelecionado(lancamento);
    setVisualizarItensOpen(true);
  };

  const handleEditarLancamento = (lancamento: LancamentoType) => {
    setLancamentoSelecionado(lancamento);
    setEditarLancamentoOpen(true);
  };

  const handleConfirmarExclusao = (lancamento: LancamentoType) => {
    setLancamentoParaExcluir(lancamento);
    setDeleteConfirmOpen(true);
  };

  const handleExcluirLancamento = async () => {
    if (!lancamentoParaExcluir) return;
    deleteLancamento.mutate(lancamentoParaExcluir.id);
    setDeleteConfirmOpen(false);
    setLancamentoParaExcluir(null);
  };

  const handleSalvarLancamento = async (
    lancamentoId: string,
    data: { observacao: string | null; data_lancamento: string; valor_total: number },
    itensAtualizados: ItemLancamento[],
    itensRemovidos: string[],
    itensNovos: Omit<ItemLancamento, 'id' | 'created_at'>[]
  ) => {
    setIsSaving(true);
    try {
      updateLancamento.mutate({
        id: lancamentoId,
        observacao: data.observacao,
        data_lancamento: data.data_lancamento,
        valor_total: data.valor_total,
      });

      for (const itemId of itensRemovidos) {
        await supabase.from("itens_lancamento").delete().eq("id", itemId);
      }

      for (const item of itensAtualizados) {
        await supabase
          .from("itens_lancamento")
          .update({
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            subtotal: item.subtotal,
          })
          .eq("id", item.id);
      }

      for (const item of itensNovos) {
        await supabase.from("itens_lancamento").insert({
          lancamento_id: item.lancamento_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          unidade: item.unidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        });
      }

      toast.success("Lançamento atualizado com sucesso");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppLayout title="Lançamentos" subtitle="Registre a produção diária e gerencie o faturamento">
      <div className="content-panel">
        <div className="space-y-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
              <TabsTrigger
                value="novo"
                className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
              >
                <FileText className="w-4 h-4" />
                Novo Lançamento
              </TabsTrigger>
              <TabsTrigger
                value="pendentes"
                className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
              >
                <Package className="w-4 h-4" />
                Pendentes
                {lancamentosPendentes.length > 0 && (
                  <span className="ml-1 bg-warning text-warning-foreground text-xs px-2 py-0.5 rounded-full">
                    {lancamentosPendentes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="faturas"
                className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
              >
                <Receipt className="w-4 h-4" />
                Faturas Geradas
              </TabsTrigger>
              <TabsTrigger
                value="conferencia"
                className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
              >
                <ClipboardList className="w-4 h-4" />
                Conferência
              </TabsTrigger>
            </TabsList>

            {/* Tab: Novo Lançamento */}
            <TabsContent value="novo" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel - Form */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <FileText className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">Novo Lançamento</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Data de Emissão */}
                    <div>
                      <Label className="text-sm font-medium text-foreground">Data de Emissão</Label>
                      <Input
                        type="date"
                        value={dataEmissao}
                        onChange={(e) => setDataEmissao(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>

                    {/* Data de Entrega */}
                    <div>
                      <Label className="text-sm font-medium text-foreground">Data de Entrega</Label>
                      <Input
                        type="date"
                        value={dataEntrega}
                        onChange={(e) => setDataEntrega(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>

                    {/* Observação */}
                    <div>
                      <Label className="text-sm font-medium text-foreground">Observação / Informação</Label>
                      <Input
                        placeholder="Ex: Entregar até sexta, Roupa de cama extra..."
                        className="mt-1.5"
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                      />
                    </div>

                    {/* Cliente */}
                    <div>
                      <Label className="text-sm font-medium text-foreground">Cliente</Label>
                      <Popover open={clienteSearchOpen} onOpenChange={setClienteSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clienteSearchOpen}
                            className="w-full justify-between mt-1.5 h-auto min-h-[42px] py-2"
                          >
                            {clienteSelecionado ? (
                              <div className="text-left">
                                <p className="font-medium text-foreground">{clienteSelecionado.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {clienteSelecionado.documento && `${clienteSelecionado.documento} • `}
                                  {clienteSelecionado.telefone}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Buscar por nome, CNPJ, telefone...</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder="Buscar cliente..."
                              value={clienteSearch}
                              onValueChange={setClienteSearch}
                            />
                            <CommandList>
                              {isLoadingClientes ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              ) : (
                                <>
                                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {clientesFiltrados.map((cliente) => (
                                      <CommandItem
                                        key={cliente.id}
                                        value={cliente.id}
                                        onSelect={() => {
                                          setSelectedClienteId(cliente.id);
                                          setClienteSearchOpen(false);
                                          setClienteSearch("");
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{cliente.razao_social}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {cliente.cpf_cnpj && `${cliente.cpf_cnpj} • `}
                                            {cliente.telefone || "Sem telefone"}
                                          </span>
                                        </div>
                                        {selectedClienteId === cliente.id && (
                                          <Check className="ml-auto h-4 w-4" />
                                        )}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Produto/Serviço */}
                    <div>
                      <Label className="text-sm font-medium text-foreground">Produto/Serviço</Label>
                      {!selectedClienteId ? (
                        <div className="flex items-center gap-2 mt-1.5 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          Selecione um cliente primeiro
                        </div>
                      ) : isLoadingPrecos ? (
                        <div className="flex items-center gap-2 mt-1.5 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Carregando produtos...
                        </div>
                      ) : produtosDoCliente.length === 0 ? (
                        <div className="flex items-center gap-2 mt-1.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          Cliente sem produtos cadastrados na tabela de preços
                        </div>
                      ) : (
                        <Popover open={produtoSearchOpen} onOpenChange={setProdutoSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={produtoSearchOpen}
                              className="w-full justify-between mt-1.5 h-auto min-h-[42px] py-2"
                            >
                              {produtoSelecionado ? (
                                <div className="text-left">
                                  <p className="font-medium text-foreground">{produtoSelecionado.nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(produtoSelecionado.precoEspecial)} / {produtoSelecionado.unidade}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Selecione o produto</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar produto..." />
                              <CommandList>
                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {produtosDoCliente.map((produto) => (
                                    <CommandItem
                                      key={produto.id}
                                      value={produto.id}
                                      onSelect={() => {
                                        setSelectedProdutoId(produto.id);
                                        setProdutoSearchOpen(false);
                                      }}
                                    >
                                      <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                                      <div className="flex flex-col flex-1">
                                        <span className="font-medium">{produto.nome}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {formatCurrency(produto.precoEspecial)} / {produto.unidade}
                                          {produto.tipo === "desconto" && (
                                            <Badge variant="secondary" className="ml-2 text-xs">Desconto</Badge>
                                          )}
                                          {produto.tipo === "acrescido" && (
                                            <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 text-amber-700">Acréscimo</Badge>
                                          )}
                                        </span>
                                      </div>
                                      {selectedProdutoId === produto.id && (
                                        <Check className="ml-auto h-4 w-4" />
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {/* Quantidade / Metragem */}
                    {produtoSelecionado && isUnidadeMetro(produtoSelecionado.unidade) ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                            <Scale className="w-4 h-4 text-primary" />
                            Metragem ({produtoSelecionado.unidade})
                          </Label>
                          <div className="flex rounded-md border bg-muted/30">
                            <button
                              type="button"
                              onClick={() => setModoMetragem("direto")}
                              className={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${
                                modoMetragem === "direto" 
                                  ? "bg-primary text-primary-foreground" 
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Direto
                            </button>
                            <button
                              type="button"
                              onClick={() => setModoMetragem("dimensoes")}
                              className={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${
                                modoMetragem === "dimensoes" 
                                  ? "bg-primary text-primary-foreground" 
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Dimensões
                            </button>
                          </div>
                        </div>

                        {modoMetragem === "direto" ? (
                          <div>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 12.50"
                              value={metragemDireta}
                              onChange={(e) => setMetragemDireta(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Informe a metragem total em {produtoSelecionado.unidade}
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Comprimento (m)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Ex: 2.50"
                                value={comprimento}
                                onChange={(e) => setComprimento(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Largura (m)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Ex: 1.80"
                                value={largura}
                                onChange={(e) => setLargura(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}

                        {metragemCalculada > 0 && (
                          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">
                                {modoMetragem === "dimensoes" 
                                  ? `${comprimento}m × ${largura}m = ` 
                                  : "Total: "}
                                <span className="font-medium text-foreground">
                                  {metragemCalculada.toFixed(2)} {produtoSelecionado.unidade}
                                </span>
                              </span>
                              <span className="font-semibold text-primary">
                                {formatCurrency(produtoSelecionado.precoEspecial * metragemCalculada)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Label className="text-sm font-medium text-foreground">
                          Quantidade ({produtoSelecionado?.unidade || "un"})
                        </Label>
                        <Input
                          type="number"
                          placeholder="0"
                          className="mt-1.5"
                          min={1}
                          value={quantidade}
                          onChange={(e) => setQuantidade(Number(e.target.value))}
                          disabled={!produtoSelecionado}
                        />
                        {produtoSelecionado && quantidade > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Subtotal: <span className="font-medium text-foreground">
                              {formatCurrency(produtoSelecionado.precoEspecial * quantidade)}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Adicionar Item Button */}
                    <Button
                      className="w-full gap-2 mt-2"
                      onClick={handleAdicionarItem}
                      disabled={!produtoSelecionado || (isUnidadeMetro(produtoSelecionado?.unidade) ? metragemCalculada <= 0 : quantidade <= 0)}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Item
                    </Button>
                  </div>
                </Card>

                {/* Right Panel - Items */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold text-lg">Itens do Lançamento</h2>
                    </div>
                    {items.length > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {items.length} item
                      </Badge>
                    )}
                  </div>

                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                      <p className="text-sm">Selecione um cliente para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clienteSelecionado && (
                        <div className="flex items-center justify-between py-2 border-b">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{clienteSelecionado.nome}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{formatDate(dataEmissao)}</span>
                        </div>
                      )}

                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between py-3 border-b">
                            <div>
                              <p className="font-semibold text-foreground">{item.produto}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantidade} {item.unidade} × {formatCurrency(item.valorUnitario)} ={" "}
                                <span className="font-medium text-foreground">{formatCurrency(item.valorTotal)}</span>
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t">
                        <span className="font-medium">Total:</span>
                        <span className="text-xl font-bold text-primary">{formatCurrency(totalValue)}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-4">
                        <Button variant="outline" className="gap-2" onClick={handlePrintROL} disabled={isPrinting}>
                          {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                          Imprimir ROL
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={handlePrintEtiqueta} disabled={isPrinting}>
                          {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                          Imprimir Etiqueta
                        </Button>
                      </div>

                      <Button
                        className="w-full gap-2 bg-success hover:bg-success/90"
                        onClick={handleFinalizarLancamento}
                        disabled={isFinalizando}
                      >
                        {isFinalizando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Finalizar Lançamento
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* Tab: Lançamentos Pendentes */}
            <TabsContent value="pendentes" className="mt-4">
              <div className="space-y-4">
                {/* Client Filter Banner */}
                {clienteFiltroId && (
                  <Card className="p-4 bg-primary/10 border-primary/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Filtrando por cliente</p>
                          <p className="font-semibold">{clienteFiltroInfo?.razao_social || "Cliente"}</p>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {lancamentosFiltrados.length} lançamento(s) pendente(s)
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" onClick={handleClearFilter} className="gap-2">
                        <X className="w-4 h-4" />
                        Limpar filtro
                      </Button>
                    </div>
                  </Card>
                )}

                {/* Selection Footer */}
                {selectedLancamentos.length > 0 && (
                  <Card className="p-4 border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm text-muted-foreground">Selecionados</p>
                          <p className="font-bold text-lg">{selectedLancamentos.length} lançamento(s)</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Valor Total</p>
                          <p className="font-bold text-primary">{formatCurrency(totalSelecionado)}</p>
                        </div>
                        {clienteSelecionadoFaturamento && (
                          <div>
                            <p className="text-sm text-muted-foreground">Cliente</p>
                            <p className="font-medium">{clienteSelecionadoFaturamento.razao_social}</p>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleGerarFatura}
                        disabled={!clienteSelecionadoFaturamento}
                        className="gap-2 bg-success hover:bg-success/90"
                      >
                        <Play className="w-4 h-4" />
                        Gerar Fatura
                      </Button>
                    </div>
                    {!clienteSelecionadoFaturamento && selectedLancamentos.length > 0 && (
                      <p className="text-sm text-destructive mt-2">
                        Selecione lançamentos de um único cliente para gerar a fatura
                      </p>
                    )}
                  </Card>
                )}

                {/* Lancamentos List */}
                <div className="bg-card border rounded-lg overflow-hidden">
                  {isLoadingLancamentos ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : lancamentosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mb-4 opacity-50" />
                      <p>Nenhum lançamento pendente</p>
                      <p className="text-sm">
                        {clienteFiltroId 
                          ? "Este cliente não possui lançamentos pendentes" 
                          : "Os lançamentos finalizados aparecem aqui"}
                      </p>
                      {clienteFiltroId && (
                        <Button variant="link" onClick={handleClearFilter} className="mt-2">
                          Ver todos os clientes
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12"></TableHead>
                          <TableHead className="font-semibold">CLIENTE</TableHead>
                          <TableHead className="font-semibold">DATA</TableHead>
                          <TableHead className="font-semibold">VALOR</TableHead>
                          <TableHead className="font-semibold">OBS</TableHead>
                          <TableHead className="font-semibold w-24">AÇÕES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(lancamentosPorCliente).map(([clienteId, clienteLancamentos]) => {
                          const cliente = clienteLancamentos[0]?.cliente;
                          const clienteIds = clienteLancamentos.map((l) => l.id);
                          const allSelected = clienteIds.every((id) => selectedLancamentos.includes(id));
                          const someSelected = clienteIds.some((id) => selectedLancamentos.includes(id));

                          return (
                            <React.Fragment key={clienteId}>
                              <TableRow className="bg-muted/30 hover:bg-muted/40">
                                <TableCell className="py-2">
                                  <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={() => handleToggleAllFromCliente(clienteId, clienteIds)}
                                    className={someSelected && !allSelected ? "opacity-50" : ""}
                                  />
                                </TableCell>
                                <TableCell colSpan={5} className="py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{cliente?.razao_social || "Cliente"}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({clienteLancamentos.length} lançamento{clienteLancamentos.length > 1 ? "s" : ""})
                                    </span>
                                    <span className="text-sm font-medium text-primary ml-auto">
                                      {formatCurrency(clienteLancamentos.reduce((sum, l) => sum + Number(l.valor_total), 0))}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                              {clienteLancamentos.map((lancamento) => (
                                <TableRow
                                  key={lancamento.id}
                                  className={`hover:bg-muted/20 ${selectedLancamentos.includes(lancamento.id) ? "bg-primary/5" : ""}`}
                                >
                                  <TableCell className="pl-8">
                                    <Checkbox
                                      checked={selectedLancamentos.includes(lancamento.id)}
                                      onCheckedChange={() => handleToggleLancamento(lancamento.id)}
                                    />
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-sm">
                                    {cliente?.nome_fantasia || "-"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {format(new Date(lancamento.data_lancamento), "dd/MM/yyyy")}
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {formatCurrency(Number(lancamento.valor_total))}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                    {lancamento.observacao || "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleVisualizarItens(lancamento)}
                                        title="Ver itens"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleEditarLancamento(lancamento)}
                                        title="Editar"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => handleConfirmarExclusao(lancamento)}
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Faturas Geradas */}
            <TabsContent value="faturas" className="mt-4">
              <div className="space-y-4">
                {/* Period Navigation */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Período:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Previsto</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(summary.totalPrevisto)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{summary.totalClientes} cliente(s)</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                  </div>

                  <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendente</p>
                      <p className="text-2xl font-bold text-warning mt-1">{formatCurrency(summary.pendente)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Aguardando pagamento</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-warning" />
                    </div>
                  </div>

                  <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recebido</p>
                      <p className="text-2xl font-bold text-success mt-1">{formatCurrency(summary.pago)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Faturas pagas</p>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-success" />
                    </div>
                  </div>
                </div>

                {/* Faturas Table */}
                <div className="bg-card border rounded-lg overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Faturas - {format(currentDate, "MMMM yyyy", { locale: ptBR })}</h3>
                  </div>

                  {isLoadingFaturas ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : faturas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Receipt className="w-12 h-12 mb-4 opacity-50" />
                      <p>Nenhuma fatura neste período</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">CLIENTE</TableHead>
                          <TableHead className="font-semibold">VALOR</TableHead>
                          <TableHead className="font-semibold">PROGRESSO</TableHead>
                          <TableHead className="font-semibold">STATUS</TableHead>
                          <TableHead className="font-semibold">Nº NF</TableHead>
                          <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faturas.map((fatura) => {
                          const statusConfig = getStatusConfig(fatura.status);
                          const isPaidOrCancelled = fatura.status === "pago" || (fatura.status as string) === "cancelado";
                          const canContinue = !isPaidOrCancelled && !fatura.data_envio;
                          
                          return (
                            <TableRow key={fatura.id} className="hover:bg-muted/30">
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{fatura.cliente?.razao_social || "Cliente"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(fatura.periodo_inicio), "dd/MM")} - {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">{formatCurrency(Number(fatura.valor_total))}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <div 
                                    className={cn("w-2.5 h-2.5 rounded-full", fatura.relatorio_gerado ? "bg-success" : "bg-muted-foreground/30")} 
                                    title="Relatório"
                                  />
                                  <div 
                                    className={cn("w-2.5 h-2.5 rounded-full", fatura.numero_nf ? "bg-success" : "bg-muted-foreground/30")} 
                                    title="Nota Fiscal"
                                  />
                                  <div 
                                    className={cn("w-2.5 h-2.5 rounded-full", fatura.forma_pagamento ? "bg-success" : "bg-muted-foreground/30")} 
                                    title="Pagamento"
                                  />
                                  <div 
                                    className={cn("w-2.5 h-2.5 rounded-full", fatura.data_envio ? "bg-success" : "bg-muted-foreground/30")} 
                                    title="Envio"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge variant={statusConfig.variant}>{statusConfig.label}</StatusBadge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground font-mono">{fatura.numero_nf || "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {canContinue && (
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleContinuarFatura(fatura)}
                                      className="gap-1"
                                    >
                                      <Play className="w-3 h-3" />
                                      Continuar
                                    </Button>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleVerDetalhes(fatura)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        Ver Detalhes
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      {fatura.status !== "pago" && (fatura.status as string) !== "cancelado" && (
                                        <>
                                          <DropdownMenuItem onClick={() => handleMarcarPago(fatura)}>
                                            <Check className="w-4 h-4 mr-2" />
                                            Marcar como Pago
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={() => handleCancelarFatura(fatura)}
                                            className="text-destructive focus:text-destructive"
                                          >
                                            <Ban className="w-4 h-4 mr-2" />
                                            Cancelar Fatura
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Conferência & Divergências */}
            <TabsContent value="conferencia" className="mt-4">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Status</SelectItem>
                        <SelectItem value="pendente">Em Produção</SelectItem>
                        <SelectItem value="fluxo_completo">Fluxo Completo</SelectItem>
                        <SelectItem value="lancado">Lançados</SelectItem>
                        <SelectItem value="divergencia">Divergências</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="relative w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por cliente ou OS..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{conferenciasCounts.pendente}</p>
                        <p className="text-xs text-muted-foreground">Em Produção</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{conferenciasCounts.fluxo_completo}</p>
                        <p className="text-xs text-muted-foreground">Fluxo Completo</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{conferenciasCounts.lancado}</p>
                        <p className="text-xs text-muted-foreground">Lançados</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{conferenciasCounts.divergencia}</p>
                        <p className="text-xs text-muted-foreground">Divergências</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Table */}
                <Card className="overflow-hidden">
                  <div className="p-4 border-b flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">OS para Conferência</h3>
                    <Badge variant="secondary" className="ml-auto">{filteredConferencias.length} registros</Badge>
                  </div>

                  {isLoadingConferencias ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">OS</TableHead>
                          <TableHead className="font-semibold">CLIENTE</TableHead>
                          <TableHead className="font-semibold">RETIRADA</TableHead>
                          <TableHead className="font-semibold text-center">PEÇAS</TableHead>
                          <TableHead className="font-semibold text-center">PESO</TableHead>
                          <TableHead className="font-semibold text-center">VOLUMES</TableHead>
                          <TableHead className="font-semibold">STATUS</TableHead>
                          <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredConferencias.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                              Nenhuma OS encontrada para conferência
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredConferencias.map((os) => (
                            <TableRow key={os.id} className="hover:bg-muted/30">
                              <TableCell>
                                <Badge variant="outline" className="font-mono">{os.numero}</Badge>
                              </TableCell>
                              <TableCell>
                                <p className="font-medium text-foreground">{os.cliente.razao_social}</p>
                                {os.dadosProducao.itensDanificados && (
                                  <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Itens danificados
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(os.dataRetirada), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">
                                    {os.itensOS?.reduce((sum, i) => sum + i.quantidade, 0) || os.dadosProducao.quantidadePecas || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Scale className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">
                                    {(() => {
                                      const pesoItens = os.itensOS?.reduce((sum, i) => {
                                        const peso = (i.produto as any)?.peso_medio_kg || 0;
                                        return sum + (i.quantidade * peso);
                                      }, 0) || 0;
                                      const pesoFinal = pesoItens || os.dadosProducao.pesoFinal || os.dadosProducao.pesoTotal;
                                      return pesoFinal ? `${Math.round(pesoFinal * 10) / 10} kg` : "-";
                                    })()}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Boxes className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-medium">{os.dadosProducao.quantidadeVolumes || "-"}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  variant={
                                    os.statusConferencia === "lancado"
                                      ? "info"
                                      : os.statusConferencia === "fluxo_completo"
                                      ? "success"
                                      : os.statusConferencia === "divergencia"
                                      ? "danger"
                                      : "warning"
                                  }
                                >
                                  {os.statusConferencia === "lancado"
                                    ? "Lançado"
                                    : os.statusConferencia === "fluxo_completo"
                                    ? "Fluxo Completo"
                                    : os.statusConferencia === "divergencia"
                                    ? "Divergência"
                                    : "Em Produção"}
                                </StatusBadge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleOpenOSDetails(os)}
                                    title="Ver Detalhes"
                                  >
                                    <Eye className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                  {os.statusConferencia === "fluxo_completo" && os.itensOS && os.itensOS.length > 0 && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleUsarParaLancamento(os.cliente.id, os.itensOS)}
                                    >
                                      Lançar
                                    </Button>
                                  )}
                                  {os.statusConferencia === "lancado" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-violet-600 hover:text-violet-600"
                                      onClick={() => handleOpenOSDetails(os)}
                                      title="Imprimir"
                                    >
                                      <Printer className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Modals */}
          <ConferenciaModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            os={selectedOS}
            onUsarParaLancamento={handleUsarParaLancamento}
          />

          <FaturamentoModal
            open={faturamentoModalOpen}
            onOpenChange={handleModalClose}
            dados={wizardDados}
            onComplete={handleFaturamentoConcluido}
            faturaExistente={faturaParaContinuar}
          />

          <DetalhesFaturaModal
            open={detalhesModalOpen}
            onOpenChange={setDetalhesModalOpen}
            fatura={faturaDetalhes}
          />

          <VisualizarItensModal
            open={visualizarItensOpen}
            onOpenChange={setVisualizarItensOpen}
            lancamento={lancamentoSelecionado}
            itens={itensLancamentoSelecionado}
            isLoading={isLoadingItensLancamento}
          />

          <EditarLancamentoModal
            open={editarLancamentoOpen}
            onOpenChange={setEditarLancamentoOpen}
            lancamento={lancamentoSelecionado}
            itens={itensLancamentoSelecionado}
            onSave={handleSalvarLancamento}
            isSaving={isSaving}
          />

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Lançamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleExcluirLancamento}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
