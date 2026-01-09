import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Calendar } from "@/components/ui/calendar";
import { 
  FileText, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  Download,
  FileSpreadsheet
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type QuickPeriod = "hoje" | "ontem" | "esta_semana" | "este_mes" | "este_ano";

interface Receita {
  id: string;
  descricao: string;
  valor: number;
}

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
}

interface ProdutoVendido {
  id: string;
  nome: string;
  quantidade: number;
  valor: number;
}

// Mock data - will be replaced with real data
const mockReceitas: Receita[] = [];
const mockDespesas: Despesa[] = [];
const mockProdutos: ProdutoVendido[] = [
  { id: "1", nome: "CAPA DE ALMOFADA", quantidade: 4, valor: 20.00 },
  { id: "2", nome: "FRONHA", quantidade: 2, valor: 7.00 },
  { id: "3", nome: "TOALHA DE PISO", quantidade: 1, valor: 3.50 },
];

const mockClientes = [
  { id: "todos", nome: "Todos os clientes" },
  { id: "1", nome: "FABRICIO GASPAR" },
  { id: "2", nome: "GARDEN HOUSE" },
  { id: "3", nome: "Anjolav Serviços" },
];

const RelatorioFinanceiro = () => {
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("este_mes");
  const [dataInicio, setDataInicio] = useState<Date>(startOfMonth(new Date()));
  const [dataFim, setDataFim] = useState<Date>(endOfMonth(new Date()));
  const [selectedCliente, setSelectedCliente] = useState("todos");
  
  const [receitas] = useState<Receita[]>(mockReceitas);
  const [despesas] = useState<Despesa[]>(mockDespesas);
  const [produtos] = useState<ProdutoVendido[]>(mockProdutos);

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

  const totals = useMemo(() => {
    const totalReceitas = receitas.reduce((acc, r) => acc + r.valor, 0);
    const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0);
    const resultado = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0 
      ? ((totalReceitas - totalDespesas) / totalReceitas) * 100 
      : 0;
    const ticketMedioReceita = receitas.length > 0 
      ? totalReceitas / receitas.length 
      : 0;
    const ticketMedioDespesa = despesas.length > 0 
      ? totalDespesas / despesas.length 
      : 0;
    const totalLancamentos = receitas.length + despesas.length;

    return {
      totalReceitas,
      totalDespesas,
      resultado,
      margemLiquida,
      ticketMedioReceita,
      ticketMedioDespesa,
      totalLancamentos,
      qtdReceitas: receitas.length,
      qtdDespesas: despesas.length,
    };
  }, [receitas, despesas]);

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log("Exportar CSV");
  };

  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log("Exportar PDF");
  };

  return (
    <AppLayout title="Relatório Financeiro">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Relatório Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Análises e relatórios financeiros detalhados
          </p>
        </div>

        {/* Filters Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Filtros do Relatório</h2>
          </div>

          {/* Quick Period */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Período Rápido</span>
            </div>
            
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
                  className={cn(
                    "h-8",
                    quickPeriod === period.value 
                      ? "bg-foreground text-background hover:bg-foreground/90" 
                      : ""
                  )}
                >
                  {period.label}
                </Button>
              ))}
            </div>

            {/* Date Range & Client Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Data Início */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dataInicio, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataInicio}
                      onSelect={(date) => date && setDataInicio(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Fim */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataFim}
                      onSelect={(date) => date && setDataFim(date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Client Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Filtrar por Cliente</label>
                <Select value={selectedCliente} onValueChange={setSelectedCliente}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockClientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Exportar CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                <Download className="w-4 h-4" />
                Exportar PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* DRE Card */}
        <Card className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-semibold text-foreground">DRE - Demonstrativo do Resultado</h2>
              <p className="text-sm text-muted-foreground">
                {format(subDays(dataInicio, 1), "dd/MM/yyyy", { locale: ptBR })} a {format(dataFim, "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Resultado</p>
              <p className={cn(
                "text-xl font-bold",
                totals.resultado >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(totals.resultado)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Receitas */}
            <div className="rounded-lg overflow-hidden border">
              <div className="bg-emerald-50 px-4 py-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-emerald-600">RECEITAS</span>
              </div>
              <div className="p-4 min-h-[100px]">
                {receitas.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    Nenhuma receita no período
                  </p>
                ) : (
                  <div className="space-y-2">
                    {receitas.map((receita) => (
                      <div key={receita.id} className="flex justify-between text-sm">
                        <span>{receita.descricao}</span>
                        <span className="text-emerald-600">{formatCurrency(receita.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t px-4 py-3 flex justify-between items-center bg-muted/30">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-emerald-600">{formatCurrency(totals.totalReceitas)}</span>
              </div>
            </div>

            {/* Despesas */}
            <div className="rounded-lg overflow-hidden border">
              <div className="bg-red-50 px-4 py-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="font-semibold text-red-600">DESPESAS</span>
              </div>
              <div className="p-4 min-h-[100px]">
                {despesas.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-4">
                    Nenhuma despesa no período
                  </p>
                ) : (
                  <div className="space-y-2">
                    {despesas.map((despesa) => (
                      <div key={despesa.id} className="flex justify-between text-sm">
                        <span>{despesa.descricao}</span>
                        <span className="text-red-600">{formatCurrency(despesa.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t px-4 py-3 flex justify-between items-center bg-muted/30">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-red-600">{formatCurrency(totals.totalDespesas)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Produtos/Serviços Vendidos */}
        <Card className="p-6">
          <h2 className="font-semibold text-foreground mb-4">Produtos/Serviços Vendidos no Período</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {produtos.map((produto) => (
              <div 
                key={produto.id} 
                className="p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-foreground text-sm">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">Qtd: {produto.quantidade}</p>
                  </div>
                  <span className="text-primary font-semibold text-sm">
                    {formatCurrency(produto.valor)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Lançamentos */}
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              LANÇAMENTOS
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {totals.totalLancamentos}
            </p>
            <p className="text-xs text-muted-foreground">
              {totals.qtdReceitas} receitas • {totals.qtdDespesas} despesas
            </p>
          </Card>

          {/* Ticket Médio Receita */}
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              TICKET MÉDIO (RECEITA)
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(totals.ticketMedioReceita)}
            </p>
          </Card>

          {/* Ticket Médio Despesa */}
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              TICKET MÉDIO (DESPESA)
            </p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(totals.ticketMedioDespesa)}
            </p>
          </Card>

          {/* Margem Líquida */}
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              MARGEM LÍQUIDA
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {totals.margemLiquida.toFixed(1)}%
            </p>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default RelatorioFinanceiro;
