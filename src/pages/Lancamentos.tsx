import { useState } from "react";
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
} from "lucide-react";
import { usePrintLancamento, type LancamentosPrintData } from "@/hooks/usePrintOS";

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

interface LancamentoConferencia {
  id: string;
  cliente: string;
  dataEmissao: string;
  dataEntrega: string;
  itensCount: number;
  valorTotal: number;
  status: "pendente" | "conferido" | "divergencia";
  observacao?: string;
}

const mockConferencias: LancamentoConferencia[] = [
  {
    id: "1",
    cliente: "FABRICIO GASPAR",
    dataEmissao: "09/01/2026",
    dataEntrega: "09/01/2026",
    itensCount: 3,
    valorTotal: 125.50,
    status: "pendente",
  },
  {
    id: "2",
    cliente: "HOTEL CENTRAL",
    dataEmissao: "08/01/2026",
    dataEntrega: "09/01/2026",
    itensCount: 15,
    valorTotal: 850.00,
    status: "conferido",
  },
  {
    id: "3",
    cliente: "POUSADA SOL NASCENTE",
    dataEmissao: "07/01/2026",
    dataEntrega: "08/01/2026",
    itensCount: 8,
    valorTotal: 320.00,
    status: "divergencia",
    observacao: "Quantidade divergente em 2 itens",
  },
  {
    id: "4",
    cliente: "RESTAURANTE BOM SABOR",
    dataEmissao: "06/01/2026",
    dataEntrega: "07/01/2026",
    itensCount: 5,
    valorTotal: 180.00,
    status: "pendente",
  },
];

const periodOptions = ["Hoje", "Semana", "Quinzena", "Mês", "Personalizado"];

const Lancamentos = () => {
  const [items, setItems] = useState<LancamentoItem[]>([
    {
      id: "1",
      produto: "FRONHA",
      quantidade: 10,
      unidade: "peça",
      valorUnitario: 3.5,
      valorTotal: 35.0,
    },
  ]);

  const [clienteSelecionado] = useState<ClienteSelecionado | null>({
    nome: "FABRICIO GASPAR",
    documento: "276.343.258-13",
    telefone: "(11) 99744-1875",
  });

  const [dataEmissao, setDataEmissao] = useState("2026-01-09");
  const [dataEntrega, setDataEntrega] = useState("2026-01-09");
  const [observacao, setObservacao] = useState("");
  
  // Conferência state
  const [selectedPeriod, setSelectedPeriod] = useState("Semana");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Print hook
  const { printROLFromData, isLoading: isPrinting } = usePrintLancamento();

  const totalValue = items.reduce((sum, item) => sum + item.valorTotal, 0);

  // Filter conferencias
  const filteredConferencias = mockConferencias.filter((conf) => {
    const matchesStatus = statusFilter === "todos" || conf.status === statusFilter;
    const matchesSearch = conf.cliente.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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

  return (
    <AppLayout title="Lançamentos" subtitle="Registre a produção diária por cliente">
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

          <TabsContent value="novo" className="mt-6">
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
                    <div className="relative mt-1.5">
                      {clienteSelecionado ? (
                        <div className="flex items-center justify-between border rounded-md px-3 py-2.5 bg-background">
                          <div>
                            <p className="font-medium text-foreground">
                              {clienteSelecionado.nome}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {clienteSelecionado.documento} •{" "}
                              {clienteSelecionado.telefone}
                            </p>
                          </div>
                          <Search className="w-4 h-4 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="relative">
                          <Input placeholder="Buscar por nome, CNPJ, telefone, cidade..." />
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Produto/Serviço */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Produto/Serviço
                    </Label>
                    <div className="relative mt-1.5">
                      <Input placeholder="Selecione o produto" />
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Quantidade (un)
                    </Label>
                    <Input
                      type="number"
                      placeholder="0"
                      className="mt-1.5"
                      min={0}
                    />
                  </div>

                  {/* Adicionar Item Button */}
                  <Button className="w-full gap-2 mt-2">
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
                        disabled={items.length === 0}
                      >
                        <Tag className="w-4 h-4" />
                        Imprimir Etiqueta
                      </Button>

                      <Button className="w-full gap-2 bg-success hover:bg-success/90">
                        <Check className="w-4 h-4" />
                        Finalizar Lançamento
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="conferencia" className="mt-6">
            <div className="space-y-6">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {mockConferencias.filter((c) => c.status === "pendente").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Pendentes de Conferência</p>
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
                        {mockConferencias.filter((c) => c.status === "conferido").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Conferidos</p>
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
                        {mockConferencias.filter((c) => c.status === "divergencia").length}
                      </p>
                      <p className="text-xs text-muted-foreground">Com Divergências</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Table */}
              <Card className="overflow-hidden">
                <div className="p-4 border-b flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Lançamentos para Conferência</h3>
                  <Badge variant="secondary" className="ml-auto">
                    {filteredConferencias.length} registros
                  </Badge>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">CLIENTE</TableHead>
                      <TableHead className="font-semibold">DATA EMISSÃO</TableHead>
                      <TableHead className="font-semibold">DATA ENTREGA</TableHead>
                      <TableHead className="font-semibold text-center">ITENS</TableHead>
                      <TableHead className="font-semibold text-right">VALOR</TableHead>
                      <TableHead className="font-semibold">STATUS</TableHead>
                      <TableHead className="font-semibold text-right">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredConferencias.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          Nenhum lançamento encontrado para o período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConferencias.map((conf) => (
                        <TableRow key={conf.id} className="hover:bg-muted/30">
                          <TableCell>
                            <p className="font-medium text-foreground">{conf.cliente}</p>
                            {conf.observacao && (
                              <p className="text-xs text-destructive mt-0.5">{conf.observacao}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{conf.dataEmissao}</TableCell>
                          <TableCell className="text-sm">{conf.dataEntrega}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{conf.itensCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(conf.valorTotal)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={
                                conf.status === "conferido"
                                  ? "success"
                                  : conf.status === "divergencia"
                                  ? "danger"
                                  : "warning"
                              }
                            >
                              {conf.status === "conferido"
                                ? "Conferido"
                                : conf.status === "divergencia"
                                ? "Divergência"
                                : "Pendente"}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              {conf.status === "pendente" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-success hover:text-success"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                  >
                                    <AlertTriangle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Lancamentos;
