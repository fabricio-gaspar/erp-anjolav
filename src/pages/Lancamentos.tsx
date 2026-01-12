import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Plus,
  ShoppingCart,
  ArrowRight,
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
  Tag,
  Loader2,
  ChevronsUpDown,
  Package,
  AlertCircle,
  Scale,
  Boxes,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrintLancamento, type LancamentosPrintData } from "@/hooks/usePrintOS";
import { useClientes } from "@/hooks/useClientes";
import { usePrecosEspeciais } from "@/hooks/useProdutos";
import { useConferenciaProducao, type OSConferencia } from "@/hooks/useConferenciaProducao";
import { ConferenciaModal } from "@/components/lancamentos/ConferenciaModal";
import { useLancamentos, useCreateItemLancamento } from "@/hooks/useLancamentos";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

const periodOptions = ["Hoje", "Semana", "Quinzena", "Mês", "Personalizado"];

const Lancamentos = () => {
  const [items, setItems] = useState<LancamentoItem[]>([]);

  // Cliente selection state
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [clienteSearchOpen, setClienteSearchOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState("");

  // Produto selection state
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(null);
  const [produtoSearchOpen, setProdutoSearchOpen] = useState(false);
  const [quantidade, setQuantidade] = useState<number>(1);

  const [dataEmissao, setDataEmissao] = useState("2026-01-09");
  const [dataEntrega, setDataEntrega] = useState("2026-01-09");
  const [observacao, setObservacao] = useState("");
  
  // Conferência state
  const [selectedPeriod, setSelectedPeriod] = useState("Semana");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOS, setSelectedOS] = useState<OSConferencia | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isFinalizando, setIsFinalizando] = useState(false);
  
  const navigate = useNavigate();
  // Hooks for real data
  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { precos: precosEspeciais, isLoading: isLoadingPrecos } = usePrecosEspeciais(selectedClienteId);
  const { data: osConferencias, isLoading: isLoadingConferencias } = useConferenciaProducao(
    undefined,
    statusFilter !== "todos" ? statusFilter : undefined
  );

  // Print hook
  const { printROLFromData, printEtiquetaFromData, isLoading: isPrinting } = usePrintLancamento();

  // Lancamentos hooks
  const { createLancamento } = useLancamentos();
  const createItemLancamento = useCreateItemLancamento();

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

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
  }, [selectedClienteId]);

  // Handle add item
  const handleAdicionarItem = () => {
    if (!produtoSelecionado || quantidade <= 0) return;

    const novoItem: LancamentoItem = {
      id: crypto.randomUUID(),
      produto: produtoSelecionado.nome,
      quantidade: quantidade,
      unidade: produtoSelecionado.unidade,
      valorUnitario: produtoSelecionado.precoEspecial,
      valorTotal: produtoSelecionado.precoEspecial * quantidade,
    };

    setItems([...items, novoItem]);
    setSelectedProdutoId(null);
    setQuantidade(1);
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
    if (!osConferencias) return { pendente: 0, conferido: 0, divergencia: 0, lancado: 0 };
    return {
      pendente: osConferencias.filter((os) => os.statusConferencia === "pendente").length,
      conferido: osConferencias.filter((os) => os.statusConferencia === "conferido").length,
      divergencia: osConferencias.filter((os) => os.statusConferencia === "divergencia").length,
      lancado: osConferencias.filter((os) => os.statusConferencia === "lancado").length,
    };
  }, [osConferencias]);

  const handleOpenOSDetails = (os: OSConferencia) => {
    setSelectedOS(os);
    setModalOpen(true);
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

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
      // 1. Criar registro em lancamentos
      const lancamento = await createLancamento.mutateAsync({
        cliente_id: selectedClienteId,
        data_lancamento: dataEmissao,
        data_entrega: dataEntrega || null,
        observacao: observacao || null,
        valor_total: totalValue,
        status: "pendente",
      });

      // 2. Criar itens do lançamento
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

      // 3. Limpar formulário
      setItems([]);
      setSelectedClienteId(null);
      setObservacao("");
      
      toast.success("Lançamento registrado com sucesso!", {
        description: "Veja em Faturamento para processar a cobrança.",
        action: {
          label: "Ir para Faturamento",
          onClick: () => navigate("/faturamento"),
        },
      });
    } catch (error) {
      console.error("Erro ao finalizar lançamento:", error);
      toast.error("Erro ao finalizar lançamento");
    } finally {
      setIsFinalizando(false);
    }
  };

  return (
    <AppLayout title="Lançamentos" subtitle="Registre a produção diária por cliente">
      <div className="content-panel">
        <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-end">
          <Button variant="outline" className="gap-2">
            <ArrowRight className="w-4 h-4" />
            Ir para Faturamento
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="novo" className="w-full">
          <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
            <TabsTrigger
              value="novo"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <FileText className="w-4 h-4" />
              Novo Lançamento
            </TabsTrigger>
            <TabsTrigger
              value="conferencia"
              className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-3 px-1"
            >
              <ClipboardList className="w-4 h-4" />
              Conferência & Divergências
            </TabsTrigger>
          </TabsList>

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
                    <Label className="text-sm font-medium text-foreground">
                      Data de Emissão
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        type="date"
                        value={dataEmissao}
                        onChange={(e) => setDataEmissao(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Data de Entrega */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Data de Entrega
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        type="date"
                        value={dataEntrega}
                        onChange={(e) => setDataEntrega(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Observação / Informação
                    </Label>
                    <Input
                      placeholder="Ex: Entregar até sexta, Roupa de cama extra..."
                      className="mt-1.5"
                      value={observacao}
                      onChange={(e) => setObservacao(e.target.value)}
                    />
                  </div>

                  {/* Cliente */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Cliente
                    </Label>
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
                              <p className="font-medium text-foreground">
                                {clienteSelecionado.nome}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {clienteSelecionado.documento && `${clienteSelecionado.documento} • `}
                                {clienteSelecionado.telefone}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">
                              Buscar por nome, CNPJ, telefone...
                            </span>
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
                    <Label className="text-sm font-medium text-foreground">
                      Produto/Serviço
                    </Label>
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
                                <p className="font-medium text-foreground">
                                  {produtoSelecionado.nome}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(produtoSelecionado.precoEspecial)} / {produtoSelecionado.unidade}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Selecione o produto
                              </span>
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

                  {/* Quantidade */}
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

                  {/* Adicionar Item Button */}
                  <Button
                    className="w-full gap-2 mt-2"
                    onClick={handleAdicionarItem}
                    disabled={!produtoSelecionado || quantidade <= 0}
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
                    {/* Client Info */}
                    {clienteSelecionado && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {clienteSelecionado.nome}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(dataEmissao)}
                        </span>
                      </div>
                    )}

                    {/* Items List */}
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-3 border-b"
                        >
                          <div>
                            <p className="font-semibold text-foreground">
                              {item.produto}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantidade} {item.unidade} ×{" "}
                              {formatCurrency(item.valorUnitario)} ={" "}
                              <span className="font-medium text-foreground">
                                {formatCurrency(item.valorTotal)}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Total Card */}
                    <Card className="bg-success/10 border-success/20 p-4 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          Valor Total:
                        </span>
                        <span className="text-xl font-bold text-success">
                          {formatCurrency(totalValue)}
                        </span>
                      </div>
                    </Card>

                    {/* Action Buttons */}
                    <div className="space-y-3 mt-4">
                      <Button
                        variant="outline"
                        className="w-full gap-2 bg-violet-500 hover:bg-violet-600 text-white border-violet-500 hover:border-violet-600"
                        onClick={handlePrintROL}
                        disabled={isPrinting || items.length === 0}
                      >
                        {isPrinting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                        Imprimir ROL
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white border-amber-500 hover:border-amber-600"
                        disabled={isPrinting || items.length === 0}
                        onClick={handlePrintEtiqueta}
                      >
                        {isPrinting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Tag className="w-4 h-4" />
                        )}
                        Imprimir Etiqueta
                      </Button>

                      <Button 
                        className="w-full gap-2 bg-success hover:bg-success/90"
                        onClick={handleFinalizarLancamento}
                        disabled={items.length === 0 || isFinalizando}
                      >
                        {isFinalizando ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Finalizar Lançamento
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conferencia" className="mt-4">
            <div className="space-y-4">
              {/* Filters Section */}
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Period Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Período:</span>
                  </div>
                  <div className="flex gap-1">
                    {periodOptions.map((period) => (
                      <Button
                        key={period}
                        variant={selectedPeriod === period ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedPeriod(period)}
                      >
                        {period}
                      </Button>
                    ))}
                  </div>

                  {/* Date Navigation */}
                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">janeiro de 2026</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Second Row Filters */}
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="conferido">Conferido</SelectItem>
                        <SelectItem value="divergencia">Divergência</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 max-w-sm">
                    <Input
                      placeholder="Buscar por cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {conferenciasCounts.pendente}
                      </p>
                      <p className="text-xs text-muted-foreground">Pendentes</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {conferenciasCounts.conferido}
                      </p>
                      <p className="text-xs text-muted-foreground">Conferidos</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {conferenciasCounts.lancado}
                      </p>
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
                      <p className="text-2xl font-bold text-foreground">
                        {conferenciasCounts.divergencia}
                      </p>
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
                  <Badge variant="secondary" className="ml-auto">
                    {filteredConferencias.length} registros
                  </Badge>
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
                              <Badge variant="outline" className="font-mono">
                                {os.numero}
                              </Badge>
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
                                <span className="font-medium">{os.dadosProducao.quantidadePecas || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Scale className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium">
                                  {os.dadosProducao.pesoFinal || os.dadosProducao.pesoTotal || "-"}
                                  {(os.dadosProducao.pesoFinal || os.dadosProducao.pesoTotal) && " kg"}
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
                                    : os.statusConferencia === "conferido"
                                    ? "success"
                                    : os.statusConferencia === "divergencia"
                                    ? "danger"
                                    : "warning"
                                }
                              >
                                {os.statusConferencia === "lancado"
                                  ? "Lançado"
                                  : os.statusConferencia === "conferido"
                                  ? "Conferido"
                                  : os.statusConferencia === "divergencia"
                                  ? "Divergência"
                                  : "Pendente"}
                              </StatusBadge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleOpenOSDetails(os)}
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                </Button>
                                {os.statusConferencia !== "lancado" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-primary hover:text-primary"
                                    onClick={() => handleOpenOSDetails(os)}
                                    title="Gerar Lançamento"
                                  >
                                    <Plus className="w-4 h-4" />
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

        {/* Modal de Conferência */}
        <ConferenciaModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          os={selectedOS}
        />
        </div>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
