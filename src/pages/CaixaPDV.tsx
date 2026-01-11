import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  History,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProdutos, Produto } from "@/hooks/useProdutos";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useClientes } from "@/hooks/useClientes";

interface CartItem {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
  quantidade: number;
  precoOriginal: number;
}

const alphabet = ["TODOS", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const CaixaPDV = () => {
  const { produtos, isLoading: isLoadingProdutos } = useProdutos();
  const { clientes, isLoading: isLoadingClientes } = useClientes();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showClientList, setShowClientList] = useState(false);

  const { precos: precosEspeciais } = usePrecosEspeciais(selectedClientId);

  const selectedClient = useMemo(() => {
    return clientes.find(c => c.id === selectedClientId);
  }, [clientes, selectedClientId]);

  // Filter only active products
  const produtosAtivos = useMemo(() => {
    return produtos.filter(p => p.status === "ativo");
  }, [produtos]);

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
    if (!clientSearch) return clientes.slice(0, 10);
    const term = clientSearch.toLowerCase();
    return clientes.filter(c => 
      c.razao_social.toLowerCase().includes(term) ||
      c.nome_fantasia?.toLowerCase().includes(term) ||
      c.cpf_cnpj?.includes(term) ||
      c.telefone?.includes(term)
    ).slice(0, 10);
  }, [clientes, clientSearch]);

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

  const totalItems = cart.reduce((sum, item) => sum + item.quantidade, 0);
  const totalValue = cart.reduce((sum, item) => sum + item.preco * item.quantidade, 0);

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <AppLayout title="Dashboard">
      <div className="flex h-[calc(100vh-120px)] gap-4">
        {/* Left Panel - Products */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* PDV Header */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">A</span>
              </div>
              <div>
                <h2 className="font-semibold text-primary">Caixa PDV</h2>
                <p className="text-xs text-muted-foreground capitalize">{today}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-success text-success gap-1">
                <span className="w-2 h-2 rounded-full bg-success" />
                Caixa Aberto
              </Badge>
              <span className="text-sm text-muted-foreground">| Fabricio Gaspar</span>
              <div className="bg-success text-success-foreground px-3 py-1 rounded-lg">
                <span className="text-xs">Vendas Hoje</span>
                <p className="font-bold">R$ 0,00</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1">
                <History className="w-4 h-4" />
                Histórico (F5)
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-warning border-warning">
                <ArrowDownCircle className="w-4 h-4" />
                Sangria
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-success border-success">
                <ArrowUpCircle className="w-4 h-4" />
                Suprimento
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive">
                <Lock className="w-4 h-4" />
                Fechar Caixa
              </Button>
            </div>
          </div>

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
              <div className="grid grid-cols-3 gap-3">
                {filteredProdutos.map((produto) => {
                  const preco = getPrecoForProduto(produto);
                  const hasSpecialPrice = preco !== produto.preco;
                  
                  return (
                    <button
                      key={produto.id}
                      onClick={() => addToCart(produto)}
                      className="bg-card border rounded-lg p-3 text-left hover:shadow-md hover:border-primary transition-all relative"
                    >
                      {produto.codigo && (
                        <span className="absolute top-2 right-2 text-[10px] font-mono bg-muted px-1 rounded text-muted-foreground">
                          {produto.codigo}
                        </span>
                      )}
                      <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2 pr-12">
                        {produto.nome}
                      </h3>
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className={cn(
                            "text-lg font-bold",
                            hasSpecialPrice ? "text-success" : "text-primary"
                          )}>
                            R$ {preco.toFixed(2).replace(".", ",")}
                          </span>
                          {hasSpecialPrice && (
                            <span className="text-xs text-muted-foreground line-through ml-1">
                              R$ {produto.preco.toFixed(2).replace(".", ",")}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{getUnidadeLabel(produto.unidade)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-80 flex flex-col bg-card border rounded-lg overflow-hidden">
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
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {item.preco.toFixed(2)} × {item.quantidade}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
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
                ))}
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

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={cart.length === 0}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagamento (F4)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CaixaPDV;
