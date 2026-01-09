import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Produto {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
}

interface CartItem extends Produto {
  quantidade: number;
}

const mockProdutos: Produto[] = [
  { id: "1", nome: "CAPA DE ALMOFADA", preco: 5.0, unidade: "Pç" },
  { id: "2", nome: "COBERTOR", preco: 25.0, unidade: "Pç" },
  { id: "3", nome: "COBERTOR / EDREDON", preco: 25.0, unidade: "Pç" },
  { id: "4", nome: "EDREDON", preco: 25.0, unidade: "Pç" },
  { id: "5", nome: "FRONHA", preco: 3.5, unidade: "Pç" },
  { id: "6", nome: "FRONHA COM DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "7", nome: "LENÇOL", preco: 4.8, unidade: "Pç" },
  { id: "8", nome: "LENÇOL - DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "9", nome: "PISO - DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "10", nome: "ROUPÃO", preco: 4.5, unidade: "Pç" },
  { id: "11", nome: "ROUPÃO - DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "12", nome: "TAPETE", preco: 25.0, unidade: "Metro" },
  { id: "13", nome: "TOALHA", preco: 10.0, unidade: "Pç" },
  { id: "14", nome: "TOALHA BANHO", preco: 4.5, unidade: "Pç" },
  { id: "15", nome: "TOALHA DE BANHO - DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "16", nome: "TOALHA DE PISCINA", preco: 4.5, unidade: "Pç" },
  { id: "17", nome: "TOALHA DE PISCINA - DEFEITO", preco: 0.0, unidade: "Pç" },
  { id: "18", nome: "TOALHA DE PISO", preco: 3.5, unidade: "Pç" },
  { id: "19", nome: "TOALHA DE ROSTO", preco: 3.5, unidade: "Pç" },
  { id: "20", nome: "TOALHA DE ROSTO - DEFEITO", preco: 0.0, unidade: "Pç" },
];

const alphabet = ["TODOS", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];

const CaixaPDV = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("TODOS");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState("");

  const filteredProdutos = mockProdutos.filter((produto) => {
    const matchesSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLetter = selectedLetter === "TODOS" || produto.nome.startsWith(selectedLetter);
    return matchesSearch && matchesLetter;
  });

  const addToCart = (produto: Produto) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === produto.id);
      if (existing) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        );
      }
      return [...prev, { ...produto, quantidade: 1 }];
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
              placeholder="Buscar produto..."
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
            <div className="grid grid-cols-3 gap-3">
              {filteredProdutos.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => addToCart(produto)}
                  className="bg-card border rounded-lg p-3 text-left hover:shadow-md hover:border-primary transition-all"
                >
                  <h3 className="font-semibold text-sm text-foreground mb-1 line-clamp-2">
                    {produto.nome}
                  </h3>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-primary currency">
                      R$ {produto.preco.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="text-xs text-muted-foreground">{produto.unidade}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Cart */}
        <div className="w-80 flex flex-col bg-card border rounded-lg overflow-hidden">
          {/* Client Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente (nome, CPF/CNPJ, telefone)..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
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
              <span className="text-2xl font-bold text-success currency">
                R$ {totalValue.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={cart.length === 0}
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
