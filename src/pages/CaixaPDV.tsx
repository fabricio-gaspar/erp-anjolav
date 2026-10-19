import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { HistoricoVendasModal } from "@/components/caixa/HistoricoVendasModal";
import { AjudaAtalhosModal } from "@/components/caixa/AjudaAtalhosModal";
import { ClientePagamentoDialog } from "@/components/caixa/ClientePagamentoDialog";
import { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintOS } from "@/hooks/usePrintOS";
import { useCreatePdvSale, usePdvCustomerLoyaltySummary, useRedeemPdvLoyalty } from "@/hooks/usePdvPayments";
import { createPdvIdempotencyKey, type PdvPixPayment } from "@/lib/pdvPayment";

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

const CaixaPDV = () => {
  const navigate = useNavigate();
  const { produtos, isLoading: isLoadingProdutos } = useProdutos();
  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { data: caixaAberto, isLoading: isLoadingCaixa } = useCaixaAberto();
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
  
  // Estados para modais de caixa
  const [showAbrirCaixaModal, setShowAbrirCaixaModal] = useState(false);
  const [showFecharCaixaModal, setShowFecharCaixaModal] = useState(false);
  const [showSangriaModal, setShowSangriaModal] = useState(false);
  const [showSuprimentoModal, setShowSuprimentoModal] = useState(false);
  const [showConsultarOSModal, setShowConsultarOSModal] = useState(false);
  const [showReceberPagamentoModal, setShowReceberPagamentoModal] = useState(false);
  const [osParaReceber, setOsParaReceber] = useState<OrdemServicoConsulta | null>(null);
  
  // Novos estados para funcionalidades profissionais
  const [showHistoricoVendas, setShowHistoricoVendas] = useState(false);
  const [showAjudaAtalhos, setShowAjudaAtalhos] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const { precos: precosEspeciais } = usePrecosEspeciais(selectedClientId);
  
  // Último cliente usado (persistido no localStorage)
  const [ultimoClienteId, setUltimoClienteId] = useState<string | null>(() => {
    return localStorage.getItem("pdv_ultimo_cliente");
  });

  const selectedClient = useMemo(() => {
    return clientes.find(c => c.id === selectedClientId);
  }, [clientes, selectedClientId]);
  const { configuracao: configuracaoPagamento } = useConfiguracaoPagamentoCliente(selectedClientId);
  const { data: customerLoyalty, isLoading: isLoadingCustomerLoyalty } = usePdvCustomerLoyaltySummary(selectedClientId);

  // Filter only active products with ID2 (Residencial) or ambos
  const produtosAtivos = useMemo(() => {
    return produtos.filter(p => 
      p.status === "ativo" && 
      (p.unidade_negocio === "ID2" || p.unidade_negocio === "ambos" || !p.unidade_negocio)
    );
  }, [produtos]);

  // Filter only residential clients for PDV
  const clientesFiltradosPorTipo = useMemo(() => {
    return clientes.filter(c => c.classificacao === "residencial");
  }, [clientes]);

  // Get price for product (special price or default)
  const getPrecoForProduto = useCallback((produto: Produto): number => {
    if (selectedClient?.tabela_preco_tipo === "personalizada" && precosEspeciais.length > 0) {
      const precoEspecial = precosEspeciais.find(
        (pe) => pe.produto_id === produto.id
      );
      if (precoEspecial) {
        return precoEspecial.preco_especial;
      }
    }
    return produto.preco;
  }, [precosEspeciais, selectedClient]);

  const filteredProdutos = useMemo(() => {
    return produtosAtivos.filter((produto) => {
      const matchesSearch = 
        produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [produtosAtivos, searchTerm]);

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
    if (!caixaAberto) {
      toast.error("Abra o caixa para iniciar vendas");
      return;
    }
    
    const preco = getPrecoForProduto(produto);
    setCart((prev) => {
      const existing = prev.find((item) => item.id === produto.id);
      if (existing) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
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
  }, [caixaAberto, getPrecoForProduto]);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantidade: Math.max(0, item.quantidade + delta) }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );
  }, []);

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

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
    setSelectedClientId(clientId);
    setShowClientList(false);
    setClientSearch("");
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;

    // Recalcula somente quando os preços do cliente selecionado estiverem disponíveis.
    setCart(prev => prev.map(item => {
      const produto = produtos.find(p => p.id === item.id);
      if (produto) {
        const newPrice = getPrecoForProduto(produto);
        return { ...item, preco: newPrice };
      }
      return item;
    }));
  }, [getPrecoForProduto, produtos, selectedClientId]);

  const clearClient = () => {
    setSelectedClientId(null);
    setClientSearch("");
    // Reset to original prices
    setCart(prev => prev.map(item => ({
      ...item,
      preco: item.precoOriginal
    })));
  };

  // Função para abrir modal de pagamento
  const handleOpenPagamento = useCallback(() => {
    if (!caixaAberto) {
      toast.error("Abra o caixa primeiro");
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
    saleIdempotencyRef.current = createPdvIdempotencyKey("sale");
    setShowPagamentoModal(true);
  }, [caixaAberto, cart.length, selectedClientId]);

  const handleOpenClientePagamento = useCallback(() => {
    if (!selectedClientId) {
      toast.error("Selecione um cliente para configurar o pagamento");
      return;
    }
    setShowClientePagamentoDialog(true);
  }, [selectedClientId]);

  const handleEditClientePagamento = useCallback(() => {
    setShowPagamentoModal(false);
    handleOpenClientePagamento();
  }, [handleOpenClientePagamento]);

  // Função para finalizar venda
  const handleFinalizarVenda = async (dados: DadosPagamento) => {
    if (!selectedClientId || !caixaAberto) return;
    
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
        cashRegisterId: caixaAberto.id,
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
      if (dados.pagoAgora && dados.formaPagamento === "FIDELIDADE" && dados.pontosResgate) {
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
      if (dados.pagoAgora && dados.formaPagamento === "PIX") {
        if (result.pixError) toast.error(result.pixError);
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
      setIsProcessingVenda(false);
    }
  };

  // Função após impressão (ou pular)
  const handleImpressaoComplete = () => {
    // Salvar último cliente usado
    if (selectedClientId) {
      localStorage.setItem("pdv_ultimo_cliente", selectedClientId);
      setUltimoClienteId(selectedClientId);
    }
    setOsRecemCriada(null);
    saleIdempotencyRef.current = null;
    setCart([]);
    setSelectedClientId(null);
    setClientSearch("");
    toast.success("Venda finalizada com sucesso!");
  };

  const handlePixRecebimento = (request: PixRecebimentoRequest) => {
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
      if (showPagamentoModal || showConsultarOSModal || showAjudaAtalhos) return;
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
            const produto = produtos.find((p) => p.codigo === nextBuffer);
            if (produto) {
              addToCart(produto);
              toast.success(`${produto.nome} adicionado`);
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
  }, [addToCart, produtos, showPagamentoModal, showConsultarOSModal, showAjudaAtalhos]);

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
    if (ultimoClienteId) {
      selectClient(ultimoClienteId);
      toast.success("Último cliente selecionado");
    } else {
      toast.info("Nenhum cliente anterior disponível");
    }
  }, [ultimoClienteId, selectClient]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignorar se está digitando em um input (exceto para F-keys)
    const isTyping = document.activeElement?.tagName === "INPUT" || 
                     document.activeElement?.tagName === "TEXTAREA";
    
    // F1 - Ajuda
    if (e.key === "F1") {
      e.preventDefault();
      setShowAjudaAtalhos(true);
    }
    // F2 - Foco no cliente
    if (e.key === "F2") {
      e.preventDefault();
      clientSearchRef.current?.focus();
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
      setShowConsultarOSModal(true);
    }
    // F6 - Histórico de vendas
    if (e.key === "F6") {
      e.preventDefault();
      if (caixaAberto) {
        setShowHistoricoVendas(true);
      } else {
        toast.error("Abra o caixa para ver o histórico");
      }
    }
    // F7 - Sangria/Suprimento (abre sangria por padrão)
    if (e.key === "F7") {
      e.preventDefault();
      if (caixaAberto) {
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
      if (caixaAberto) {
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
      if (showConsultarOSModal) setShowConsultarOSModal(false);
      if (showHistoricoVendas) setShowHistoricoVendas(false);
      if (showAjudaAtalhos) setShowAjudaAtalhos(false);
      if (showOperations) setShowOperations(false);
    }
  }, [
    caixaAberto,
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

  return (
    <AppLayout title="Caixa PDV">
      <section className="mx-auto flex w-full max-w-[1560px] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg md:h-[calc(100vh-118px)]">
        <header className="grid min-h-14 grid-cols-[1fr_auto_1fr] items-center border-b bg-card px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-primary" />
            <span className="hidden sm:inline capitalize">{today}</span>
            <span>{format(currentTime, "HH:mm")}</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold tracking-wide sm:text-base">
              Atendente: {caixaAberto?.operador || "—"}
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <p className="hidden text-sm font-black uppercase tracking-[0.14em] sm:block">Caixa vendas</p>
            {isLoadingCaixa ? (
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

        <div className="border-b border-primary/40 bg-primary px-4 py-3 text-primary-foreground sm:px-6">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-primary-foreground/70">Item atual</p>
          <p className="truncate text-center text-2xl font-semibold tracking-[0.08em] sm:text-4xl">
            {currentItem?.nome || "Aguardando produto ou serviço"}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[304px_minmax(0,1fr)]">
          <aside className="relative border-b bg-muted/20 p-3 lg:border-b-0 lg:border-r sm:p-4">
            {!isLoadingCaixa && !caixaAberto && (
              <div className="mb-3 flex items-center gap-2 border border-warning/40 bg-warning/10 px-2.5 py-2 text-xs text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Abra o caixa para lançar itens.
              </div>
            )}

            <div className="relative">
              <label htmlFor="pdv-product-search" className="mb-1 block text-sm font-bold">Código / produto</label>
              <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="pdv-product-search"
                ref={searchInputRef}
                placeholder="Buscar produto ou serviço..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setShowProductList(true);
                }}
                onFocus={() => setShowProductList(true)}
                className="h-10 pl-9 pr-3"
              />
              {showProductList && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto border bg-card shadow-xl">
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
                          disabled={!caixaAberto}
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <p className="mb-1 text-sm font-bold">Quantidade</p>
                <div className="flex h-10 items-center border bg-background">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full w-10 rounded-none"
                    disabled={!currentItem}
                    onClick={() => currentItem && updateQuantity(currentItem.id, -1)}
                    aria-label="Diminuir quantidade do item atual"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="flex-1 text-center text-xl font-semibold tabular-nums">{currentItem?.quantidade ?? 0}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-full w-10 rounded-none"
                    disabled={!currentItem || !caixaAberto}
                    onClick={() => currentItem && updateQuantity(currentItem.id, 1)}
                    aria-label="Aumentar quantidade do item atual"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-bold">Preço</p>
                <div className="flex h-10 items-center justify-end border bg-background px-3 text-lg font-semibold tabular-nums">
                  {formatCurrency(currentItem?.preco ?? 0)}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-bold">Subtotal</p>
                <div className="flex h-10 items-center justify-end border bg-background px-3 text-lg font-semibold tabular-nums">
                  {formatCurrency(currentItem ? currentItem.preco * currentItem.quantidade : 0)}
                </div>
              </div>
            </div>

            <div className="relative mt-4 border-t pt-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="pdv-client-search" className="flex items-center gap-1 text-sm font-bold">
                  <UserRound className="h-4 w-4 text-primary" /> Cliente
                </label>
                <span className="text-[10px] text-muted-foreground">F2</span>
              </div>
              {selectedClient ? (
                <div className="border bg-primary/5 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-primary">{selectedClient.nome_fantasia || selectedClient.razao_social}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient.cpf_cnpj}</p>
                      {isLoadingCustomerLoyalty ? (
                        <p className="mt-1 text-xs text-muted-foreground">Consultando pontos...</p>
                      ) : customerLoyalty?.programaAtivo ? (
                        <p className="mt-1 text-xs text-primary">{customerLoyalty.saldoPontos} pontos · {formatCurrency(customerLoyalty.valorSaldo)}</p>
                      ) : null}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={clearClient} title="Trocar cliente">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-2 h-7 w-full gap-1 text-xs" onClick={handleOpenClientePagamento}>
                    <Settings2 className="h-3.5 w-3.5" />
                    {configuracaoPagamento ? "Editar pagamento" : "Configurar pagamento"}
                  </Button>
                </div>
              ) : (
                <>
                  <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-muted-foreground" />
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
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto border bg-card shadow-xl">
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
                </>
              )}
            </div>
          </aside>

          <section className="flex min-h-[360px] min-w-0 flex-col">
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
              <p className="text-base font-bold">Itens:</p>
              <p className="text-xs text-muted-foreground">{cart.length} produtos · {totalItems} unidades</p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[620px] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-muted/60 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 border-b px-3 py-2 text-center">Item</th>
                    <th className="border-b px-3 py-2">Descrição</th>
                    <th className="w-28 border-b px-3 py-2 text-right">Preço</th>
                    <th className="w-36 border-b px-3 py-2 text-center">Quantidade</th>
                    <th className="w-32 border-b px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="h-56 px-4 text-center text-muted-foreground">
                        <ShoppingCart className="mx-auto mb-3 h-10 w-10 opacity-30" />
                        <p className="font-medium">Nenhum item lançado</p>
                        <p className="mt-1 text-xs">Pesquise pelo código ou nome do produto para iniciar a venda.</p>
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, index) => {
                      const temDetalhes = hasItemDetalhes(item);
                      return (
                        <tr key={item.id} className={cn("border-b align-top hover:bg-muted/30", item.avarias && "bg-warning/5")}>
                          <td className="px-3 py-3 text-center font-semibold text-muted-foreground">{index + 1}</td>
                          <td className="min-w-0 px-3 py-3">
                            <div className="flex items-start gap-1.5">
                              <p className="min-w-0 flex-1 truncate font-semibold">{item.nome}</p>
                              {item.avarias ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{item.unidade}</span>
                              {temDetalhes ? <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-primary" />Detalhes</span> : null}
                              <button type="button" className="text-primary hover:underline" onClick={() => openDetalhesModal(item)}>Editar</button>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(item.preco)}</td>
                          <td className="px-3 py-2">
                            <div className="mx-auto flex w-fit items-center border bg-background">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, -1)} aria-label={`Diminuir ${item.nome}`}>
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-8 text-center font-semibold tabular-nums">{item.quantidade}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-none" onClick={() => updateQuantity(item.id, 1)} aria-label={`Aumentar ${item.nome}`}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-bold tabular-nums">{formatCurrency(item.preco * item.quantidade)}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.id)} title="Remover item">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="grid border-t bg-card lg:grid-cols-[304px_minmax(0,1fr)]">
          <div className="relative border-b p-2 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-5 gap-1">
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight text-destructive" disabled={cart.length === 0} onClick={clearCart}>
                <span className="flex flex-col items-center gap-1"><Trash2 className="h-4 w-4" />Cancelar<span>F8</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" onClick={() => { setShowProductList(true); searchInputRef.current?.focus(); }}>
                <span className="flex flex-col items-center gap-1"><ShoppingCart className="h-4 w-4" />Produtos<span>F3</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" onClick={() => clientSearchRef.current?.focus()}>
                <span className="flex flex-col items-center gap-1"><UserRound className="h-4 w-4" />Cliente<span>F2</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" disabled={!currentItem} onClick={() => currentItem && openDetalhesModal(currentItem)}>
                <span className="flex flex-col items-center gap-1"><FileText className="h-4 w-4" />Detalhes<span>Item</span></span>
              </Button>
              <Button type="button" className="h-14 rounded-sm px-1 text-[10px] leading-tight" disabled={cart.length === 0 || !caixaAberto} onClick={handleOpenPagamento}>
                <span className="flex flex-col items-center gap-1"><CreditCard className="h-4 w-4" />Pagamento<span>F4</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" disabled={!caixaAberto} onClick={() => setShowConsultarOSModal(true)}>
                <span className="flex flex-col items-center gap-1"><FileSearch className="h-4 w-4" />Consultar<span>F5</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight text-warning" disabled={!caixaAberto} onClick={() => setShowSangriaModal(true)}>
                <span className="flex flex-col items-center gap-1"><ArrowDownCircle className="h-4 w-4" />Sangria<span>F7</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight text-success" disabled={!caixaAberto} onClick={() => setShowSuprimentoModal(true)}>
                <span className="flex flex-col items-center gap-1"><ArrowUpCircle className="h-4 w-4" />Suprimento<span>Caixa</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" disabled={!caixaAberto} onClick={() => setShowHistoricoVendas(true)}>
                <span className="flex flex-col items-center gap-1"><History className="h-4 w-4" />Histórico<span>F6</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-14 rounded-sm px-1 text-[10px] leading-tight" onClick={() => setShowOperations((open) => !open)} aria-expanded={showOperations}>
                <span className="flex flex-col items-center gap-1"><Settings2 className="h-4 w-4" />Mais<span>Ações</span></span>
              </Button>
            </div>
            {showOperations && (
              <div className="absolute bottom-full left-2 right-2 z-40 mb-2 grid grid-cols-2 gap-1 border bg-card p-2 shadow-xl">
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" disabled={!caixaAberto} onClick={() => setShowFecharCaixaModal(true)}>
                  <Lock className="h-4 w-4" /> Fechar caixa
                </Button>
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" disabled={!caixaAberto} onClick={() => navigate("/relatorios/caixa")}>
                  <BarChart3 className="h-4 w-4" /> Relatórios
                </Button>
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" onClick={() => setShowAjudaAtalhos(true)}>
                  <Keyboard className="h-4 w-4" /> Atalhos
                </Button>
                <Button type="button" variant="outline" size="sm" className="justify-start gap-2" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 p-3 sm:px-5">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Itens: {totalItems} · Produtos: {cart.length}</p>
              <p className="mt-1 text-2xl font-black uppercase sm:text-3xl">Total:</p>
            </div>
            <div className="min-w-[190px] bg-primary px-4 py-2 text-right text-3xl font-black tabular-nums text-primary-foreground sm:min-w-[270px] sm:text-5xl">
              {formatCurrency(totalValue)}
            </div>
          </div>
        </footer>
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
        loyalty={customerLoyalty ?? null}
        loyaltyLoading={isLoadingCustomerLoyalty}
        configuracaoPagamento={configuracaoPagamento ?? null}
        onEditConfiguracaoPagamento={handleEditClientePagamento}
        onConfirm={handleFinalizarVenda}
        isLoading={isProcessingVenda}
      />

      <ClientePagamentoDialog
        open={showClientePagamentoDialog}
        onOpenChange={setShowClientePagamentoDialog}
        clienteId={selectedClientId}
      />

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
      <AbrirCaixaModal
        open={showAbrirCaixaModal}
        onOpenChange={setShowAbrirCaixaModal}
      />

      {caixaAberto && (
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
        onOpenChange={setShowConsultarOSModal}
        onReceberPagamento={(ordem) => {
          setOsParaReceber(ordem);
          setShowReceberPagamentoModal(true);
        }}
        onImprimirROL={(osId) => {
          void printROL(osId);
        }}
        onImprimirEtiquetas={(osId) => {
          void printEtiqueta(osId);
        }}
      />

      {/* Modal Receber Pagamento */}
      {osParaReceber && (
        <ReceberPagamentoModal
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

      {pixContext && (
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

      {/* Modal Histórico de Vendas */}
      {caixaAberto && (
        <HistoricoVendasModal
          open={showHistoricoVendas}
          onOpenChange={setShowHistoricoVendas}
          caixaId={caixaAberto.id}
          onImprimirROL={(osId) => {
            void printROL(osId);
          }}
          onImprimirEtiquetas={(osId) => {
            void printEtiqueta(osId);
          }}
        />
      )}

      {/* Modal Ajuda Atalhos */}
      <AjudaAtalhosModal
        open={showAjudaAtalhos}
        onOpenChange={setShowAjudaAtalhos}
      />
    </AppLayout>
  );
};

export default CaixaPDV;
