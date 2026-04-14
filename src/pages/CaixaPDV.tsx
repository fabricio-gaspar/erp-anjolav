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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes } from "@/hooks/useClientes";
import { useCaixaAberto, useAddMovimentacao } from "@/hooks/useCaixa";
import { useOrdensServico, useItensOrdemServico } from "@/hooks/useOrdensServico";
import { ItemDetalhesModal } from "@/components/caixa/ItemDetalhesModal";
import { PagamentoModal, DadosPagamento } from "@/components/caixa/PagamentoModal";
import { ImpressaoPosVendaModal } from "@/components/caixa/ImpressaoPosVendaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { SangriaModal } from "@/components/caixa/SangriaModal";
import { SuprimentoModal } from "@/components/caixa/SuprimentoModal";
import { ConsultarOSModal } from "@/components/caixa/ConsultarOSModal";
import { ReceberPagamentoModal } from "@/components/caixa/ReceberPagamentoModal";
import { HistoricoVendasModal } from "@/components/caixa/HistoricoVendasModal";
import { AjudaAtalhosModal } from "@/components/caixa/AjudaAtalhosModal";
import { OrdemServicoConsulta } from "@/hooks/useConsultaOS";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const alphabet = ["TODOS", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const CaixaPDV = () => {
  const navigate = useNavigate();
  const { produtos, isLoading: isLoadingProdutos } = useProdutos();
  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { data: caixaAberto, isLoading: isLoadingCaixa } = useCaixaAberto();
  const { createOrdemServico } = useOrdensServico();
  const { addItem } = useItensOrdemServico(null);
  const addMovimentacao = useAddMovimentacao();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clientSearchRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientList, setShowClientList] = useState(false);
  
  // Estado para modal de detalhes
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [selectedCartItem, setSelectedCartItem] = useState<CartItem | null>(null);
  
  // Estados para modais de pagamento e impressão
  const [showPagamentoModal, setShowPagamentoModal] = useState(false);
  const [showImpressaoModal, setShowImpressaoModal] = useState(false);
  const [osRecemCriada, setOsRecemCriada] = useState<OSRecemCriada | null>(null);
  const [isProcessingVenda, setIsProcessingVenda] = useState(false);
  
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const { precos: precosEspeciais } = usePrecosEspeciais(selectedClientId);
  
  // Último cliente usado (persistido no localStorage)
  const [ultimoClienteId, setUltimoClienteId] = useState<string | null>(() => {
    return localStorage.getItem("pdv_ultimo_cliente");
  });

  const selectedClient = useMemo(() => {
    return clientes.find(c => c.id === selectedClientId);
  }, [clientes, selectedClientId]);

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
  const getPrecoForProduto = (produto: Produto): number => {
    if (selectedClientId && precosEspeciais.length > 0) {
      const precoEspecial = precosEspeciais.find(
        (pe: any) => pe.produto_id === produto.id
      );
      if (precoEspecial) {
        return precoEspecial.preco_especial;
      }
    }
    return produto.preco;
  };

  const filteredProdutos = useMemo(() => {
    return produtosAtivos.filter((produto) => {
      const matchesSearch = 
        produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        produto.codigo?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLetter = selectedLetter === "TODOS" || produto.nome.toUpperCase().startsWith(selectedLetter);
      return matchesSearch && matchesLetter;
    });
  }, [produtosAtivos, searchTerm, selectedLetter]);

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

  const getUnidadeLabel = (unidade: string | null) => {
    switch (unidade) {
      case "kg": return "Kg";
      case "peca": return "Pç";
      case "metro": return "Mt";
      case "unidade": return "Un";
      default: return "Pç";
    }
  };

  const addToCart = (produto: Produto) => {
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
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantidade: Math.max(0, item.quantidade + delta) }
            : item
        )
        .filter((item) => item.quantidade > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
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

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setShowClientList(false);
    setClientSearch("");
    // Recalculate cart prices when client changes
    setCart(prev => prev.map(item => {
      const produto = produtos.find(p => p.id === item.id);
      if (produto) {
        const newPrice = getPrecoForProduto(produto);
        return { ...item, preco: newPrice };
      }
      return item;
    }));
  };

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
  const handleOpenPagamento = () => {
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
    setShowPagamentoModal(true);
  };

  // Função para finalizar venda
  const handleFinalizarVenda = async (dados: DadosPagamento) => {
    if (!selectedClientId || !caixaAberto) return;
    
    setIsProcessingVenda(true);
    
    try {
      // 1. Criar a OS
      const os = await createOrdemServico.mutateAsync({
        cliente_id: selectedClientId,
        data_retirada: new Date().toISOString().split('T')[0],
        data_previsao_entrega: dados.previsaoEntrega.toISOString().split('T')[0],
        data_entrega: null,
        status: "retirada",
        prioridade: dados.urgente ? "urgente" : "normal",
        observacoes: null,
        motorista_id: null,
        veiculo_id: null,
        valor_total: dados.valorTotal,
        valor_desconto: dados.valorDesconto,
        forma_pagamento: dados.formaPagamento,
        status_pagamento: dados.pagoAgora ? "pago" : "pendente",
        pago_na_entrada: dados.pagoAgora,
        valor_pago: dados.pagoAgora ? dados.valorTotal : 0,
        urgente: dados.urgente,
        percentual_urgencia: dados.percentualUrgencia,
      });

      // 2. Inserir todos os itens
      for (const item of cart) {
        await addItem.mutateAsync({
          ordem_servico_id: os.id,
          produto_id: item.id,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          subtotal: item.preco * item.quantidade,
          cor_item: item.cor_item || null,
          marca_item: item.marca_item || null,
          avarias: item.avarias || null,
          posicao_prateleira: item.posicao_prateleira || null,
          observacoes: item.observacoes || null,
        });
      }

      // 3. Registrar movimentação no caixa (se pago agora)
      if (dados.pagoAgora && dados.formaPagamento) {
        await addMovimentacao.mutateAsync({
          caixa_id: caixaAberto.id,
          tipo: "VENDA",
          valor: dados.valorTotal,
          forma_pagamento: dados.formaPagamento,
          descricao: `Venda OS ${os.numero}`,
        });
      }

      // 4. Preparar dados para modal de impressão
      setOsRecemCriada({
        id: os.id,
        numero: os.numero,
        valorTotal: dados.valorTotal,
        previsaoEntrega: dados.previsaoEntrega,
      });

      // 5. Fechar modal de pagamento e abrir modal de impressão
      setShowPagamentoModal(false);
      setShowImpressaoModal(true);
      
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);
      toast.error("Erro ao finalizar venda");
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
    setCart([]);
    setSelectedClientId(null);
    setClientSearch("");
    toast.success("Venda finalizada com sucesso!");
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
        setBarcodeBuffer((prev) => prev + e.key);
        clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = setTimeout(() => {
          if (barcodeBuffer.length >= 3) {
            const produto = produtos.find((p) => p.codigo === barcodeBuffer);
            if (produto) {
              addToCart(produto);
              toast.success(`${produto.nome} adicionado`);
            } else {
              toast.error(`Produto não encontrado: ${barcodeBuffer}`);
            }
          }
          setBarcodeBuffer("");
        }, 150);
      }
    };

    window.addEventListener("keypress", handleBarcodeInput);
    return () => window.removeEventListener("keypress", handleBarcodeInput);
  }, [barcodeBuffer, produtos, showPagamentoModal, showConsultarOSModal, showAjudaAtalhos]);

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
  const useLastClient = useCallback(() => {
    if (ultimoClienteId) {
      selectClient(ultimoClienteId);
      toast.success("Último cliente selecionado");
    } else {
      toast.info("Nenhum cliente anterior disponível");
    }
  }, [ultimoClienteId]);

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
      useLastClient();
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
    }
  }, [cart, selectedClientId, caixaAberto, showPagamentoModal, showConsultarOSModal, showHistoricoVendas, showAjudaAtalhos, toggleFullscreen, useLastClient]);

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
    <AppLayout title="Dashboard">
      <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* PDV Header */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">A</span>
                </div>
                <div>
                  <h2 className="font-semibold text-primary">Caixa PDV</h2>
                  <p className="text-xs text-muted-foreground capitalize">{today}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isLoadingCaixa ? (
                  <Badge variant="outline" className="gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Carregando...
                  </Badge>
                ) : caixaAberto ? (
                  <>
                    <Badge variant="outline" className="border-success text-success gap-1">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      Caixa Aberto
                    </Badge>
                    <span className="text-sm text-muted-foreground hidden sm:inline">| {caixaAberto.operador}</span>
                    <div className="bg-success text-success-foreground px-3 py-1 rounded-lg">
                      <span className="text-xs">Vendas Hoje</span>
                      <p className="font-bold">{formatCurrency(caixaAberto.valor_vendas)}</p>
                    </div>
                  </>
                ) : (
                  <Badge variant="outline" className="border-destructive text-destructive gap-1">
                    <span className="w-2 h-2 rounded-full bg-destructive" />
                    Caixa Fechado
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {caixaAberto ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => setShowConsultarOSModal(true)}
                  >
                    <FileSearch className="w-4 h-4" />
                    <span className="hidden sm:inline">Consultar OS (F5)</span>
                    <span className="sm:hidden">OS</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-warning border-warning"
                    onClick={() => setShowSangriaModal(true)}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Sangria</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-success border-success"
                    onClick={() => setShowSuprimentoModal(true)}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Suprimento</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-destructive border-destructive"
                    onClick={() => setShowFecharCaixaModal(true)}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="hidden sm:inline">Fechar Caixa</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1"
                    onClick={() => navigate("/relatorios/caixa")}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Relatórios</span>
                  </Button>
                </>
              ) : (
                <Button 
                  size="sm" 
                  className="gap-1"
                  onClick={() => setShowAbrirCaixaModal(true)}
                >
                  <DoorOpen className="w-4 h-4" />
                  Abrir Caixa
                </Button>
              )}
            </div>
          </div>

          {/* Aviso de caixa fechado */}
          {!isLoadingCaixa && !caixaAberto && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-warning" />
                <div>
                  <p className="font-medium text-warning">Caixa Fechado</p>
                  <p className="text-sm text-muted-foreground">Abra o caixa para iniciar as vendas do dia</p>
                </div>
              </div>
              <Button onClick={() => setShowAbrirCaixaModal(true)}>
                <DoorOpen className="w-4 h-4 mr-2" />
                Abrir Caixa
              </Button>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Alphabet Filter */}
          <div className="flex gap-0.5 flex-wrap mb-4">
            {alphabet.map((letter) => (
              <button
                key={letter}
                onClick={() => setSelectedLetter(letter)}
                className={cn(
                  "min-w-[28px] h-6 px-1 rounded text-xs font-medium transition-colors",
                  selectedLetter === letter
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto">
            {isLoadingProdutos ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando produtos...</span>
              </div>
            ) : filteredProdutos.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhum produto encontrado
              </div>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-2">
                {filteredProdutos.map((produto) => {
                  const preco = getPrecoForProduto(produto);
                  const hasSpecialPrice = preco !== produto.preco;
                  
                  return (
                    <button
                      key={produto.id}
                      onClick={() => addToCart(produto)}
                      disabled={!caixaAberto}
                      className={cn(
                        "bg-card border rounded-lg p-2 text-left hover:shadow-md hover:border-primary transition-all relative aspect-square flex flex-col justify-between",
                        !caixaAberto && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {produto.codigo && (
                        <span className="absolute top-1 right-1 text-[10px] font-mono bg-muted px-1 rounded text-muted-foreground">
                          {produto.codigo}
                        </span>
                      )}
                      <h3 className="font-semibold text-xs text-foreground line-clamp-2 pr-8">
                        {produto.nome}
                      </h3>
                      <div>
                        <span className={cn(
                          "text-sm font-bold",
                          hasSpecialPrice ? "text-success" : "text-primary"
                        )}>
                          R$ {preco.toFixed(2).replace(".", ",")}
                        </span>
                        {hasSpecialPrice && (
                          <span className="text-[10px] text-muted-foreground line-through ml-1">
                            R$ {produto.preco.toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-full lg:w-96 flex flex-col bg-card border rounded-lg overflow-hidden lg:max-h-full max-h-[50vh]">
          {/* Client Search */}
          <div className="p-4 border-b relative">
            {selectedClient ? (
              <div className="flex items-center justify-between bg-primary/10 rounded-lg p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {selectedClient.nome_fantasia || selectedClient.razao_social}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedClient.cpf_cnpj}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={clearClient}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente (nome, CPF/CNPJ, telefone)..."
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientList(true);
                  }}
                  onFocus={() => setShowClientList(true)}
                  className="pl-9 text-sm"
                />
                
                {/* Client Dropdown */}
                {showClientList && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {isLoadingClientes ? (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        Carregando...
                      </div>
                    ) : filteredClientes.length === 0 ? (
                      <div className="p-3 text-center text-muted-foreground text-sm">
                        Nenhum cliente encontrado
                      </div>
                    ) : (
                      filteredClientes.map(cliente => (
                        <button
                          key={cliente.id}
                          onClick={() => selectClient(cliente.id)}
                          className="w-full p-2 text-left hover:bg-muted transition-colors border-b last:border-b-0"
                        >
                          <p className="text-sm font-medium truncate">
                            {cliente.nome_fantasia || cliente.razao_social}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {cliente.cpf_cnpj} • {cliente.telefone}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
                <p className="font-medium">Carrinho vazio</p>
                <p className="text-xs">Adicione produtos para iniciar a venda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => {
                  const temDetalhes = hasItemDetalhes(item);
                  const temAvarias = !!item.avarias;
                  
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        temAvarias 
                          ? "bg-warning/10 border border-warning/30" 
                          : "bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.nome}
                            </p>
                            {temDetalhes && (
                              <FileText className="w-3 h-3 text-primary flex-shrink-0" />
                            )}
                            {temAvarias && (
                              <AlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            R$ {item.preco.toFixed(2)} × {item.quantidade}
                          </p>
                          {/* Resumo de detalhes */}
                          {temDetalhes && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.cor_item && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 rounded">
                                  🎨 {item.cor_item}
                                </span>
                              )}
                              {item.posicao_prateleira && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded">
                                  📍 {item.posicao_prateleira}
                                </span>
                              )}
                              {item.marca_item && (
                                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 rounded">
                                  🏷️ {item.marca_item}
                                </span>
                              )}
                              {item.avarias && (
                                <span className="text-[10px] bg-warning/20 text-warning px-1.5 rounded truncate max-w-[100px]">
                                  ⚠️ {item.avarias}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary"
                            onClick={() => openDetalhesModal(item)}
                            title="Detalhes do item"
                          >
                            <FileText className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {item.quantidade}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="p-4 border-t bg-muted/30">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>Itens: {totalItems}</span>
              <span>Qtd. Produtos: {cart.length}</span>
            </div>
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-lg font-semibold">TOTAL:</span>
              <span className="text-2xl font-bold text-success">
                R$ {totalValue.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="flex-1 max-w-[45%] text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancelar (F8)
              </Button>
              <Button
                className="flex-1 max-w-[45%] bg-primary hover:bg-primary/90"
                disabled={cart.length === 0 || !caixaAberto}
                onClick={handleOpenPagamento}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagamento (F4)
              </Button>
            </div>
          </div>
        </div>
      </div>

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
        onConfirm={handleFinalizarVenda}
        isLoading={isProcessingVenda}
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
          console.log("Imprimir ROL:", osId);
          toast.info("Função de impressão de ROL em desenvolvimento");
        }}
        onImprimirEtiquetas={(osId) => {
          console.log("Imprimir Etiquetas:", osId);
          toast.info("Função de impressão de etiquetas em desenvolvimento");
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
        />
      )}

      {/* Modal Histórico de Vendas */}
      {caixaAberto && (
        <HistoricoVendasModal
          open={showHistoricoVendas}
          onOpenChange={setShowHistoricoVendas}
          caixaId={caixaAberto.id}
          onImprimirROL={(osId) => {
            toast.info("Impressão ROL em desenvolvimento");
          }}
          onImprimirEtiquetas={(osId) => {
            toast.info("Impressão etiquetas em desenvolvimento");
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
