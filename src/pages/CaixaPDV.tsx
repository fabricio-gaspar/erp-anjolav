import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
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
  AlertTriangle,
  DoorOpen,
  Maximize,
  Minimize,
  History,
  Keyboard,
  Clock,
  BarChart3,
  Settings2,
  UserRound,
  UserPlus,
  PackagePlus,
  ClipboardPlus,
  CalendarPlus,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes, useConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import { useCaixaAberto } from "@/hooks/useCaixa";
import { ItemDetalhesModal } from "@/components/caixa/ItemDetalhesModal";
import { PagamentoModal, DadosPagamento } from "@/components/caixa/PagamentoModal";
import { ImpressaoPosVendaModal } from "@/components/caixa/ImpressaoPosVendaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { SangriaModal } from "@/components/caixa/SangriaModal";
import { SuprimentoModal } from "@/components/caixa/SuprimentoModal";
import { ConsultarOSModal } from "@/components/caixa/ConsultarOSModal";
import { ReceberPagamentoModal, type PixRecebimentoRequest } from "@/components/caixa/ReceberPagamentoModal";
import { PixPagamentoModal } from "@/components/caixa/PixPagamentoModal";

import { AjudaAtalhosModal } from "@/components/caixa/AjudaAtalhosModal";
import { ClientePagamentoDialog } from "@/components/caixa/ClientePagamentoDialog";
import { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintOS } from "@/hooks/usePrintOS";
import { useCreatePdvSale, usePdvCustomerLoyaltySummary, useRedeemPdvLoyalty } from "@/hooks/usePdvPayments";
import { createPdvIdempotencyKey, type PdvPixPayment } from "@/lib/pdvPayment";


import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigationAccess, usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { buildClientPriceCatalog } from "@/lib/clientPricing";
import { parseCustomerPaymentTerms, customerPaymentTermsLabels, isCustomerPaymentAllowed } from "@/lib/customerPaymentTerms";
import { ClienteContrato } from "@/components/clientes/ClienteContrato";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface CartItem {
  id: string;
  nome: string;
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
}

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

const getUnidadeLabel = (unidade: string | null) => {
  switch (unidade) {
    case "kg": return "Kg";
    case "peca": return "Pç";
    case "metro": return "Mt";
    case "unidade": return "Un";
    default: return "Pç";
  }
};


const isValidQuantity = (value: number, unidade: string) =>
  Number.isFinite(value) && value > 0 && value <= 999 &&
  (["Kg", "Mt"].includes(unidade) || Number.isInteger(value));

// Remount the sale and its dialogs whenever the security context changes.
const CaixaPDV = () => {
  const { activeArea } = useWorkspace();
  const { activeTenant, user } = useAuth();
  const { pathname } = useLocation();
  if (!activeTenant || !user || !pathname.startsWith("/" + activeArea + "/")) {
    return <AppLayout title="PDV Atendimento"><p>Carregando contexto do atendimento...</p></AppLayout>;
  }
  return <PdvAtendimento key={[activeTenant.id, user.id, activeArea].join(":")} />;
};

const PdvAtendimento = () => {

  const navigate = useNavigate();
  const { activeArea } = useWorkspace();
  const area = activeArea === "industrial" ? "industrial" : "residencial";
  const areaLabel = area === "industrial" ? "Industrial" : "Residencial";
  const { canAccessRoute } = useNavigationAccess();
  const { allowed: canOperateCaixa } = usePermissaoModulo("caixa");
  const canUseLoyalty = area === "residencial" && canOperateCaixa;
  const { allowed: canManageCommercialTerms } = usePermissaoModulo("alterar_condicoes_comerciais");
  const canManageContracts = canAccessRoute("/" + area + "/clientes");
  const canCreateSale = canAccessRoute("/" + area + "/caixa");
  const { produtos, isLoading: isLoadingProdutos, isError: productsError, refetch: refetchProducts } = useProdutos();
  const { clientes, isLoading: isLoadingClientes, isError: clientsError, refetch: refetchClients } = useClientes();
  const { data: caixaAberto, isLoading: isLoadingCaixa } = useCaixaAberto(canOperateCaixa);
  const canReceivePayments = canOperateCaixa && !!caixaAberto;
  const createPdvSale = useCreatePdvSale();
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
  
  // Estado para modal de detalhes
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  
  // Estados para modais de pagamento e impressão
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showClientePagamentoDialog, setShowClientePagamentoDialog] = useState(false);
  const [showImpressaoModal, setShowImpressaoModal] = useState(false);
  const [osRecemCriada, setOsRecemCriada] = useState<OSRecemCriada | null>(null);
  const [isProcessingVenda, setIsProcessingVenda] = useState(false);
  const [pixContext, setPixContext] = useState<PixFlowContext | null>(null);
  const saleIdempotencyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  
  // Estados para modais de caixa
  const [showAbrirCaixaModal, setShowAbrirCaixaModal] = useState(false);
  const [showFecharCaixaModal, setShowFecharCaixaModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const [showSuprimentoModal, setShowSuprimentoModal] = useState(false);
  const [showConsultarOSModal, setShowConsultarOSModal] = useState(false);
  const [pdvLookupMode, setPdvLookupMode] = useState<"consulta" | "posicao">("consulta");
  const [showReceberPagamentoModal, setShowReceberPagamentoModal] = useState(false);
  const [osParaReceber, setOsParaReceber] = useState<OrdemServicoConsulta | null>(null);
  
  // Novos estados para funcionalidades profissionais
  const [showHistoricoVendas, setShowHistoricoVendas] = useState(false);
  const [showAjudaAtalhos, setShowAjudaAtalhos] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  

  const { precos: precosEspeciais, isLoading: pricesLoading, isError: pricesError, refetch: refetchPrices } = usePrecosEspeciais(selectedClientId);
  // Session-only shortcut; never restore a customer from global browser storage.
  const [ultimoClienteId, setUltimoClienteId] = useState<string | null>(null);
  const clientesFiltradosPorTipo = useMemo(() => clientes.filter(c => c.ativo && c.classificacao === area), [clientes, area]);
  const selectedClient = useMemo(() => clientesFiltradosPorTipo.find(c => c.id === selectedClientId), [clientesFiltradosPorTipo, selectedClientId]);
  const { configuracao: configuracaoPagamento, isLoading: termsLoading, isError: termsError, refetch: refetchTerms } = useConfiguracaoPagamentoCliente(selectedClient?.id ?? null);
  const { data: customerLoyalty, isLoading: isLoadingCustomerLoyalty } = usePdvCustomerLoyaltySummary(selectedClient?.id ?? null, canUseLoyalty);
  const catalogLoading = isLoadingProdutos || isLoadingClientes || pricesLoading || termsLoading;
  const catalogError = pricesError || termsError || productsError || clientsError;
  const catalogReady = canCreateSale && !!selectedClient && !catalogLoading && !catalogError;
  const isFaturado = configuracaoPagamento?.condicao_pagamento === "faturado";
  const paymentTerms = parseCustomerPaymentTerms(configuracaoPagamento);
  const paymentLabels = customerPaymentTermsLabels(paymentTerms);
  const produtosAtivos = useMemo(() => catalogReady ? buildClientPriceCatalog(
    produtos, precosEspeciais, selectedClient?.tabela_preco_tipo ?? "padrao", area,
  ) : [], [catalogReady, produtos, precosEspeciais, selectedClient?.tabela_preco_tipo, area]);
  const getPrecoForProduto = useCallback((produto: Produto): number =>
    produtosAtivos.find(p => p.id === produto.id)?.precoAplicado ?? NaN, [produtosAtivos]);
  const invalidQuantity = cart.some(item => {
    const raw = quantityDrafts[item.id];
    return raw !== undefined && (!/^\d+(?:[.,]\d+)?$/.test(raw) || !isValidQuantity(Number(raw.replace(",", ".")), item.unidade));
  });
  const cartValid = catalogReady && cart.length > 0 && !invalidQuantity && cart.every(item =>
    isValidQuantity(item.quantidade, item.unidade) && Number.isFinite(item.preco) && item.preco >= 0 &&
    produtosAtivos.some(p => p.id === item.id && p.precoAplicado === item.preco && getUnidadeLabel(p.unidade) === item.unidade));

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
  }, []);

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
    return !!(item.cor_item || item.marca_item || item.avarias || item.posicao_prateleira || item.observacoes);
  };

  const selectClient = useCallback((clientId: string) => {
    if (!clientesFiltradosPorTipo.some(c => c.id === clientId)) return;
    clearCart();
    setSelectedClientId(clientId);
    setShowClientList(false);
    setClientSearch("");
  }, [clientesFiltradosPorTipo, clearCart]);

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
    setSelectedClientId(null);
    setClientSearch("");
    clearCart();
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
    saleIdempotencyRef.current ??= createPdvIdempotencyKey("sale");
    setShowPagamentoModal(true);
  }, [catalogReady, cartValid, cart.length, selectedClientId, osRecemCriada]);

  const handleOpenClientePagamento = useCallback(() => {
    if (!canManageCommercialTerms) return;
    if (!selectedClientId) {
      toast.error("Selecione um cliente para configurar o pagamento");
      return;
    }
    setShowClientePagamentoDialog(true);
  }, [selectedClientId, canManageCommercialTerms]);

  const handleEditClientePagamento = useCallback(() => {
    setShowPagamentoModal(false);
    handleOpenClientePagamento();
  }, [handleOpenClientePagamento]);

  // Função para finalizar venda
  const handleFinalizarVenda = async (dados: DadosPagamento) => {
    if (submittingRef.current || osRecemCriada || !selectedClient || !cartValid) {
      toast.error("Revise o cliente, a tabela e as quantidades antes de finalizar");
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
      toast.error("Revise os valores do atendimento; faturado deve manter o valor da OS igual ao lançamento");
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
        driverId: dados.tipoLogistica === "entregar" ? dados.motoristaId : undefined,
        vehicleId: dados.tipoLogistica === "entregar" ? dados.veiculoId : undefined,
        items: cart.map((item) => ({
          produto_id: item.id,
          quantidade: item.quantidade,
          cor_item: item.cor_item,
          marca_item: item.marca_item,
          avarias: item.avarias,
          posicao_prateleira: item.posicao_prateleira,
          observacoes: item.observacoes,
        })),
        payment,
        idempotencyKey: saleKey,
      });

      setOsRecemCriada({
        id: result.order.id,
        numero: result.order.number,
        valorTotal: result.order.total,
        previsaoEntrega: dados.previsaoEntrega,
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
          toast.error(loyaltyError instanceof Error ? loyaltyError.message : "A OS foi criada, mas não foi possível resgatar os pontos");
        }
      }
      if (dados.pagoAgora && caixaAberto && dados.formaPagamento === "PIX") {
        if (result.pixError) toast.error(`ROL ${result.order.number} criado; PIX pendente. Retome o pagamento nesta OS, sem criar outro atendimento. ${result.pixError}`);
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

  // Função após impressão (ou pular)
  const handleImpressaoComplete = () => {
    // Salvar último cliente usado
    if (selectedClientId) {
      setUltimoClienteId(selectedClientId);
    }
    setOsRecemCriada(null);
    saleIdempotencyRef.current = null;
    setCart([]);
    setQuantityDrafts({});
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
      if (!confirmed) toast.info("A OS foi criada e o pagamento permanece pendente");
    } else {
      setOsParaReceber(null);
      if (!confirmed) toast.info("O pagamento da OS permanece pendente");
    }
  };

  // Atualizar hora a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
    // F3 - Foco na busca de produtos
    if (e.key === "F3") {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    // F4 - Pagamento
    if (e.key === "F4") {
      e.preventDefault();
      handleOpenPagamento();
    }
    // F5 - Consultar OS
    if (e.key === "F5") {
      e.preventDefault();
      setPdvLookupMode("consulta");
      setShowConsultarOSModal(true);
    }
    // F6 - Histórico de vendas
    if (e.key === "F6") {
      e.preventDefault();
      if (canCreateSale) setShowHistoricoVendas(true);
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
      clearCart();
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
      if (showOperations) setShowOperations(false);
    }
  }, [
    canCreateSale,
    canReceivePayments,
    cart,
    clearCart,
    handleOpenPagamento,
    selectLastClient,
    showAjudaAtalhos,
    showConsultarOSModal,
    showHistoricoVendas,
    showPagamentoModal,
    showOperations,
    toggleFullscreen,
    updateQuantity,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Escutar mudanças de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValue = cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  const currentItem = cart[cart.length - 1] ?? null;

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openQuickCadastro = (path: string) => {
    if (!canAccessRoute(path)) return;
    setShowOperations(false);
    navigate(path);
  };

  const openOrderLookup = useCallback((mode: "consulta" | "posicao" = "consulta") => {
    setPdvLookupMode(mode);
    setShowConsultarOSModal(true);
  }, []);

  return (
    <AppLayout title="PDV Atendimento" subtitle={`Setor ${areaLabel}`}>
      <section className="pdv-shell mx-[-1rem] flex w-[calc(100%+2rem)] max-w-none min-w-0 flex-col overflow-hidden rounded-xl border border-strong bg-muted/20 shadow-lg sm:mx-[-1.5rem] sm:w-[calc(100%+3rem)] xl:h-[calc(100vh-118px)]">
        <header className="grid min-h-16 grid-cols-[1fr_auto_1fr] items-center border-b bg-card px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="hidden lg:inline capitalize">{today}</span>
            <span>{format(currentTime, "HH:mm")}</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold tracking-wide sm:text-base">
              Atendente: {caixaAberto?.operador || "—"}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <p className="hidden text-sm font-black uppercase tracking-[0.14em] lg:block">{areaLabel}</p>
            {!canOperateCaixa ? <Badge variant="outline">Sem recebimento</Badge> : isLoadingCaixa ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : caixaAberto ? (
              <Badge variant="outline" className="border-success text-success">Aberto</Badge>
            ) : (
              <Button size="sm" className="h-8 gap-1" onClick={() => setShowAbrirCaixaModal(true)}>
                <DoorOpen className="h-3.5 w-3.5" />
                Abrir caixa
              </Button>
            )}
          </div>
        </header>
        <nav aria-label="Atalhos do atendimento" className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
          <Badge variant="secondary">Setor {areaLabel}</Badge>
          {canAccessRoute("/" + area + "/lancamentos") && <>
            <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/lancamentos?tab=pendentes")}>Fechamento</Button>
            <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/lancamentos?tab=faturas")}>Faturas</Button>
            <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/lancamentos?tab=historico")}>Histórico de ROLs faturados</Button>
          </>}
          {canManageContracts && <Button variant="outline" size="sm" disabled={!selectedClient} onClick={() => { if (selectedClient && canManageContracts) setShowContracts(true); }}>Contrato do cliente</Button>}
          {canAccessRoute("/" + area + "/clientes") && <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/clientes?novo=1")}><UserPlus className="mr-2 h-4 w-4" />Novo cliente</Button>}
          {canAccessRoute("/" + area + "/produtos") && <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/produtos?novo=1")}><PackagePlus className="mr-2 h-4 w-4" />Novo produto/serviço</Button>}
          {canAccessRoute("/" + area + "/ordens") && <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/ordens")}><ClipboardPlus className="mr-2 h-4 w-4" />Ordens de serviço</Button>}
          {canAccessRoute("/" + area + "/agenda") && <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/" + area + "/agenda?novo=1")}><CalendarPlus className="mr-2 h-4 w-4" />Agendamento</Button>}
        </nav>
        {(catalogError || (selectedClient && catalogLoading)) && <div role="status" className="border-b p-3 text-sm">
          {catalogError ? <>Não foi possível carregar clientes, tabela ou condição de pagamento. <Button variant="outline" size="sm" onClick={() => { void refetchPrices(); void refetchTerms(); void refetchProducts(); void refetchClients(); }}>Tentar novamente</Button></> : "Carregando tabela e condição de pagamento..."}
        </div>}
        {invalidQuantity && <p role="alert" className="px-4 py-2 text-sm text-destructive">Quantidade deve ser maior que zero e até 999. Use decimais apenas para kg ou metro; peças exigem inteiros.</p>}


        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(350px,410px)_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="relative flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
            {!isLoadingCaixa && !canReceivePayments && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Atendimento sem recebimento disponível. Pagar agora exige permissão de caixa e caixa aberto.
              </div>
            )}

            <div className="pdv-entry-card relative z-20 rounded-xl border border-strong bg-card p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <label htmlFor="pdv-client-search" className="flex items-center gap-2 text-base font-bold">
                  <UserRound className="h-5 w-5 text-primary" /> Cliente
                </label>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">1º passo</span>
              </div>
              {selectedClient ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-primary">{selectedClient.nome_fantasia || selectedClient.razao_social}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.cpf_cnpj}</p>
                      <p className="mt-1 text-[11px] font-semibold text-primary">
                        {selectedClient.tabela_preco_tipo === "personalizada" ? "Tabela personalizada ativa" : "Tabela padrão ativa"}
                      </p>
                      <p className="mt-1 text-xs">Condição: {termsLoading ? "Carregando..." : termsError ? "Não foi possível carregar" : paymentLabels.condition}</p>
                      {!termsLoading && !termsError && <p className="mt-1 text-xs text-muted-foreground">Forma preferida: {paymentLabels.preferredMethod}{paymentLabels.frequency ? ` · Fechamento: ${paymentLabels.frequency}` : ""}</p>}
                      {canUseLoyalty && isLoadingCustomerLoyalty ? (
                        <p className="mt-1 text-xs text-muted-foreground">Consultando pontos...</p>
                      ) : canUseLoyalty && customerLoyalty?.programaAtivo ? (
                        <p className="mt-1 text-xs text-primary">{customerLoyalty.saldoPontos} pontos · {formatCurrency(customerLoyalty.valorSaldo)}</p>
                      ) : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={clearClient} title="Trocar cliente">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {canManageCommercialTerms && <Button type="button" variant="outline" size="sm" className="mt-2 h-7 w-full gap-1 text-xs" onClick={handleOpenClientePagamento}>
                    <Settings2 className="h-3.5 w-3.5" />
                    {configuracaoPagamento ? "Editar pagamento" : "Configurar pagamento"}
                  </Button>}
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="pdv-client-search"
                      ref={clientSearchRef}
                      placeholder="Buscar cliente (nome, CPF/CNPJ, telefone)..."
                      value={clientSearch}
                      onChange={(event) => {
                        setClientSearch(event.target.value);
                        setShowClientList(true);
                      }}
                      onFocus={() => setShowClientList(true)}
                      className="h-10 pl-9 text-sm"
                    />
                    {showClientList && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-strong bg-card shadow-xl">
                        {isLoadingClientes ? (
                          <p className="p-3 text-center text-sm text-muted-foreground">Carregando...</p>
                        ) : filteredClientes.length === 0 ? (
                          <p className="p-3 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                        ) : (
                          filteredClientes.map((cliente) => (
                            <button key={cliente.id} type="button" onClick={() => selectClient(cliente.id)} className="w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-primary/5">
                              <p className="truncate text-sm font-medium">{cliente.nome_fantasia || cliente.razao_social}</p>
                              <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj} · {cliente.telefone}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="pdv-entry-card relative z-10 rounded-xl border border-strong bg-card p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <label htmlFor="pdv-product-search" className="flex items-center gap-2 text-base font-bold">
                  <ShoppingCart className="h-5 w-5 text-primary" /> Produto / Serviço
                </label>
                <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">2º passo</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="pdv-product-search"
                  ref={searchInputRef}
                  placeholder="Digite código ou nome do produto/serviço"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setShowProductList(true);
                  }}
                  onFocus={() => setShowProductList(true)}
                  className="h-11 pl-9 pr-3"
                />
                {showProductList && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-strong bg-card shadow-xl">
                    {isLoadingProdutos ? (
                      <div className="flex items-center justify-center gap-2 p-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Carregando produtos...
                      </div>
                    ) : filteredProdutos.length === 0 ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">Nenhum produto ou serviço encontrado.</p>
                    ) : (
                      filteredProdutos.slice(0, 8).map((produto) => {
                        const preco = getPrecoForProduto(produto);
                        return (
                          <button
                            key={produto.id}
                            type="button"
                            disabled={!catalogReady}
                            onClick={() => addToCart(produto)}
                            className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{produto.nome}</span>
                              <span className="block text-[11px] text-muted-foreground">{produto.codigo || "Sem código"}</span>
                            </span>
                            <span className="shrink-0 text-sm font-bold text-primary">{formatCurrency(preco)}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <Button type="button" className="mt-3 h-10 w-full gap-2 font-bold" disabled={!catalogReady} onClick={handleAddCurrentProduct}>
                <ShoppingCart className="h-4 w-4" />
                Adicionar item
                <span className="text-primary-foreground/70">↵</span>
              </Button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Quantidade</p>
                  <div className="flex h-10 items-center rounded-md border bg-background">
                    <Button type="button" variant="ghost" size="icon" className="h-full w-10 rounded-none" disabled={!currentItem} onClick={() => currentItem && updateQuantity(currentItem.id, -1)} aria-label="Diminuir quantidade do item atual">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input aria-label="Quantidade do item atual" inputMode="decimal" className="flex-1 min-w-0 border-0 text-center" disabled={!currentItem} value={currentItem ? quantityDrafts[currentItem.id] ?? String(currentItem.quantidade) : ""} onChange={e => currentItem && editQuantity(currentItem, e.target.value)} />
                    <Button type="button" variant="ghost" size="icon" className="h-full w-10 rounded-none" disabled={!currentItem || !catalogReady} onClick={() => currentItem && updateQuantity(currentItem.id, 1)} aria-label="Aumentar quantidade do item atual">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Preço unitário</p>
                  <div className="flex h-10 items-center justify-end rounded-md border bg-background px-3 text-base font-semibold tabular-nums">{formatCurrency(currentItem?.preco ?? 0)}</div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Subtotal</p>
                  <div className="flex h-10 items-center justify-end rounded-md border bg-background px-3 text-base font-semibold tabular-nums">{formatCurrency(currentItem ? currentItem.preco * currentItem.quantidade : 0)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs">
                <span className="font-semibold text-muted-foreground">Item atual</span>
                <span className="max-w-[65%] truncate font-bold">{currentItem?.nome || "Aguardando item"}</span>
              </div>
            </div>

            <div className="pdv-entry-card rounded-xl border border-strong bg-card p-2.5 shadow-sm sm:p-3">
              <div className="mb-2 flex items-center gap-2 text-base font-bold">
                <Keyboard className="h-5 w-5 text-primary" /> Ações rápidas
              </div>
              <p className="mb-2 text-xs text-muted-foreground">Atalhos do atendimento, consulta e operação do ROL.</p>
              <div className="pdv-shortcuts-grid grid grid-cols-3 gap-1.5 sm:grid-cols-4 xl:grid-cols-4">
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => { setShowProductList(true); searchInputRef.current?.focus(); }}>
                  <span className="flex flex-col items-center justify-center gap-1"><ShoppingCart className="h-5 w-5" />Produtos<span>F3</span></span>
                </Button>
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => openOrderLookup()}>
                  <span className="flex flex-col items-center justify-center gap-1"><FileSearch className="h-5 w-5" />Consultar<span>F5</span></span>
                </Button>
                <Button type="button" variant="outline" title="Localizar um ROL e registrar a posição da peça" className="pdv-shortcut-button h-[58px] rounded-lg border-primary/30 bg-primary/5 px-1 text-[10px] leading-tight hover:bg-primary/10" onClick={() => openOrderLookup("posicao")}>
                  <span className="flex flex-col items-center justify-center gap-1"><MapPin className="h-5 w-5 text-primary" />Posição<span>do ROL</span></span>
                </Button>
                {canAccessRoute("/" + area + "/agenda") && <Button type="button" variant="outline" title="Criar um novo agendamento" className="pdv-shortcut-button h-[58px] rounded-lg border-primary/30 bg-primary/5 px-1 text-[10px] leading-tight hover:bg-primary/10" onClick={() => openQuickCadastro("/" + area + "/agenda?novo=1")}>
                  <span className="flex flex-col items-center justify-center gap-1"><CalendarPlus className="h-5 w-5 text-primary" />Agendar<span>cliente</span></span>
                </Button>}
                {canAccessRoute("/" + area + "/ordens") && <Button type="button" variant="outline" title="Abrir as ordens de serviço" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => openQuickCadastro("/" + area + "/ordens")}>
                  <span className="flex flex-col items-center justify-center gap-1"><ClipboardPlus className="h-5 w-5" />Ordens<span>de serviço</span></span>
                </Button>}
                {canAccessRoute("/" + area + "/lancamentos") && <Button type="button" variant="outline" title="Consultar as faturas do setor" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => openQuickCadastro("/" + area + "/lancamentos?tab=faturas")}>
                  <span className="flex flex-col items-center justify-center gap-1"><CreditCard className="h-5 w-5" />Faturas<span>do setor</span></span>
                </Button>}
                {canAccessRoute("/" + area + "/lancamentos") && <Button type="button" variant="outline" title="Abrir fechamento e pendências" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => openQuickCadastro("/" + area + "/lancamentos?tab=pendentes")}>
                  <span className="flex flex-col items-center justify-center gap-1"><Lock className="h-5 w-5" />Fechamento<span>e pendências</span></span>
                </Button>}
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => setShowHistoricoVendas(true)}>
                  <span className="flex flex-col items-center justify-center gap-1"><History className="h-5 w-5" />Histórico<span>F6</span></span>
                </Button>
                {canAccessRoute("/" + area + "/clientes") && <Button type="button" variant="outline" title="Cadastrar um novo cliente" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => openQuickCadastro("/" + area + "/clientes?novo=1")}>
                  <span className="flex flex-col items-center justify-center gap-1"><UserPlus className="h-5 w-5" />Novo<span>cliente</span></span>
                </Button>}
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => {
                  if (!currentItem) {
                    toast.info("Adicione ou selecione um item para editar os detalhes");
                    return;
                  }
                  openDetalhesModal(currentItem);
                }}>
                  <span className="flex flex-col items-center justify-center gap-1"><FileText className="h-5 w-5" />Detalhes<span>Item</span></span>
                </Button>
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight text-destructive" onClick={() => {
                  if (cart.length === 0) {
                    toast.info("Não há itens para cancelar");
                    return;
                  }
                  clearCart();
                }}>
                  <span className="flex flex-col items-center justify-center gap-1"><Trash2 className="h-5 w-5" />Cancelar<span>F8</span></span>
                </Button>
                <Button type="button" variant="outline" className="pdv-shortcut-button h-[58px] rounded-lg px-1 text-[10px] leading-tight" onClick={() => setShowOperations((open) => !open)} aria-expanded={showOperations}>
                  <span className="flex flex-col items-center justify-center gap-1"><Settings2 className="h-5 w-5" />Mais<span>Ações</span></span>
                </Button>
              </div>
              {showOperations && (
                <div className="grid grid-cols-1 gap-2 mt-2 sm:grid-cols-2">
                  {canOperateCaixa && <>
                    <Button variant="outline" size="sm" disabled={!canReceivePayments} onClick={() => { if (canReceivePayments) setShowFecharCaixaModal(true); }}><Lock className="mr-2 h-4 w-4" /> Fechar caixa (F10)</Button>
                    <Button variant="outline" size="sm" disabled={!canReceivePayments} onClick={() => { if (canReceivePayments) setShowSangriaModal(true); }}><ArrowDownCircle className="mr-2 h-4 w-4" /> Sangria (F7)</Button>
                    <Button variant="outline" size="sm" disabled={!canReceivePayments} onClick={() => { if (canReceivePayments) setShowSuprimentoModal(true); }}><ArrowUpCircle className="mr-2 h-4 w-4" /> Suprimento</Button>
                  </>}
                  {canAccessRoute("/residencial/relatorios/caixa") && <Button variant="outline" size="sm" onClick={() => openQuickCadastro("/residencial/relatorios/caixa")}><BarChart3 className="mr-2 h-4 w-4" /> Relatório de caixa</Button>}
                  <Button variant="outline" size="sm" onClick={() => setShowAjudaAtalhos(true)}><Keyboard className="mr-2 h-4 w-4" /> Atalhos</Button>
                  <Button variant="outline" size="sm" onClick={toggleFullscreen}>{isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}Tela cheia</Button>
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[430px] min-w-0 flex-col overflow-hidden rounded-xl border border-strong bg-card shadow-sm xl:min-h-0">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <p className="text-base font-bold uppercase tracking-wide">Itens da venda</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="hidden text-xs text-muted-foreground sm:block">{cart.length} produtos · {totalItems} unidades</p>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-destructive" onClick={() => {
                  if (cart.length === 0) {
                    toast.info("Não há itens para limpar");
                    return;
                  }
                  clearCart();
                }}><Trash2 className="h-3.5 w-3.5" /> Limpar venda</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 border-b px-3 py-1.5 text-center">Item</th>
                    <th className="border-b px-3 py-1.5">Descrição</th>
                    <th className="w-32 border-b px-3 py-1.5 text-right">Preço unit.</th>
                    <th className="w-36 border-b px-3 py-1.5 text-center">Qtd.</th>
                    <th className="w-32 border-b px-3 py-1.5 text-right">Total</th>
                    <th className="w-24 border-b px-3 py-1.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-40 px-4 text-center text-muted-foreground">
                        <ShoppingCart className="mx-auto mb-2 h-8 w-8 opacity-30" />
                        <p className="font-medium">Nenhum item lançado</p>
                        <p className="mt-1 text-xs">Selecione primeiro o cliente e pesquise um produto ou serviço para iniciar a venda.</p>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, index) => {
                      const temDetalhes = hasItemDetalhes(item);
                      return (
                        <tr key={item.id} className={cn("border-b align-top hover:bg-muted/30", item.avarias && "bg-warning/5")}>
                          <td className="px-3 py-2 text-center font-semibold text-muted-foreground">{index + 1}</td>
                          <td className="min-w-0 px-3 py-2">
                            <div className="flex items-start gap-1.5">
                              <p className="min-w-0 flex-1 truncate font-semibold">{item.nome}</p>
                              {item.avarias ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{item.unidade}</span>
                              {temDetalhes ? <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-primary" />Detalhes</span> : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(item.preco)}</td>
                          <td className="px-3 py-2">
                            <div className="mx-auto flex w-fit items-center border bg-background">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, -1)} aria-label={`Diminuir ${item.nome}`}>
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Input aria-label={`Quantidade de ${item.nome}`} inputMode={["Kg", "Mt"].includes(item.unidade) ? "decimal" : "numeric"} className="h-8 w-16 border-0 px-1 text-center" value={quantityDrafts[item.id] ?? String(item.quantidade)} onChange={e => editQuantity(item, e.target.value)} />
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, 1)} aria-label={`Aumentar ${item.nome}`}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="font-bold tabular-nums">{formatCurrency(item.preco * item.quantidade)}</span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => openDetalhesModal(item)} title="Editar detalhes do item"><FileText className="h-3.5 w-3.5" /></Button>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.id)} title="Remover item"><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t bg-card p-2.5 sm:p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_minmax(220px,280px)] sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{totalItems} itens · {cart.length} produtos</p>
                  <p className="mt-1 truncate text-sm font-semibold">{selectedClient ? `Cliente: ${selectedClient.nome_fantasia || selectedClient.razao_social}` : "Nenhum cliente selecionado"}</p>
                </div>
                <div className="border-l pl-3 sm:min-w-[120px]">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(totalValue)}</p>
                </div>
                <div className="border-l pl-3 sm:min-w-[100px]">
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="text-lg font-bold tabular-nums">{formatCurrency(0)}</p>
                </div>
                <div className="rounded-lg bg-primary/10 px-4 py-2 sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Total</p>
                  <p className="text-2xl font-black tabular-nums text-primary sm:text-3xl">{formatCurrency(totalValue)}</p>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(240px,1.6fr)]">
                <Button type="button" variant="outline" className="h-11 gap-2 font-semibold" onClick={() => openOrderLookup()}><FileSearch className="h-4 w-4" /> Consultar ROL (F5)</Button>
                <Button type="button" className="h-11 gap-2 bg-success text-success-foreground hover:bg-success/90" disabled={!cartValid || isProcessingVenda} onClick={handleOpenPagamento}><CreditCard className="h-5 w-5" /> {isFaturado ? "Finalizar ROL faturado" : "Finalizar atendimento"} <span className="text-success-foreground/75">F4</span></Button>
              </div>
            </div>
          </section>
        </div>
      </section>

      {/* Modal de Detalhes do Item */}
      {selectedCartItem && (
        <ItemDetalhesModal
          open={detalhesModalOpen}
          onOpenChange={setDetalhesModalOpen}
          itemNome={selectedCartItem.nome}
          quantidade={selectedCartItem.quantidade}
          detalhes={{
            cor_item: selectedCartItem.cor_item,
            marca_item: selectedCartItem.marca_item,
            avarias: selectedCartItem.avarias,
            posicao_prateleira: selectedCartItem.posicao_prateleira,
            observacoes: selectedCartItem.observacoes,
          }}
          onSave={saveDetalhes}
        />
      )}

      {/* Modal de Pagamento */}
      <PagamentoModal
        open={showPagamentoModal}
        onOpenChange={setShowPagamentoModal}
        cart={cart}
        cliente={selectedClient ? {
          id: selectedClient.id,
          razao_social: selectedClient.razao_social,
          nome_fantasia: selectedClient.nome_fantasia,
          cpf_cnpj: selectedClient.cpf_cnpj,
        } : null}
        totalOriginal={totalValue}
        totalItems={totalItems}
        loyalty={canUseLoyalty ? customerLoyalty ?? null : null}
        canManageCommercialTerms={canManageCommercialTerms}
        canReceivePayments={canReceivePayments}
        termsLoading={catalogLoading}
        termsError={catalogError || !cartValid}
        loyaltyLoading={isLoadingCustomerLoyalty}
        configuracaoPagamento={configuracaoPagamento ?? null}
        onEditConfiguracaoPagamento={canManageCommercialTerms ? handleEditClientePagamento : undefined}
        onConfirm={handleFinalizarVenda}
        isLoading={isProcessingVenda}
      />

      {canManageCommercialTerms && <ClientePagamentoDialog
        open={showClientePagamentoDialog}
        onOpenChange={setShowClientePagamentoDialog}
        clienteId={selectedClientId}
      />}

      {/* Modal de Impressão Pós-Venda */}
      {osRecemCriada && (
        <ImpressaoPosVendaModal
          open={showImpressaoModal}
          onOpenChange={setShowImpressaoModal}
          osId={osRecemCriada.id}
          osNumero={osRecemCriada.numero}
          clienteNome={selectedClient?.nome_fantasia || selectedClient?.razao_social || "Cliente"}
          clienteTelefone={selectedClient?.telefone}
          valorTotal={osRecemCriada.valorTotal}
          totalPecas={totalItems}
          previsaoEntrega={osRecemCriada.previsaoEntrega}
          onComplete={handleImpressaoComplete}
        />
      )}

      {/* Modais de Caixa */}
      {canOperateCaixa && <AbrirCaixaModal
        open={showAbrirCaixaModal}
        onOpenChange={setShowAbrirCaixaModal}
      />}

      {canOperateCaixa && caixaAberto && (
        <>
          <FecharCaixaModal
            open={showFecharCaixaModal}
            onOpenChange={setShowFecharCaixaModal}
            caixa={caixaAberto}
          />
          <SangriaModal
            open={showSangriaModal}
            onOpenChange={setShowSangriaModal}
            caixaId={caixaAberto.id}
          />
          <SuprimentoModal
            open={showSuprimentoModal}
            onOpenChange={setShowSuprimentoModal}
            caixaId={caixaAberto.id}
          />
        </>
      )}

      {/* Modal Consultar OS */}
      <ConsultarOSModal
        open={showConsultarOSModal}
        onOpenChange={(open) => {
          setShowConsultarOSModal(open);
          if (!open) setPdvLookupMode("consulta");
        }}
        positionMode={pdvLookupMode === "posicao"}
        onReceberPagamento={canReceivePayments ? (ordem) => {
          if (!canReceivePayments || ordem.condicao_pagamento === "faturado") return;
          setOsParaReceber(ordem);
          setShowReceberPagamentoModal(true);
        } : undefined}
        onImprimirROL={(osId) => {
          void printROL(osId);
        }}
        onImprimirEtiquetas={(osId) => {
          void printEtiqueta(osId);
        }}
      />

      {/* Modal Receber Pagamento */}
      {canReceivePayments && osParaReceber && (
        <ReceberPagamentoModal
          canUseLoyalty={canUseLoyalty}
          open={showReceberPagamentoModal}
          onOpenChange={setShowReceberPagamentoModal}
          osId={osParaReceber.id}
          osNumero={osParaReceber.numero}
          clienteNome={osParaReceber.cliente?.nome_fantasia || osParaReceber.cliente?.razao_social || "Cliente"}
          valorTotal={osParaReceber.valor_total || 0}
          valorPago={osParaReceber.valor_pago || 0}
          onSuccess={() => {
            setOsParaReceber(null);
          }}
          onRequestPix={handlePixRecebimento}
        />
      )}

      {canReceivePayments && pixContext && (
        <PixPagamentoModal
          open
          onOpenChange={() => undefined}
          orderId={pixContext.orderId}
          orderNumber={pixContext.orderNumber}
          amount={pixContext.amount}
          cashRegisterId={pixContext.cashRegisterId}
          moment={pixContext.moment}
          idempotencyKey={pixContext.idempotencyKey}
          initialPix={pixContext.initialPix}
          initialError={pixContext.initialError}
          onFinished={handlePixFinished}
        />
      )}

      <ConsultarOSModal
        open={showHistoricoVendas}
        onOpenChange={setShowHistoricoVendas}
        recent
        onImprimirROL={osId => { void printROL(osId); }}
        onImprimirEtiquetas={osId => { void printEtiqueta(osId); }}
      />

      {canManageContracts && selectedClient && <Dialog open={showContracts} onOpenChange={setShowContracts}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Contrato · {selectedClient.nome_fantasia || selectedClient.razao_social}</DialogTitle>
            <DialogDescription>Setor {areaLabel} · Contrato do cliente selecionado.</DialogDescription>
          </DialogHeader>
          {showContracts && <ClienteContrato clienteId={selectedClient.id} />}
        </DialogContent>
      </Dialog>}

      {/* Modal Ajuda Atalhos */}
      <AjudaAtalhosModal
        open={showAjudaAtalhos}
        onOpenChange={setShowAjudaAtalhos}
      />
    </AppLayout>
  );
};

export default CaixaPDV;
