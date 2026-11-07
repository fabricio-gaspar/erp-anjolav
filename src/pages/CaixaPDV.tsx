import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PdvLayout } from "@/components/layout/PdvLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  Search,
  FileSearch,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Loader2,
  FileText,
  Info,
  AlertTriangle,
  Maximize,
  Minimize,
  Keyboard,
  UserRound,
  UserPlus,
  CalendarDays,
  ChevronDown,
  MapPin,
  X,
  Phone,
  Mail,
  IdCard,
  Pencil,
  Printer,
  Package,
  ClipboardList,
  Boxes,
  Truck,
  CalendarRange,
  MoreHorizontal,
  Banknote,
  QrCode,
  CircleCheck,
  ArrowLeft,
  Save,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes, useConfiguracaoPagamentoCliente, useEnderecoCliente } from "@/hooks/useClientes";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { ItemDetalhesModal } from "@/components/caixa/ItemDetalhesModal";
import { PagamentoModal, type DadosPagamento, type PdvPaymentMethod } from "@/components/caixa/PagamentoModal";
import { ImpressaoPosVendaModal } from "@/components/caixa/ImpressaoPosVendaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { SangriaModal } from "@/components/caixa/SangriaModal";
import { SuprimentoModal } from "@/components/caixa/SuprimentoModal";
import { ConsultarOSModal } from "@/components/caixa/ConsultarOSModal";
import { ReceberPagamentoModal, type PixRecebimentoRequest } from "@/components/caixa/ReceberPagamentoModal";
import { PixPagamentoModal } from "@/components/caixa/PixPagamentoModal";
import { ListaDoDiaModal } from "@/components/caixa/ListaDoDiaModal";
import { PdvFulfillmentPanel, type PdvFulfillmentSettings } from "@/components/caixa/PdvFulfillmentPanel";
import { CadastroRapidoClienteModal } from "@/components/caixa/CadastroRapidoClienteModal";
import { useSavePdvQuote } from "@/hooks/usePdvQuotes";

import { AjudaAtalhosModal } from "@/components/caixa/AjudaAtalhosModal";
import { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintOS } from "@/hooks/usePrintOS";
import { useCreatePdvSale, usePdvCapacity, usePdvCustomerLoyaltySummary, useRedeemPdvLoyalty } from "@/hooks/usePdvPayments";
import { createPdvIdempotencyKey, type PdvPixPayment } from "@/lib/pdvPayment";
import { getCanonicalPdvPath } from "@/lib/authorization";


import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOperationalContext } from "@/contexts/OperationalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAccess, usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { buildClientPriceCatalog, CLIENT_PRICE_MODE_LABELS, normalizeClientPriceMode } from "@/lib/clientPricing";
import { getDefaultPdvDeliveryDate } from "@/lib/pdvFulfillment";
import { parseCustomerPaymentTerms, isCustomerPaymentAllowed } from "@/lib/customerPaymentTerms";
import { dispararNotificacaoAutomatica } from "@/services/notificacaoService";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuShortcut,
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
import "@/styles/pdv-cashier.css";

interface CartItem {
  id: string;
  nome: string;
  codigo?: string | null;
  descricao?: string | null;
  preco: number;
  unidade: string;
  quantidade: number;
  precoOriginal: number;
  // Novos campos de detalhes
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
  operacao?: string;
  tipo_preco?: string;
  servicos_adicionais?: string[];
  complemento?: string;
}

export type PdvServiceMode = "rol" | "delivery" | "orcamento";

interface OSRecemCriada {
  id: string;
  numero: string;
  valorTotal: number;
  previsaoEntrega: Date;
}

interface PixFlowContext {
  orderId: string;
  orderNumber: string;
  amount: number;
  cashRegisterId: string;
  moment: "ENTRADA" | "RETIRADA";
  idempotencyKey: string;
  initialPix?: PdvPixPayment | null;
  initialError?: string | null;
  source: "sale" | "receivable";
}

interface DiscardRequest {
  title: string;
  description: string;
  confirmLabel: string;
  action: () => void;
}

interface PdvPaymentSelection {
  pagoAgora: boolean;
  formaPagamento: PdvPaymentMethod | null;
}

const getUnidadeLabel = (unidade: string | null) => {
  switch (unidade) {
    case "kg": return "Kg";
    case "peca": return "Pç";
    case "metro": return "Mt";
    case "unidade": return "Un";
    default: return "Pç";
  }
};

const getPdvUnitDisplay = (unidade: string) => {
  switch (unidade) {
    case "Pç": return "Peça";
    case "Kg": return "Kg";
    case "Mt": return "Mt";
    case "Un": return "Un";
    default: return unidade;
  }
};

const formatCarga = (value: number) => new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
}).format(value);

const isValidQuantity = (value: number, unidade: string) =>
  Number.isFinite(value) && value > 0 && value <= 999 &&
  (["Kg", "Mt"].includes(unidade) || Number.isInteger(value));

const createInitialFulfillment = (mode: PdvServiceMode = "rol"): PdvFulfillmentSettings => ({
  deliveryDate: getDefaultPdvDeliveryDate(),
  urgent: false,
  receiptMode: mode === "delivery" ? "coleta" : "balcao",
  deliveryMode: mode === "delivery" ? "entrega" : "balcao",
  driverId: "",
  vehicleId: "",
  capacityOverride: false,
});

// Remount the sale and its dialogs whenever the security context changes.
const CaixaPDV = ({ mode = "rol" }: { mode?: PdvServiceMode }) => {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const { pathname } = useLocation();
  const isExpectedWorkspace = pathname.startsWith("/" + activeArea + "/")
    || (activeArea !== "central" && pathname.startsWith(getCanonicalPdvPath(activeArea)));
  if (!activeTenant || !user || !isExpectedWorkspace) {
    return <AppLayout title="PDV / Caixa"><p>Carregando contexto do atendimento...</p></AppLayout>;
  }
  return <PdvAtendimento key={[activeTenant.id, user.id, activeArea, mode].join(":")} mode={mode} />;
};

const PdvAtendimento = ({ mode }: { mode: PdvServiceMode }) => {

  const { search } = useLocation();
  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const area = activeArea === "industrial" ? "industrial" : "residencial";
  const areaLabel = area === "industrial" ? "Industrial" : "Doméstico";
  const { setOperationSwitchLocked } = useOperationalContext();
  const { canAccessRoute } = useNavigationAccess();
  const { allowed: canOperateCaixa } = usePermissaoModulo("caixa");
  const canUseLoyalty = area === "residencial" && canOperateCaixa;
  const { allowed: canManageCommercialTerms } = usePermissaoModulo("alterar_condicoes_comerciais");
  const canManageContracts = canAccessRoute("/" + area + "/clientes");
  const canCreateClient = canAccessRoute("/" + area + "/clientes");
  const canCreateSale = canAccessRoute("/" + area + "/caixa");
  const canViewDayList = area === "residencial" && canAccessRoute("/residencial/agenda");
  const { produtos, isLoading: isLoadingProdutos, isError: productsError, refetch: refetchProducts } = useProdutos();
  const {
    clientes,
    isLoading: isLoadingClientes,
    isError: clientsError,
    refetch: refetchClients,
  } = useClientes();
  const { data: caixaAberto, isLoading: isLoadingCaixa } = useCaixaAberto(canOperateCaixa);
  const canReceivePayments = canOperateCaixa && !!caixaAberto;
  const createPdvSale = useCreatePdvSale();
  const savePdvQuote = useSavePdvQuote();
  const redeemLoyalty = useRedeemPdvLoyalty();
  const { printROL, printEtiqueta } = usePrintOS();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeBufferRef = useRef("");
  
  const [searchTerm, setSearchTerm] = useState("");
  const [showProductList, setShowProductList] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [showContracts, setShowContracts] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientList, setShowClientList] = useState(false);
  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [fulfillment, setFulfillment] = useState<PdvFulfillmentSettings>(() => createInitialFulfillment(mode));
  const [fulfillmentDraft, setFulfillmentDraft] = useState<PdvFulfillmentSettings | null>(null);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [paymentShortcut, setPaymentShortcut] = useState<PdvPaymentSelection | null>(null);
  
  // Estado para modal de detalhes
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  
  // Estados para modais de pagamento e impressão
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showImpressaoModal, setShowImpressaoModal] = useState(false);
  const [osRecemCriada, setOsRecemCriada] = useState<OSRecemCriada | null>(null);
  const [isProcessingVenda, setIsProcessingVenda] = useState(false);
  const [pixContext, setPixContext] = useState<PixFlowContext | null>(null);
  const saleIdempotencyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const prefilledClientRef = useRef(false);
  
  // Estados para modais de caixa
  const [showAbrirCaixaModal, setShowAbrirCaixaModal] = useState(false);
  const [showFecharCaixaModal, setShowFecharCaixaModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const sangriaShortcutHandledRef = useRef(false);
  const [showSuprimentoModal, setShowSuprimentoModal] = useState(false);
  const [showConsultarOSModal, setShowConsultarOSModal] = useState(false);
  const [pdvLookupMode, setPdvLookupMode] = useState<"consulta" | "posicao">("consulta");
  const [showReceberPagamentoModal, setShowReceberPagamentoModal] = useState(false);
  const [osParaReceber, setOsParaReceber] = useState<OrdemServicoConsulta | null>(null);
  
  // Novos estados para funcionalidades profissionais
  const [showHistoricoVendas, setShowHistoricoVendas] = useState(false);
  const [showListaDia, setShowListaDia] = useState(false);
  const [showAjudaAtalhos, setShowAjudaAtalhos] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [discardRequest, setDiscardRequest] = useState<DiscardRequest | null>(null);
  const [rolNotes, setRolNotes] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("acao") !== "sangria" || sangriaShortcutHandledRef.current || !canReceivePayments) return;

    sangriaShortcutHandledRef.current = true;
    setShowSangriaModal(true);
    params.delete("acao");
    navigate({ search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
  }, [canReceivePayments, navigate, search]);
  

  const { precos: precosEspeciais, isLoading: pricesLoading, isError: pricesError, refetch: refetchPrices } = usePrecosEspeciais(selectedClientId);
  // Session-only shortcut; never restore a customer from global browser storage.
  const [ultimoClienteId, setUltimoClienteId] = useState<string | null>(null);
  const clientesFiltradosPorTipo = useMemo(() => clientes.filter(c => c.ativo && c.classificacao === area), [clientes, area]);
  const selectedClient = useMemo(() => clientesFiltradosPorTipo.find(c => c.id === selectedClientId), [clientesFiltradosPorTipo, selectedClientId]);
  const { endereco: enderecoCliente, isLoading: enderecoLoading, isError: enderecoError } = useEnderecoCliente(selectedClient?.id ?? null);
  const { configuracao: configuracaoPagamento, isLoading: termsLoading, isError: termsError, refetch: refetchTerms } = useConfiguracaoPagamentoCliente(selectedClient?.id ?? null);
  const { data: customerLoyalty, isLoading: isLoadingCustomerLoyalty } = usePdvCustomerLoyaltySummary(selectedClient?.id ?? null, canUseLoyalty);
  const deliveryDateKey = format(fulfillment.deliveryDate, "yyyy-MM-dd");
  const { data: capacity, isLoading: capacityLoading, isError: capacityError } = usePdvCapacity(selectedClient?.id ?? null, deliveryDateKey, Boolean(selectedClient));
  const fulfillmentDraftDateKey = format((fulfillmentDraft ?? fulfillment).deliveryDate, "yyyy-MM-dd");
  const {
    data: fulfillmentDraftCapacity,
    isLoading: fulfillmentDraftCapacityLoading,
    isError: fulfillmentDraftCapacityError,
  } = usePdvCapacity(
    selectedClient?.id ?? null,
    fulfillmentDraftDateKey,
    Boolean(selectedClient && showFulfillmentModal),
  );
  const catalogLoading = isLoadingProdutos || isLoadingClientes || pricesLoading || termsLoading;
  const catalogError = pricesError || termsError || productsError || clientsError;
  const catalogReady = canCreateSale && !!selectedClient && !catalogLoading && !catalogError;
  const isFaturado = configuracaoPagamento?.condicao_pagamento === "faturado";
  const paymentTerms = parseCustomerPaymentTerms(configuracaoPagamento);
  const clientPriceMode = selectedClient
    ? normalizeClientPriceMode(selectedClient.tabela_preco_tipo)
    : "padrao";
  const produtosAtivos = useMemo(() => catalogReady ? buildClientPriceCatalog(
    produtos, precosEspeciais, clientPriceMode, area,
  ) : [], [catalogReady, produtos, precosEspeciais, clientPriceMode, area]);
  const getPrecoForProduto = useCallback((produto: Produto): number =>
    produtosAtivos.find(p => p.id === produto.id)?.precoAplicado ?? NaN, [produtosAtivos]);
  const invalidQuantity = cart.some(item => {
    const raw = quantityDrafts[item.id];
    return raw !== undefined && (!/^\d+(?:[.,]\d+)?$/.test(raw) || !isValidQuantity(Number(raw.replace(",", ".")), item.unidade));
  });
  const cartValid = catalogReady && cart.length > 0 && !invalidQuantity && cart.every(item =>
    isValidQuantity(item.quantidade, item.unidade) && Number.isFinite(item.preco) && item.preco >= 0 &&
    produtosAtivos.some(p => p.id === item.id && p.precoAplicado === item.preco && getUnidadeLabel(p.unidade) === item.unidade));
  const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValue = cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  const capacityLimit = Number(capacity?.limit ?? 0);
  const capacityReserved = Number(capacity?.reserved ?? 0);
  const capacityProgress = capacity?.configured && Number.isFinite(capacityLimit) && capacityLimit > 0
    ? Math.min(100, Math.max(0, ((capacityReserved + totalItems) / capacityLimit) * 100))
    : 0;
  const capacityAvailableAfterThisSale = capacity?.configured
    ? Number(capacity.available ?? 0) - totalItems
    : null;
  const isCapacityExceeded = capacityAvailableAfterThisSale !== null && capacityAvailableAfterThisSale < -0.0001;
  const requiresOperationalAddress = fulfillment.receiptMode === "coleta" || fulfillment.deliveryMode === "entrega";
  const addressReady = Boolean(enderecoCliente?.logradouro?.trim() && enderecoCliente?.cidade?.trim() && enderecoCliente?.uf?.trim());
  const fulfillmentAddressSnapshot = enderecoCliente ? {
    cep: enderecoCliente.cep,
    logradouro: enderecoCliente.logradouro,
    numero: enderecoCliente.numero,
    complemento: enderecoCliente.complemento,
    bairro: enderecoCliente.bairro,
    cidade: enderecoCliente.cidade,
    uf: enderecoCliente.uf,
    pais: enderecoCliente.pais,
  } : undefined;
  const fulfillmentBlockReason = (() => {
    if (!selectedClient) return "Selecione um cliente antes de definir prazo e entrega.";
    if (isFaturado && fulfillment.urgent) return "Pedidos faturados não aceitam urgência neste fluxo.";
    if (capacityLoading) return "Aguarde a consulta de capacidade para a data escolhida.";
    if (capacityError) return "Não foi possível validar a capacidade da data escolhida.";
    if (isCapacityExceeded && (!fulfillment.capacityOverride || !canManageCommercialTerms)) return "A data escolhida está sem capacidade para este pedido.";
    if (requiresOperationalAddress && enderecoLoading) return "Aguarde o carregamento do endereço para coleta ou delivery.";
    if (requiresOperationalAddress && enderecoError) return "Não foi possível validar o endereço para coleta ou delivery.";
    if (requiresOperationalAddress && !addressReady) return "Cadastre um endereço principal completo para coleta ou delivery.";
    return null;
  })();

  const filteredProdutos = useMemo(() => {
    return produtosAtivos.filter((produto) => {
      const matchesSearch = 
        produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [produtosAtivos, searchTerm]);

  const produtoProntoParaAdicionar = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    if (!termo) return null;
    return filteredProdutos.find((produto) =>
      produto.codigo?.toLowerCase() === termo || produto.nome.toLowerCase() === termo
    ) ?? (filteredProdutos.length === 1 ? filteredProdutos[0] : null);
  }, [filteredProdutos, searchTerm]);

  const filteredClientes = useMemo(() => {
    if (!clientSearch) return clientesFiltradosPorTipo.slice(0, 10);
    const term = clientSearch.toLowerCase();
    return clientesFiltradosPorTipo.filter(c => 
      c.razao_social.toLowerCase().includes(term) ||
      c.nome_fantasia?.toLowerCase().includes(term) ||
      c.cpf_cnpj?.includes(term) ||
      c.telefone?.includes(term)
    ).slice(0, 10);
  }, [clientesFiltradosPorTipo, clientSearch]);

  const focusClientSearch = useCallback(() => {
    setShowClientList(true);
    requestAnimationFrame(() => clientSearchRef.current?.focus());
  }, []);

  const focusProductSearch = useCallback(() => {
    if (!selectedClient) {
      focusClientSearch();
      toast.info("Selecione o cliente antes de adicionar itens");
      return;
    }
    setShowProductList(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [focusClientSearch, selectedClient]);

  const addToCart = useCallback((produto: Produto) => {
    if (!catalogReady || !produtosAtivos.some(p => p.id === produto.id)) {
      toast.error("Selecione um cliente e aguarde a tabela e a condição de pagamento");
      return;
    }
    
    const preco = getPrecoForProduto(produto);
    if (!Number.isFinite(preco) || preco < 0) return;
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[produto.id]; return next; });
    setCart((prev) => {
      const existing = prev.find((item) => item.id === produto.id);
      if (existing) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: Math.min(999, item.quantidade + 1) }
            : item
        );
      }
      return [...prev, { 
        id: produto.id,
        nome: produto.nome,
        codigo: produto.codigo,
        descricao: produto.descricao,
        preco,
        precoOriginal: produto.preco,
        unidade: getUnidadeLabel(produto.unidade),
        quantidade: 1 
      }];
    });
    setSearchTerm("");
    setShowProductList(false);
  }, [catalogReady, produtosAtivos, getPrecoForProduto]);

  const handleAddCurrentProduct = () => {
    if (!produtoProntoParaAdicionar) {
      setShowProductList(true);
      searchInputRef.current?.focus();
      toast.info("Selecione um produto ou serviço na lista");
      return;
    }
    addToCart(produtoProntoParaAdicionar);
  };

  const updateQuantity = useCallback((id: string, delta: number) => {
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantidade: isValidQuantity(item.quantidade + delta, item.unidade) ? item.quantidade + delta : item.quantidade }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );
  }, []);

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    setQuantityDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  const clearCart = useCallback(() => {
    setCart([]);
    setQuantityDrafts({});
    setFulfillment(createInitialFulfillment(mode));
    setFulfillmentDraft(null);
    setShowFulfillmentModal(false);
    setPaymentShortcut(null);
    setRolNotes("");
  }, [mode]);

  const openFulfillmentModal = useCallback((preset: Partial<PdvFulfillmentSettings> = {}) => {
    // As escolhas operacionais ficam em rascunho até o atendente confirmá-las.
    setFulfillmentDraft({ ...fulfillment, ...preset });
    setShowFulfillmentModal(true);
  }, [fulfillment]);

  const closeFulfillmentModal = useCallback(() => {
    setShowFulfillmentModal(false);
    setFulfillmentDraft(null);
  }, []);

  const applyFulfillmentChanges = useCallback(() => {
    if (!fulfillmentDraft) return;
    setFulfillment(fulfillmentDraft);
    closeFulfillmentModal();
  }, [closeFulfillmentModal, fulfillmentDraft]);

  const requestDiscard = useCallback((request: Omit<DiscardRequest, "confirmLabel"> & { confirmLabel?: string }) => {
    if (cart.length === 0) {
      request.action();
      return;
    }
    setDiscardRequest({ ...request, confirmLabel: request.confirmLabel ?? "Descartar e continuar" });
  }, [cart.length]);

  const requestClearSale = useCallback(() => {
    if (cart.length === 0) {
      toast.info("Não há itens para limpar");
      return;
    }
    requestDiscard({
      title: "Descartar esta venda?",
      description: "Os itens e detalhes lançados no ROL serão removidos. Esta ação não pode ser desfeita.",
      confirmLabel: "Descartar venda",
      action: clearCart,
    });
  }, [cart.length, clearCart, requestDiscard]);

  const editQuantity = (item: CartItem, raw: string) => {
    setQuantityDrafts(prev => ({ ...prev, [item.id]: raw }));
    const value = Number(raw.replace(",", "."));
    if (/^\d+(?:[.,]\d+)?$/.test(raw) && isValidQuantity(value, item.unidade)) {
      setCart(prev => prev.map(current => current.id === item.id ? { ...current, quantidade: value } : current));
    }
  };

  const openDetalhesModal = (item: CartItem) => {
    setSelectedCartItem(item);
    setDetalhesModalOpen(true);
  };

  const saveDetalhes = (detalhes: {
    cor_item?: string;
    marca_item?: string;
    avarias?: string;
    posicao_prateleira?: string;
    observacoes?: string;
    operacao?: string;
    tipo_preco?: string;
    servicos_adicionais?: string[];
    complemento?: string;
  }) => {
    if (!selectedCartItem) return;
    setCart(prev => prev.map(item => 
      item.id === selectedCartItem.id
        ? { ...item, ...detalhes }
        : item
    ));
    setSelectedCartItem(null);
  };

  const hasItemDetalhes = (item: CartItem) => {
    return !!(item.cor_item || item.marca_item || item.avarias || item.posicao_prateleira || item.observacoes || item.operacao || item.servicos_adicionais?.length || item.complemento);
  };

  const applySelectedClient = useCallback((clientId: string) => {
    if (!clientesFiltradosPorTipo.some(c => c.id === clientId)) return;
    clearCart();
    setSelectedClientId(clientId);
    setShowClientList(false);
    setClientSearch("");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [clientesFiltradosPorTipo, clearCart]);

  const selectClient = useCallback((clientId: string) => {
    if (clientId === selectedClientId) {
      setShowClientList(false);
      return;
    }
    requestDiscard({
      title: "Trocar o cliente desta venda?",
      description: "O ROL atual possui itens. Para evitar preços e condições incorretos, eles serão descartados ao trocar o cliente.",
      action: () => applySelectedClient(clientId),
    });
  }, [applySelectedClient, requestDiscard, selectedClientId]);

  useEffect(() => {
    if (prefilledClientRef.current || clientesFiltradosPorTipo.length === 0) return;
    const requestedClient = new URLSearchParams(search).get("cliente");
    prefilledClientRef.current = true;
    if (requestedClient && clientesFiltradosPorTipo.some((client) => client.id === requestedClient)) {
      selectClient(requestedClient);
    }
  }, [clientesFiltradosPorTipo, search, selectClient]);

  useEffect(() => {
    if (!catalogReady) return;

    // Recalcula somente quando os preços do cliente selecionado estiverem disponíveis.
    setCart(prev => prev.flatMap(item => {
      const produto = produtosAtivos.find(p => p.id === item.id);
      if (!produto || !Number.isFinite(produto.precoAplicado) || produto.precoAplicado < 0) return [];
      const unidade = getUnidadeLabel(produto.unidade);
      if (!isValidQuantity(item.quantidade, unidade)) return [];
      return [{ ...item, preco: produto.precoAplicado, unidade }];
    }));
  }, [catalogReady, produtosAtivos]);

  const clearClient = () => {
    requestDiscard({
      title: "Remover o cliente desta venda?",
      description: "O ROL atual possui itens e será descartado junto com a seleção do cliente.",
      action: () => {
        setSelectedClientId(null);
        setClientSearch("");
        clearCart();
        requestAnimationFrame(() => clientSearchRef.current?.focus());
      },
    });
  };

  // Função para abrir modal de pagamento
  const handleOpenPagamento = useCallback(() => {
    if (osRecemCriada) {
      setShowImpressaoModal(true);
      return;
    }
    if (!catalogReady || !cartValid) {
      toast.error("Confira cliente, tabela, condição e quantidades antes de finalizar");
      return;
    }
    if (cart.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }
    if (!selectedClientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (fulfillmentBlockReason) {
      toast.error(fulfillmentBlockReason);
      return;
    }
    saleIdempotencyRef.current ??= createPdvIdempotencyKey("sale");
    setShowPagamentoModal(true);
  }, [catalogReady, cartValid, cart.length, selectedClientId, osRecemCriada, fulfillmentBlockReason]);

  // Função para finalizar venda
  const handleFinalizarVenda = async (dados: DadosPagamento) => {
    if (submittingRef.current || osRecemCriada || !selectedClient || !cartValid) {
      toast.error("Revise o cliente, a tabela e as quantidades antes de finalizar");
      return;
    }
    if (fulfillmentBlockReason) {
      toast.error(fulfillmentBlockReason);
      return;
    }
    if (dados.pagoAgora && (!canReceivePayments || isFaturado || !dados.formaPagamento)) {
      toast.error(isFaturado ? "Cliente faturado: o recebimento será feito no fechamento" : "Recebimento exige permissão de caixa e caixa aberto");
      return;
    }
    if (!isCustomerPaymentAllowed(paymentTerms, { ...dados, canReceivePayments }) || (!canManageCommercialTerms && dados.valorDesconto > 0) || (dados.formaPagamento === "FIDELIDADE" && !canUseLoyalty)) {
      toast.error("O pagamento deve respeitar a condição do cliente e suas permissões");
      return;
    }
    if (!Number.isFinite(dados.valorTotal) || dados.valorTotal <= 0 || !Number.isFinite(dados.valorDesconto) || dados.valorDesconto < 0 || (isFaturado && (dados.urgente || dados.valorDesconto > 0))) {
      toast.error("Revise os valores do atendimento; faturado deve manter o valor do ROL igual ao lançamento");
      return;
    }
    
    submittingRef.current = true;
    setIsProcessingVenda(true);
    
    try {
      const saleKey = saleIdempotencyRef.current ?? createPdvIdempotencyKey("sale");
      saleIdempotencyRef.current = saleKey;
      const payment = !dados.pagoAgora || !dados.formaPagamento || dados.formaPagamento === "FIDELIDADE"
        ? null
        : dados.formaPagamento === "PIX"
          ? { method: "PIX" as const }
          : {
              method: dados.formaPagamento,
              amountReceived: dados.formaPagamento === "DINHEIRO" ? dados.valorRecebido : undefined,
              installments: dados.formaPagamento === "CARTAO_CREDITO" ? dados.parcelas ?? 1 : 1,
              brand: dados.bandeira,
              nsu: dados.nsu,
              authorizationCode: dados.codigoAutorizacao,
            };
      const result = await createPdvSale.mutateAsync({
        clientId: selectedClientId,
        cashRegisterId: dados.pagoAgora ? caixaAberto?.id ?? null : null,
        deliveryDate: dados.previsaoEntrega.toISOString().split("T")[0],
        urgent: dados.urgente,
        urgencyPercentage: dados.percentualUrgencia,
        discountAmount: dados.valorDesconto,
        receiptMode: dados.receiptMode,
        deliveryMode: dados.deliveryMode,
        addressSnapshot: dados.addressSnapshot,
        capacityOverride: isCapacityExceeded && fulfillment.capacityOverride && canManageCommercialTerms,
        driverId: dados.motoristaId,
        vehicleId: dados.veiculoId,
        items: cart.map((item) => ({
          produto_id: item.id,
          quantidade: item.quantidade,
          cor_item: item.cor_item,
          marca_item: item.marca_item,
          avarias: item.avarias,
          posicao_prateleira: item.posicao_prateleira,
          observacoes: [
            item.observacoes,
            item.operacao ? `Operação: ${item.operacao}` : null,
            item.tipo_preco ? `Tipo de preço: ${item.tipo_preco}` : null,
            item.servicos_adicionais?.length ? `Serviços adicionais: ${item.servicos_adicionais.join(", ")}` : null,
            item.complemento ? `Complemento: ${item.complemento}` : null,
          ].filter(Boolean).join(" · ") || undefined,
        })),
        notes: rolNotes.trim() || null,
        payment,
        idempotencyKey: saleKey,
      });

      setOsRecemCriada({
        id: result.order.id,
        numero: result.order.number,
        valorTotal: result.order.total,
        previsaoEntrega: dados.previsaoEntrega,
      });

      // O recibo de entrada é enviado a partir do ROL já persistido. O envio
      // não bloqueia o caixa e a chave impede duplicidade em novo clique.
      void dispararNotificacaoAutomatica(
        "rol_entrada",
        result.order.id,
        `rol:${result.order.id}:entrada`,
      ).then((notification) => {
        if (notification.success && !notification.skipped && !notification.idempotent) {
          toast.success(`ROL ${result.order.number} enviado ao cliente pelo WhatsApp.`);
          return;
        }
        if (!notification.success && !notification.idempotent) {
          toast.message(`ROL ${result.order.number} criado; o envio automático não foi concluído. Verifique o WhatsApp do cliente.`);
        }
      });

      setShowPagamentoModal(false);
      if (dados.pagoAgora && caixaAberto && dados.formaPagamento === "FIDELIDADE" && dados.pontosResgate) {
        try {
          const redeemed = await redeemLoyalty.mutateAsync({
            orderId: result.order.id,
            cashRegisterId: caixaAberto.id,
            moment: "ENTRADA",
            points: dados.pontosResgate,
            idempotencyKey: `${saleKey}:loyalty`,
          });
          toast.success(`${dados.pontosResgate} pontos resgatados (${Number(redeemed.redeemedValue ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`);
        } catch (loyaltyError) {
          toast.error(loyaltyError instanceof Error ? loyaltyError.message : "O ROL foi criado, mas não foi possível resgatar os pontos");
        }
      }
      if (dados.pagoAgora && caixaAberto && dados.formaPagamento === "PIX") {
        if (result.pixError) toast.error(`ROL ${result.order.number} criado; PIX pendente. Retome o pagamento neste ROL, sem criar outro atendimento. ${result.pixError}`);
        setPixContext({
          orderId: result.order.id,
          orderNumber: result.order.number,
          amount: result.pix?.amount ?? result.order.total,
          cashRegisterId: caixaAberto.id,
          moment: "ENTRADA",
          idempotencyKey: `${saleKey}:pix`,
          initialPix: result.pix,
          initialError: result.pixError,
          source: "sale",
        });
      } else {
        setShowImpressaoModal(true);
      }
      
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao finalizar venda");
    } finally {
      submittingRef.current = false;
      setIsProcessingVenda(false);
    }
  };

  const handleSaveQuote = async () => {
    if (!selectedClient || !cartValid || savePdvQuote.isPending) {
      toast.error("Selecione o cliente e confira os itens antes de salvar o orçamento");
      return;
    }

    try {
      const quote = await savePdvQuote.mutateAsync({
        clientId: selectedClient.id,
        total: totalValue,
        validUntil: format(addDays(new Date(), 7), "yyyy-MM-dd"),
        notes: rolNotes,
        items: cart.map((item) => ({
          produto_id: item.id,
          codigo: item.codigo ?? null,
          descricao: item.nome,
          quantidade: item.quantidade,
          unidade: item.unidade,
          preco_unitario: item.preco,
          subtotal: item.preco * item.quantidade,
          tabela_preco: clientPriceMode,
          detalhes: {
            cor: item.cor_item ?? null,
            marca: item.marca_item ?? null,
            defeito: item.avarias ?? null,
            posicao: item.posicao_prateleira ?? null,
            observacoes: item.observacoes ?? null,
            operacao: item.operacao ?? null,
            tipo_preco: item.tipo_preco ?? null,
            servicos_adicionais: item.servicos_adicionais ?? [],
            complemento: item.complemento ?? null,
          },
        })),
      });
      toast.success(`Orçamento salvo com sucesso · ${formatCurrency(Number(quote.valor_total))}`);
      clearCart();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o orçamento");
    }
  };

  const handleSaveSessionDraft = () => {
    if (!selectedClient || cart.length === 0) {
      toast.error("Selecione o cliente e adicione itens antes de salvar o rascunho");
      return;
    }
    sessionStorage.setItem(`anjolav:pdv-draft:${area}:${mode}`, JSON.stringify({
      clientId: selectedClient.id,
      cart,
      fulfillment,
      notes: rolNotes,
      savedAt: new Date().toISOString(),
    }));
    toast.success("Rascunho salvo nesta sessão do PDV");
  };

  // Função após impressão (ou pular)
  const handleImpressaoComplete = () => {
    // Salvar último cliente usado
    if (selectedClientId) {
      setUltimoClienteId(selectedClientId);
    }
    setOsRecemCriada(null);
    saleIdempotencyRef.current = null;
    clearCart();
    setSelectedClientId(null);
    setClientSearch("");
    toast.success("Venda finalizada com sucesso!");
  };

  const handlePixRecebimento = (request: PixRecebimentoRequest) => {
    if (!canReceivePayments) return;
    setPixContext({
      ...request,
      moment: "RETIRADA",
      source: "receivable",
    });
  };

  const handlePixFinished = (confirmed: boolean) => {
    const source = pixContext?.source;
    setPixContext(null);
    if (source === "sale") {
      setShowImpressaoModal(true);
      if (!confirmed) toast.info("O ROL foi criado e o pagamento permanece pendente");
    } else {
      setOsParaReceber(null);
      if (!confirmed) toast.info("O pagamento do ROL permanece pendente");
    }
  };

  // Detectar leitura de código de barras (digitação rápida)
  useEffect(() => {
    const handleBarcodeInput = (e: KeyboardEvent) => {
      // Ignorar se um modal está aberto ou se está em um input
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;

      // Detectar digitação rápida de números (scanner)
      if (/^[0-9]$/.test(e.key)) {
        const nextBuffer = barcodeBufferRef.current + e.key;
        barcodeBufferRef.current = nextBuffer;
        if (barcodeTimeoutRef.current) {
          clearTimeout(barcodeTimeoutRef.current);
        }
        barcodeTimeoutRef.current = setTimeout(() => {
          if (nextBuffer.length >= 3) {
            const produto = produtosAtivos.find((p) => p.codigo === nextBuffer);
            if (produto) {
              addToCart(produto);
            } else {
              toast.error(`Produto não encontrado: ${nextBuffer}`);
            }
          }
          barcodeBufferRef.current = "";
          barcodeTimeoutRef.current = null;
        }, 150);
      }
    };

    window.addEventListener("keypress", handleBarcodeInput);
    return () => {
      window.removeEventListener("keypress", handleBarcodeInput);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = null;
      }
      barcodeBufferRef.current = "";
    };
  }, [addToCart, produtosAtivos]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Usar último cliente
  const selectLastClient = useCallback(() => {
    if (ultimoClienteId && clientesFiltradosPorTipo.some(c => c.id === ultimoClienteId)) {
      selectClient(ultimoClienteId);
      toast.success("Último cliente selecionado");
    } else {
      toast.info("Nenhum cliente anterior disponível");
    }
  }, [ultimoClienteId, selectClient, clientesFiltradosPorTipo]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    // Ignorar se está digitando em um input (exceto para F-keys)
    const isTyping = document.activeElement?.tagName === "INPUT" || 
                     document.activeElement?.tagName === "TEXTAREA";
    
    // F1 - Ajuda
    if (e.key === "F1") {
      e.preventDefault();
      setShowAjudaAtalhos(true);
    }
    // F2 - Cliente
    if (e.key === "F2") {
      e.preventDefault();
      focusClientSearch();
    }
    // F3 - Agenda do dia
    if (e.key === "F3") {
      e.preventDefault();
      if (canViewDayList) setShowListaDia(true);
    }
    // F4 - Pagamento
    if (e.key === "F4") {
      e.preventDefault();
      handleOpenPagamento();
    }
    // F5 - Imprimir ROL recém-finalizada
    if (e.key === "F5") {
      e.preventDefault();
      if (osRecemCriada) {
        void printROL(osRecemCriada.id);
      } else {
        toast.info("Finalize o atendimento antes de imprimir a ROL.");
      }
    }
    // F6 - Consultar ordens e ROLs
    if (e.key === "F6") {
      e.preventDefault();
      setPdvLookupMode("consulta");
      setShowConsultarOSModal(true);
    }
    // F7 - Sangria/Suprimento (abre sangria por padrão)
    if (e.key === "F7") {
      e.preventDefault();
      if (canReceivePayments) {
        setShowSangriaModal(true);
      }
    }
    // F8 - Limpar carrinho
    if (e.key === "F8") {
      e.preventDefault();
      requestClearSale();
    }
    // F9 - Último cliente
    if (e.key === "F9") {
      e.preventDefault();
      selectLastClient();
    }
    // F10 - Fechar caixa
    if (e.key === "F10") {
      e.preventDefault();
      if (canReceivePayments) {
        setShowFecharCaixaModal(true);
      }
    }
    // F11 - Tela cheia
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    // + / - para quantidade do último item (apenas se não estiver digitando)
    if (!isTyping && cart.length > 0) {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const lastItem = cart[cart.length - 1];
        updateQuantity(lastItem.id, 1);
      }
      if (e.key === "-") {
        e.preventDefault();
        const lastItem = cart[cart.length - 1];
        updateQuantity(lastItem.id, -1);
      }
    }
    // ESC - Fechar modais
    if (e.key === "Escape") {
      if (showPagamentoModal) setShowPagamentoModal(false);
      if (showConsultarOSModal) {
        setShowConsultarOSModal(false);
        setPdvLookupMode("consulta");
      }
      if (showHistoricoVendas) setShowHistoricoVendas(false);
      if (showAjudaAtalhos) setShowAjudaAtalhos(false);
      if (showFulfillmentModal) closeFulfillmentModal();
    }
  }, [
    canReceivePayments,
    canViewDayList,
    cart,
    focusClientSearch,
    handleOpenPagamento,
    requestClearSale,
    osRecemCriada,
    printROL,
    selectLastClient,
    showAjudaAtalhos,
    showConsultarOSModal,
    closeFulfillmentModal,
    showFulfillmentModal,
    showHistoricoVendas,
    showPagamentoModal,
    toggleFullscreen,
    updateQuantity,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const preventAccidentalExit = (event: BeforeUnloadEvent) => {
      if (cart.length === 0 || osRecemCriada) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventAccidentalExit);
    return () => window.removeEventListener("beforeunload", preventAccidentalExit);
  }, [cart.length, osRecemCriada]);

  useEffect(() => {
    setOperationSwitchLocked(cart.length > 0 && !osRecemCriada);
    return () => setOperationSwitchLocked(false);
  }, [cart.length, osRecemCriada, setOperationSwitchLocked]);

  // Escutar mudanças de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const currentItem = cart[cart.length - 1] ?? null;
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openOrderLookup = useCallback((mode: "consulta" | "posicao" = "consulta") => {
    setPdvLookupMode(mode);
    setShowConsultarOSModal(true);
  }, []);

  const workbenchTitle = mode === "delivery"
    ? "Balcão / PDV — Novo Delivery"
    : mode === "orcamento"
      ? "Balcão / PDV — Novo orçamento"
      : "Balcão / PDV — Novo ROL";
  const serviceLabel = mode === "delivery" ? "Delivery" : mode === "orcamento" ? "orçamento" : "ROL";
  const selectorPath = area === "industrial" ? "/pdv/industrial" : "/pdv/domestico";

  return (
    <PdvLayout variant="front" operation={area} title={workbenchTitle} subtitle={`Atendimento ${areaLabel}`}>

      <div className={cn("pdv-cashier-page pdv-roll-workbench", `pdv-roll-workbench--${mode}`)} data-testid="pdv-cashier-reference">
        <div className="pdv-roll-heading">
          <button type="button" onClick={() => navigate(selectorPath)}><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <span aria-hidden="true" />
          <div>
            <h1>{workbenchTitle}</h1>
            <p>{mode === "delivery" ? "Coleta e entrega no endereço do cliente" : mode === "orcamento" ? "Proposta sem cobrança ou movimentação de caixa" : "Atendimento completo de peças e serviços"}</p>
          </div>
          <nav aria-label="Tipo de atendimento">
            <button type="button" className={mode === "rol" ? "is-active" : undefined} onClick={() => navigate(`${selectorPath}/rol`)}>ROL</button>
            <button type="button" className={mode === "delivery" ? "is-active" : undefined} onClick={() => navigate(`${selectorPath}/delivery`)}>Delivery</button>
            <button type="button" className={mode === "orcamento" ? "is-active" : undefined} onClick={() => navigate(`${selectorPath}/orcamento`)}>Orçamento</button>
          </nav>
        </div>
        <div className="pdv-cashier-grid">
          <section className="pdv-primary-column" aria-label="Etapas de entrada do pedido">
            <section className="pdv-reference-card pdv-customer-card" aria-labelledby="pdv-client-title">
              <div className="pdv-card-title-row">
                <div className="pdv-card-title">
                  <span className="pdv-step-number" aria-hidden="true">1</span>
                  <h2 id="pdv-client-title">Cliente</h2>
                </div>
                {canCreateClient && !selectedClient && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setShowQuickClientModal(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Novo
                  </Button>
                )}
              </div>

              <div className="pdv-customer-search">
                <Search className="h-4 w-4" />
                <Input
                  id="pdv-client-search"
                  ref={clientSearchRef}
                  placeholder="Buscar por nome, telefone ou CPF..."
                  value={clientSearch}
                  onChange={(event) => {
                    setClientSearch(event.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  skipUppercase
                  className="pl-10 text-sm"
                />
                {showClientList && (
                  <div className="pdv-customer-result-list">
                    {isLoadingClientes ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">Carregando clientes…</p>
                    ) : filteredClientes.length === 0 ? (
                      <div className="space-y-2 p-3 text-center text-sm text-muted-foreground">
                        <p>Nenhum cliente encontrado.</p>
                        {canCreateClient && <Button type="button" size="sm" onClick={() => setShowQuickClientModal(true)}><UserPlus className="mr-2 h-4 w-4" />Cadastrar cliente</Button>}
                      </div>
                    ) : (
                      filteredClientes.map((cliente) => (
                        <button key={cliente.id} type="button" onClick={() => selectClient(cliente.id)}>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{cliente.nome_fantasia || cliente.razao_social}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{cliente.cpf_cnpj || "Sem documento"} · {cliente.telefone || "Sem telefone"}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedClient ? (
                <div className="pdv-customer-selected">
                  <div className="pdv-customer-selected-main">
                    <div className="pdv-customer-selected-top">
                      <span className="pdv-customer-avatar"><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="pdv-customer-name">
                          {selectedClient.nome_fantasia || selectedClient.razao_social}
                          <span className="pdv-customer-badge">Cliente</span>
                          <span className="pdv-customer-price-badge" title="Tabela de preço configurada para este cliente">
                            Tabela: {CLIENT_PRICE_MODE_LABELS[normalizeClientPriceMode(selectedClient.tabela_preco_tipo)]}
                          </span>
                        </p>
                        {canUseLoyalty && isLoadingCustomerLoyalty ? (
                          <p className="pdv-customer-loyalty text-muted-foreground">Consultando pontos…</p>
                        ) : canUseLoyalty && customerLoyalty?.programaAtivo ? (
                          <p className="pdv-customer-loyalty text-success">{customerLoyalty.saldoPontos} pontos · {formatCurrency(customerLoyalty.valorSaldo)}</p>
                        ) : null}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={clearClient} aria-label="Remover cliente" title="Trocar cliente">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="pdv-customer-meta">
                      {selectedClient.telefone && <span><Phone className="h-3.5 w-3.5" /><span>{selectedClient.telefone}</span></span>}
                      {selectedClient.cpf_cnpj && <span><IdCard className="h-3.5 w-3.5" /><span>{selectedClient.cpf_cnpj}</span></span>}
                      {selectedClient.email && <span><Mail className="h-3.5 w-3.5" /><span>{selectedClient.email}</span></span>}
                    </div>
                    <button type="button" className="pdv-customer-history" onClick={() => setShowHistoricoVendas(true)}>
                      <span className="flex items-center gap-2"><FileSearch className="h-4 w-4" /> Ver histórico do cliente</span>
                      <span aria-hidden="true">›</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mt-4 flex flex-1 items-center rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center text-xs text-muted-foreground">
                    Escolha o cliente para liberar a tabela de preço, os serviços e a finalização do atendimento.
                  </div>
                </div>
              )}
            </section>

          <section className="pdv-center-column">
            <section className="pdv-items-card overflow-hidden" aria-labelledby="pdv-items-title">
              <div className="pdv-items-header">
                <div className="pdv-items-title">
                  <span className="pdv-step-number" aria-hidden="true">4</span>
                  <div className="pdv-items-title-copy">
                    <h2 id="pdv-items-title">Itens da venda</h2>
                    <p>Adicione produtos e serviços da lavanderia.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="pdv-items-stats">{cart.length} {cart.length === 1 ? "produto" : "produtos"} · {formatCarga(totalItems)} {totalItems === 1 ? "unidade" : "unidades"}</span>
                  <Button type="button" variant="outline" size="sm" className="pdv-clear-button hidden gap-1.5 sm:inline-flex" onClick={requestClearSale}>
                    <Trash2 className="h-3.5 w-3.5" /> Limpar itens
                  </Button>
                </div>
              </div>

              <div className="pdv-product-entry">
                <div className="pdv-product-search">
                  <Search className="h-4 w-4" />
                  <Input
                    id="pdv-product-search"
                    ref={searchInputRef}
                    disabled={!selectedClient || catalogLoading || catalogError}
                    placeholder={!selectedClient ? "Selecione primeiro o cliente" : catalogLoading ? "Carregando tabela de preços..." : catalogError ? "Tabela indisponível" : "Buscar produto ou serviço (ex.: camisa, calça, lençol...)"}
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setShowProductList(true);
                    }}
                    onFocus={() => setShowProductList(true)}
                    skipUppercase
                  />
                  {showProductList && (
                    <div className="pdv-product-result-list">
                      {isLoadingProdutos ? (
                        <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos…</div>
                      ) : filteredProdutos.length === 0 ? (
                        <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto ou serviço encontrado.</p>
                      ) : (
                        filteredProdutos.slice(0, 8).map((produto) => {
                          const preco = getPrecoForProduto(produto);
                          return (
                            <button key={produto.id} type="button" disabled={!catalogReady} onClick={() => addToCart(produto)}>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">{produto.nome}</span>
                                <span className="block text-[11px] text-muted-foreground">{produto.codigo || "Sem código"}</span>
                              </span>
                              <span className="shrink-0 text-sm font-bold text-success">{formatCurrency(preco)}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div className="pdv-product-quantity-field">
                  <span>Quantidade</span>
                  <div className="pdv-product-quantity">
                    <button type="button" disabled={!currentItem} onClick={() => currentItem && updateQuantity(currentItem.id, -1)} aria-label="Diminuir quantidade do item atual"><Minus className="h-4 w-4" /></button>
                    <Input aria-label="Quantidade do item atual" inputMode="decimal" disabled={!currentItem} value={currentItem ? quantityDrafts[currentItem.id] ?? String(currentItem.quantidade) : "1"} onChange={(event) => currentItem && editQuantity(currentItem, event.target.value)} />
                    <button type="button" disabled={!currentItem || !catalogReady} onClick={() => currentItem && updateQuantity(currentItem.id, 1)} aria-label="Aumentar quantidade do item atual"><Plus className="h-4 w-4" /></button>
                  </div>
                </div>

                <Button type="button" className="pdv-add-button gap-2" disabled={!catalogReady} onClick={handleAddCurrentProduct}>
                  <ShoppingCart className="h-4 w-4" /> Adicionar
                </Button>

                {(catalogError || (selectedClient && catalogLoading) || invalidQuantity) && (
                  <div className="col-span-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                    {catalogError ? <>Não foi possível carregar clientes, tabela ou condição de pagamento. <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={() => { void refetchPrices(); void refetchTerms(); void refetchProducts(); void refetchClients(); }}>Tentar novamente</Button></> : invalidQuantity ? "Quantidade deve ser maior que zero e até 999. Peças exigem valores inteiros." : "Carregando tabela e condição de pagamento…"}
                  </div>
                )}
              </div>

              <div className="pdv-items-content">
                <div className="pdv-mobile-cart" data-testid="pdv-mobile-cart">
                  {cart.length === 0 ? (
                    <div className="pdv-items-empty">
                      <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                      <p className="font-medium">Nenhum item lançado</p>
                      <p className="mt-1 text-xs">Selecione o cliente e adicione um serviço.</p>
                    </div>
                  ) : cart.map((item, index) => (
                    <article key={item.id} className={cn("rounded-lg border p-3", item.avarias && "border-warning/40 bg-warning/5")}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-muted-foreground">ITEM {index + 1}</p>
                          <p className="truncate font-black">{item.nome}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(item.preco)} / {item.unidade}</p>
                        </div>
                        <p className="shrink-0 text-lg font-black text-success">{formatCurrency(item.preco * item.quantidade)}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="pdv-table-quantity">
                          <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Diminuir ${item.nome}`}><Minus className="h-3.5 w-3.5" /></button>
                          <Input aria-label={`Quantidade de ${item.nome}`} inputMode={["Kg", "Mt"].includes(item.unidade) ? "decimal" : "numeric"} value={quantityDrafts[item.id] ?? String(item.quantidade)} onChange={(event) => editQuantity(item, event.target.value)} />
                          <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Aumentar ${item.nome}`}><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openDetalhesModal(item)} aria-label={`Detalhes de ${item.nome}`}><FileText className="h-4 w-4" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)} aria-label={`Remover ${item.nome}`}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <table className="pdv-items-table">
                  <thead>
                    <tr>
                      <th className="w-14 text-center">#</th>
                      <th className="w-[105px]">Item</th>
                      <th>Descrição</th>
                      <th className="w-[128px] text-center">Quant.</th>
                      <th className="w-[94px] text-center">Unidade</th>
                      <th className="w-[105px] text-right">Preço unit.</th>
                      <th className="w-[113px] text-right">Total</th>
                      <th className="w-[110px] text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="pdv-items-empty">
                            <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                            <p className="font-medium">Nenhum item lançado</p>
                            <p className="mt-1 text-xs">Selecione primeiro o cliente e pesquise um produto ou serviço para iniciar a venda.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, index) => {
                        const temDetalhes = hasItemDetalhes(item);
                        return (
                          <tr key={item.id} className={cn(item.avarias && "bg-warning/5")}>
                            <td className="text-center font-semibold text-muted-foreground">{index + 1}</td>
                            <td>
                              <div className="pdv-item-product">
                                <span className="pdv-item-thumb"><Package className="h-5 w-5" /></span>
                                <span className="min-w-0"><span className="pdv-item-code">{item.codigo || String(index + 1).padStart(3, "0")}</span></span>
                              </div>
                            </td>
                            <td>
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="pdv-item-name">{item.nome}</span>
                                {item.avarias && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
                              </div>
                              <span className="pdv-item-description">{item.descricao || (temDetalhes ? "Detalhes de peça registrados" : "Lavagem e processamento")}</span>
                            </td>
                            <td>
                              <div className="pdv-table-quantity">
                                <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Diminuir ${item.nome}`}><Minus className="h-3.5 w-3.5" /></button>
                                <Input aria-label={`Quantidade de ${item.nome}`} inputMode={["Kg", "Mt"].includes(item.unidade) ? "decimal" : "numeric"} value={quantityDrafts[item.id] ?? String(item.quantidade)} onChange={(event) => editQuantity(item, event.target.value)} />
                                <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Aumentar ${item.nome}`}><Plus className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                            <td className="text-center"><span className="pdv-unit-chip"><span>{getPdvUnitDisplay(item.unidade)}</span><ChevronDown className="h-3.5 w-3.5" /></span></td>
                            <td className="text-right font-semibold tabular-nums">{formatCurrency(item.preco)}</td>
                            <td className="text-right font-black tabular-nums">{formatCurrency(item.preco * item.quantidade)}</td>
                            <td>
                              <div className="pdv-item-actions">
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-primary" onClick={() => openDetalhesModal(item)} aria-label={`Detalhes de ${item.nome}`} title="Editar detalhes do item"><Pencil className="h-4 w-4" /></Button>
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeFromCart(item.id)} aria-label={`Remover ${item.nome}`} title="Remover item"><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
