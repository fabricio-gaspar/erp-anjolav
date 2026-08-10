import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { 
  FileText, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  FileSpreadsheet,
  Users,
  Package,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Filter,
  Printer,
  Wallet
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/useClientes";
import { useRelatorioFinanceiro } from "@/hooks/useRelatorioFinanceiro";
import { RelatorioDRE } from "@/components/relatorios/RelatorioDRE";

type QuickPeriod = "hoje" | "ontem" | "esta_semana" | "este_mes" | "este_ano" | "custom";
type ViewType = "resumo" | "receitas" | "despesas" | "produtos" | "clientes";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

const RelatorioFinanceiro = () => {
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("este_mes");
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(new Date()));
  const [selectedCliente, setSelectedCliente] = useState("todos");
  const [viewType, setViewType] = useState<ViewType>("resumo");
  const [statusFilter, setStatusFilter] = useState("todos");

  const { clientes, isLoading: isLoadingClientes } = useClientes();
  const { 
    receitas, 
    despesas, 
    produtos, 
    categorias, 
    clientesResumo,
    isLoading 
  } = useRelatorioFinanceiro(
    dataInicio, 
    dataFim, 
    selectedCliente === "todos" ? null : selectedCliente
  );

  const handleQuickPeriod = (period: QuickPeriod) => {
    setQuickPeriod(period);
    const today = new Date();
    
    switch (period) {
      case "hoje":
        setDataInicio(startOfDay(today));
        setDataFim(endOfDay(today));
        break;
      case "ontem":
        const yesterday = subDays(today, 1);
        setDataInicio(startOfDay(yesterday));
        setDataFim(endOfDay(yesterday));
        break;
      case "esta_semana":
        setDataInicio(startOfWeek(today, { weekStartsOn: 0 }));
        setDataFim(endOfWeek(today, { weekStartsOn: 0 }));
        break;
      case "este_mes":
        setDataInicio(startOfMonth(today));
        setDataFim(endOfMonth(today));
        break;
      case "este_ano":
        setDataInicio(startOfYear(today));
        setDataFim(endOfYear(today));
        break;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Filtrar receitas e despesas por status
  const receitasFiltradas = useMemo(() => {
    if (statusFilter === "todos") return receitas;
    return receitas.filter(r => r.status === statusFilter);
  }, [receitas, statusFilter]);

  const despesasFiltradas = useMemo(() => {
    if (statusFilter === "todos") return despesas;
    return despesas.filter(d => d.status === statusFilter);
  }, [despesas, statusFilter]);

  const totals = useMemo(() => {
    const totalReceitas = receitasFiltradas.reduce((acc, r) => acc + r.valor, 0);
    const totalDespesas = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);
    const resultado = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0 
      ? ((totalReceitas - totalDespesas) / totalReceitas) * 100 
      : 0;
    const ticketMedioReceita = receitasFiltradas.length > 0 
      ? totalReceitas / receitasFiltradas.length 
      : 0;
    const ticketMedioDespesa = despesasFiltradas.length > 0 
      ? totalDespesas / despesasFiltradas.length 
      : 0;
    const totalLancamentos = receitasFiltradas.length + despesasFiltradas.length;
    const totalPecas = produtos.reduce((acc, p) => acc + p.quantidade, 0);

    return {
      totalReceitas,
      totalDespesas,
      resultado,
      margemLiquida,
      ticketMedioReceita,
      ticketMedioDespesa,
      totalLancamentos,
      qtdReceitas: receitasFiltradas.length,
      qtdDespesas: despesasFiltradas.length,
      totalPecas,
    };
  }, [receitasFiltradas, despesasFiltradas, produtos]);

  // Dados para gráfico de barras (receitas vs despesas)
  const chartData = useMemo(() => {
    return [
      { name: "Receitas", valor: totals.totalReceitas, fill: "#10B981" },
      { name: "Despesas", valor: totals.totalDespesas, fill: "#EF4444" },
    ];
  }, [totals]);

  // Dados para gráfico de pizza (categorias de despesas)
  const pieData = useMemo(() => {
    return categorias.map((cat, index) => ({
      name: cat.categoria,
      value: cat.valor,
      fill: COLORS[index % COLORS.length],
    }));
  }, [categorias]);

  const handleExportCSV = () => {
    const csvRows: string[] = [];
    
    // Cabeçalho
    csvRows.push("Tipo,Data,Descrição,Cliente/Fornecedor,Categoria,Valor,Status");
    
    // Receitas
    receitasFiltradas.forEach(r => {
      csvRows.push(`Receita,${r.data},"${r.descricao}","${r.cliente_nome}",,${r.valor},${r.status}`);
    });
    
    // Despesas
    despesasFiltradas.forEach(d => {
      csvRows.push(`Despesa,${d.data},"${d.descricao}","${d.fornecedor || ""}","${d.categoria || ""}",${d.valor},${d.status}`);
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_financeiro_${format(dataInicio, "yyyy-MM-dd")}_${format(dataFim, "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout title="Relatório Financeiro" subtitle="Análises e relatórios financeiros detalhados">
      <div className="space-y-4 print:space-y-2">
        {/* Filters Card */}
        <Card className="p-4 print:hidden">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground text-sm">Filtros</h2>
          </div>

          {/* Quick Period */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "hoje", label: "Hoje" },
                { value: "ontem", label: "Ontem" },
                { value: "esta_semana", label: "Esta Semana" },
                { value: "este_mes", label: "Este Mês" },
                { value: "este_ano", label: "Este Ano" },
              ].map((period) => (
                <Button
                  key={period.value}
                  variant={quickPeriod === period.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickPeriod(period.value as QuickPeriod)}
                  className="h-7 text-xs"
                >
                  {period.label}
                </Button>
              ))}
            </div>

            {/* Date Range & Filters */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {/* Data Início */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left font-normal h-8 text-xs"
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(dataInicio, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicio}
                      onSelect={(date) => {
                        if (date) {
                          setDataInicio(date);
                          setQuickPeriod("custom");
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Fim */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left font-normal h-8 text-xs"
                    >
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFim}
                      onSelect={(date) => {
                        if (date) {
                          setDataFim(date);
                          setQuickPeriod("custom");
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Client Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os clientes</SelectItem>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="faturado">Faturado</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Buttons */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Exportar</label>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 text-xs flex-1">
                    <FileSpreadsheet className="w-3 h-3 mr-1" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs flex-1">
                    <Printer className="w-3 h-3 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 print:grid-cols-6">
              {/* Total Receitas */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100">
                    <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Receitas</p>
                    <p className="text-sm font-black text-emerald-600">
                      {formatCurrency(totals.totalReceitas)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Total Despesas */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-100">
                    <ArrowDownRight className="w-3 h-3 text-red-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Despesas</p>
                    <p className="text-sm font-black text-red-600">
                      {formatCurrency(totals.totalDespesas)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Resultado */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    totals.resultado >= 0 ? "bg-emerald-100" : "bg-red-100"
                  )}>
                    <Wallet className={cn(
                      "w-3 h-3",
                      totals.resultado >= 0 ? "text-emerald-600" : "text-red-600"
                    )} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Resultado</p>
                    <p className={cn(
                      "text-sm font-black",
                      totals.resultado >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(totals.resultado)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Margem */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100">
                    <BarChart3 className="w-3 h-3 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Margem</p>
                    <p className="text-sm font-black text-blue-600">
                      {totals.margemLiquida.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Card>

              {/* Total Peças */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-100">
                    <Package className="w-3 h-3 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Peças</p>
                    <p className="text-sm font-black text-purple-600">
                      {totals.totalPecas.toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Lançamentos */}
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100">
                    <FileText className="w-3 h-3 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Lançamentos</p>
                    <p className="text-sm font-black text-amber-600">
                      {totals.totalLancamentos}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Tabs de Visualização */}
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)} className="print:hidden">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="resumo" className="text-xs">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  DRE
                </TabsTrigger>
                <TabsTrigger value="receitas" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Receitas
                </TabsTrigger>
                <TabsTrigger value="despesas" className="text-xs">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Despesas
                </TabsTrigger>
                <TabsTrigger value="produtos" className="text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  Produtos
                </TabsTrigger>
                <TabsTrigger value="clientes" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Clientes
                </TabsTrigger>
              </TabsList>

              {/* DRE - Resumo */}
              <TabsContent value="resumo" className="space-y-4">
                <RelatorioDRE
                  dataInicio={dataInicio}
                  dataFim={dataFim}
                  receitas={receitasFiltradas}
                  despesas={despesasFiltradas}
                  categorias={categorias}
                  clientesResumo={clientesResumo}
                  statusFilter={statusFilter}
                />
              </TabsContent>

              {/* Receitas Detalhadas */}
              <TabsContent value="receitas">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-4">
                    Receitas Detalhadas
                    <Badge variant="secondary" className="ml-2">{receitasFiltradas.length}</Badge>
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receitasFiltradas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                              Nenhuma receita encontrada no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          receitasFiltradas.map((receita) => (
                            <TableRow key={receita.id}>
                              <TableCell className="text-xs">{format(new Date(receita.data), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-xs font-medium">{receita.cliente_nome}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{receita.descricao}</TableCell>
                              <TableCell>
                                <Badge variant={receita.status === "faturado" ? "default" : "secondary"} className="text-[10px]">
                                  {receita.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium text-emerald-600">
                                {formatCurrency(receita.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* Despesas Detalhadas */}
              <TabsContent value="despesas">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-4">
                    Despesas Detalhadas
                    <Badge variant="secondary" className="ml-2">{despesasFiltradas.length}</Badge>
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Vencimento</TableHead>
                          <TableHead className="text-xs">Descrição</TableHead>
                          <TableHead className="text-xs">Fornecedor</TableHead>
                          <TableHead className="text-xs">Categoria</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {despesasFiltradas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                              Nenhuma despesa encontrada no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          despesasFiltradas.map((despesa) => (
                            <TableRow key={despesa.id}>
                              <TableCell className="text-xs">{format(new Date(despesa.data), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-xs font-medium">{despesa.descricao}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{despesa.fornecedor || "-"}</TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="text-[10px]">{despesa.categoria || "Sem categoria"}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={despesa.status === "pago" ? "default" : despesa.status === "vencido" ? "destructive" : "secondary"} 
                                  className="text-[10px]"
                                >
                                  {despesa.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium text-red-600">
                                {formatCurrency(despesa.valor)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* Produtos */}
              <TabsContent value="produtos">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-4">
                    Produtos/Serviços Vendidos
                    <Badge variant="secondary" className="ml-2">{produtos.length}</Badge>
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Produto</TableHead>
                          <TableHead className="text-xs text-right">Quantidade</TableHead>
                          <TableHead className="text-xs text-right">Preço Médio</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {produtos.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                              Nenhum produto vendido no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          produtos.map((produto, index) => (
                            <TableRow key={index}>
                              <TableCell className="text-xs font-medium">{produto.produto_nome}</TableCell>
                              <TableCell className="text-xs text-right">{produto.quantidade.toLocaleString("pt-BR")}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(produto.preco_medio)}</TableCell>
                              <TableCell className="text-xs text-right font-medium text-primary">
                                {formatCurrency(produto.valor_total)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              {/* Clientes */}
              <TabsContent value="clientes">
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-4">
                    Faturamento por Cliente
                    <Badge variant="secondary" className="ml-2">{clientesResumo.length}</Badge>
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs text-right">Lançamentos</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">% do Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientesResumo.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                              Nenhum cliente com faturamento no período
                            </TableCell>
                          </TableRow>
                        ) : (
                          clientesResumo.map((cliente) => {
                            const percentual = totals.totalReceitas > 0 
                              ? (cliente.valor_total / totals.totalReceitas) * 100 
                              : 0;
                            return (
                              <TableRow key={cliente.cliente_id}>
                                <TableCell className="text-xs font-medium">{cliente.cliente_nome}</TableCell>
                                <TableCell className="text-xs text-right">{cliente.quantidade_lancamentos}</TableCell>
                                <TableCell className="text-xs text-right font-medium text-primary">
                                  {formatCurrency(cliente.valor_total)}
                                </TableCell>
                                <TableCell className="text-xs text-right">
                                  <Badge variant="outline" className="text-[10px]">{percentual.toFixed(1)}%</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default RelatorioFinanceiro;
