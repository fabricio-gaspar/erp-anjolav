import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  FileSpreadsheet,
  Printer,
  Calendar,
  Building2,
  CircleDollarSign,
  Percent,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"];

interface ReceitaItem {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  cliente_nome: string;
  cliente_id: string;
  tipo: "lancamento" | "fatura";
  status: string;
}

interface DespesaItem {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string | null;
  fornecedor: string | null;
  status: string;
}

interface ResumoCategoria {
  categoria: string;
  valor: number;
  quantidade: number;
}

interface ResumoCliente {
  cliente_id: string;
  cliente_nome: string;
  valor_total: number;
  quantidade_lancamentos: number;
}

interface RelatorioDREProps {
  dataInicio: Date;
  dataFim: Date;
  receitas: ReceitaItem[];
  despesas: DespesaItem[];
  categorias: ResumoCategoria[];
  clientesResumo: ResumoCliente[];
  statusFilter?: string;
}

// Categorias padrão para DRE estruturado
const CATEGORIAS_DRE = {
  receitas: [
    { grupo: "RECEITA OPERACIONAL BRUTA", subcategorias: ["Serviços Prestados", "Vendas de Produtos", "Locação de Itens"] },
    { grupo: "OUTRAS RECEITAS", subcategorias: ["Receitas Financeiras", "Outras Receitas Operacionais"] },
  ],
  deducoes: ["Impostos sobre Serviços (ISS)", "PIS/COFINS", "Descontos Concedidos"],
  custos: ["Custo de Mão de Obra", "Custo de Materiais", "Custo de Insumos"],
  despesas_operacionais: [
    { grupo: "DESPESAS ADMINISTRATIVAS", subcategorias: ["Salários e Encargos", "Aluguel", "Energia Elétrica", "Água", "Telefone/Internet", "Material de Escritório", "Contabilidade", "Software/TI"] },
    { grupo: "DESPESAS COMERCIAIS", subcategorias: ["Marketing", "Comissões", "Frete/Logística"] },
    { grupo: "DESPESAS FINANCEIRAS", subcategorias: ["Juros Bancários", "Tarifas Bancárias", "Multas"] },
    { grupo: "DESPESAS DIVERSAS", subcategorias: ["Manutenção", "Seguros", "Impostos e Taxas", "Outras Despesas"] },
  ],
};

export function RelatorioDRE({
  dataInicio,
  dataFim,
  receitas,
  despesas,
  categorias,
  clientesResumo,
  statusFilter = "todos",
}: RelatorioDREProps) {
  const [viewMode, setViewMode] = useState<"resumo" | "detalhado" | "mensal" | "comparativo">("resumo");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["RECEITA OPERACIONAL BRUTA"]));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
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

  // Cálculos do DRE
  const dre = useMemo(() => {
    const receitaBruta = receitasFiltradas.reduce((acc, r) => acc + r.valor, 0);
    const totalDespesas = despesasFiltradas.reduce((acc, d) => acc + d.valor, 0);
    
    // Agrupar despesas por categoria
    const despesasPorCategoria = despesasFiltradas.reduce((acc, d) => {
      const cat = d.categoria || "Outras Despesas";
      acc[cat] = (acc[cat] || 0) + d.valor;
      return acc;
    }, {} as Record<string, number>);

    // Estimativas de deduções (simplificado - em produção viria do BD)
    const issEstimado = receitaBruta * 0.05; // 5% de ISS estimado
    const pisCofinEstimado = receitaBruta * 0.0365; // 3.65% PIS/COFINS estimado
    const deducoesTotal = issEstimado + pisCofinEstimado;
    
    const receitaLiquida = receitaBruta - deducoesTotal;
    
    // Separar custos de despesas operacionais
    const custosVariaveis = (despesasPorCategoria["Materiais"] || 0) + 
                           (despesasPorCategoria["Insumos"] || 0) + 
                           (despesasPorCategoria["Mão de Obra Direta"] || 0);
    
    const lucroBruto = receitaLiquida - custosVariaveis;
    
    const despesasOperacionais = totalDespesas - custosVariaveis;
    
    const lucroOperacional = lucroBruto - despesasOperacionais;
    
    // Resultado financeiro (receitas - despesas financeiras)
    const despesasFinanceiras = (despesasPorCategoria["Juros"] || 0) + 
                                (despesasPorCategoria["Tarifas Bancárias"] || 0) +
                                (despesasPorCategoria["Multas"] || 0);
    
    const lucroAntesIR = lucroOperacional - despesasFinanceiras;
    
    // Provisão IR/CSLL simplificada (Simples Nacional)
    const provisaoIR = lucroAntesIR > 0 ? lucroAntesIR * 0.08 : 0;
    
    const lucroLiquido = lucroAntesIR - provisaoIR;
    
    const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
    const margemOperacional = receitaBruta > 0 ? (lucroOperacional / receitaBruta) * 100 : 0;
    const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

    return {
      receitaBruta,
      deducoes: {
        iss: issEstimado,
        pisCofins: pisCofinEstimado,
        total: deducoesTotal,
      },
      receitaLiquida,
      custosVariaveis,
      lucroBruto,
      despesasOperacionais,
      despesasPorCategoria,
      lucroOperacional,
      despesasFinanceiras,
      lucroAntesIR,
      provisaoIR,
      lucroLiquido,
      margemBruta,
      margemOperacional,
      margemLiquida,
      totalDespesas,
    };
  }, [receitasFiltradas, despesasFiltradas]);

  // Dados mensais para gráfico de evolução
  const dadosMensais = useMemo(() => {
    const meses = eachMonthOfInterval({ start: dataInicio, end: dataFim });
    
    return meses.map(mes => {
      const mesInicio = startOfMonth(mes);
      const mesFim = endOfMonth(mes);
      
      const receitasMes = receitasFiltradas
        .filter(r => {
          const data = parseISO(r.data);
          return data >= mesInicio && data <= mesFim;
        })
        .reduce((acc, r) => acc + r.valor, 0);
      
      const despesasMes = despesasFiltradas
        .filter(d => {
          const data = parseISO(d.data);
          return data >= mesInicio && data <= mesFim;
        })
        .reduce((acc, d) => acc + d.valor, 0);
      
      return {
        mes: format(mes, "MMM/yy", { locale: ptBR }),
        mesCompleto: format(mes, "MMMM yyyy", { locale: ptBR }),
        receitas: receitasMes,
        despesas: despesasMes,
        resultado: receitasMes - despesasMes,
        margem: receitasMes > 0 ? ((receitasMes - despesasMes) / receitasMes) * 100 : 0,
      };
    });
  }, [dataInicio, dataFim, receitasFiltradas, despesasFiltradas]);

  // Dados para gráfico de pizza (despesas por categoria)
  const pieData = useMemo(() => {
    return Object.entries(dre.despesasPorCategoria)
      .map(([categoria, valor], index) => ({
        name: categoria,
        value: valor,
        fill: COLORS[index % COLORS.length],
        percent: dre.totalDespesas > 0 ? (valor / dre.totalDespesas) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [dre.despesasPorCategoria, dre.totalDespesas]);

  // Dados para receitas por cliente
  const receitasPorCliente = useMemo(() => {
    return clientesResumo
      .map((c, index) => ({
        name: c.cliente_nome.length > 20 ? c.cliente_nome.substring(0, 20) + "..." : c.cliente_nome,
        fullName: c.cliente_nome,
        value: c.valor_total,
        fill: COLORS[index % COLORS.length],
        lancamentos: c.quantidade_lancamentos,
        percent: dre.receitaBruta > 0 ? (c.valor_total / dre.receitaBruta) * 100 : 0,
      }))
      .slice(0, 10);
  }, [clientesResumo, dre.receitaBruta]);

  const handleExportCSV = () => {
    const csvRows: string[] = [];
    
    csvRows.push("DRE - Demonstração do Resultado do Exercício");
    csvRows.push(`Período: ${format(dataInicio, "dd/MM/yyyy")} a ${format(dataFim, "dd/MM/yyyy")}`);
    csvRows.push("");
    csvRows.push("Conta,Valor,% Receita");
    csvRows.push(`RECEITA BRUTA,${dre.receitaBruta.toFixed(2)},100%`);
    csvRows.push(`(-) Deduções - ISS,${dre.deducoes.iss.toFixed(2)},${formatPercent((dre.deducoes.iss / dre.receitaBruta) * 100)}`);
    csvRows.push(`(-) Deduções - PIS/COFINS,${dre.deducoes.pisCofins.toFixed(2)},${formatPercent((dre.deducoes.pisCofins / dre.receitaBruta) * 100)}`);
    csvRows.push(`(=) RECEITA LÍQUIDA,${dre.receitaLiquida.toFixed(2)},${formatPercent((dre.receitaLiquida / dre.receitaBruta) * 100)}`);
    csvRows.push(`(-) Custos Variáveis,${dre.custosVariaveis.toFixed(2)},${formatPercent((dre.custosVariaveis / dre.receitaBruta) * 100)}`);
    csvRows.push(`(=) LUCRO BRUTO,${dre.lucroBruto.toFixed(2)},${formatPercent(dre.margemBruta)}`);
    csvRows.push(`(-) Despesas Operacionais,${dre.despesasOperacionais.toFixed(2)},${formatPercent((dre.despesasOperacionais / dre.receitaBruta) * 100)}`);
    csvRows.push(`(=) LUCRO OPERACIONAL,${dre.lucroOperacional.toFixed(2)},${formatPercent(dre.margemOperacional)}`);
    csvRows.push(`(-) Despesas Financeiras,${dre.despesasFinanceiras.toFixed(2)},${formatPercent((dre.despesasFinanceiras / dre.receitaBruta) * 100)}`);
    csvRows.push(`(=) LUCRO ANTES IR,${dre.lucroAntesIR.toFixed(2)},${formatPercent((dre.lucroAntesIR / dre.receitaBruta) * 100)}`);
    csvRows.push(`(-) Provisão IR/CSLL,${dre.provisaoIR.toFixed(2)},${formatPercent((dre.provisaoIR / dre.receitaBruta) * 100)}`);
    csvRows.push(`(=) LUCRO LÍQUIDO,${dre.lucroLiquido.toFixed(2)},${formatPercent(dre.margemLiquida)}`);
    csvRows.push("");
    csvRows.push("Despesas por Categoria");
    Object.entries(dre.despesasPorCategoria).forEach(([cat, valor]) => {
      csvRows.push(`${cat},${valor.toFixed(2)},${formatPercent((valor / dre.receitaBruta) * 100)}`);
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DRE_${format(dataInicio, "yyyy-MM-dd")}_${format(dataFim, "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  // Componente de linha do DRE
  const DRELine = ({ 
    label, 
    value, 
    percentReceita, 
    isTotal = false, 
    isSubtraction = false,
    isPositive = false,
    isNegative = false,
    indent = 0,
  }: { 
    label: string; 
    value: number; 
    percentReceita?: number;
    isTotal?: boolean; 
    isSubtraction?: boolean;
    isPositive?: boolean;
    isNegative?: boolean;
    indent?: number;
  }) => (
    <div className={cn(
      "flex items-center justify-between py-2 px-3 border-b last:border-0",
      isTotal && "bg-muted/50 font-semibold",
      indent > 0 && "pl-6",
    )}>
      <span className={cn(
        "text-sm",
        isSubtraction && "text-muted-foreground",
        isTotal && "font-semibold text-foreground",
      )}>
        {isSubtraction && "(-) "}
        {isTotal && "(=) "}
        {label}
      </span>
      <div className="flex items-center gap-4">
        <span className={cn(
          "text-sm font-medium tabular-nums",
          isPositive && value >= 0 && "text-emerald-600",
          isNegative && value < 0 && "text-red-600",
          !isPositive && !isNegative && isSubtraction && "text-red-600",
          isTotal && (value >= 0 ? "text-emerald-600" : "text-red-600"),
        )}>
          {formatCurrency(value)}
        </span>
        {percentReceita !== undefined && (
          <span className="text-xs text-muted-foreground w-16 text-right">
            {formatPercent(percentReceita)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header com controles */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resumo">Visão Resumida</SelectItem>
              <SelectItem value="detalhado">Visão Detalhada</SelectItem>
              <SelectItem value="mensal">Evolução Mensal</SelectItem>
              <SelectItem value="comparativo">Análise Comparativa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8 text-xs">
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 text-xs">
            <Printer className="w-3 h-3 mr-1" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 print:grid-cols-6">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Receita Bruta</p>
              <p className="text-sm font-bold text-emerald-600">
                {formatCurrency(dre.receitaBruta)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30">
              <ArrowDownRight className="w-3 h-3 text-red-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Despesas</p>
              <p className="text-sm font-bold text-red-600">
                {formatCurrency(dre.totalDespesas)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              dre.lucroBruto >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
            )}>
              <Wallet className={cn(
                "w-3 h-3",
                dre.lucroBruto >= 0 ? "text-emerald-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Lucro Bruto</p>
              <p className={cn(
                "text-sm font-bold",
                dre.lucroBruto >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(dre.lucroBruto)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              dre.lucroLiquido >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
            )}>
              <CircleDollarSign className={cn(
                "w-3 h-3",
                dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Lucro Líquido</p>
              <p className={cn(
                "text-sm font-bold",
                dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatCurrency(dre.lucroLiquido)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Percent className="w-3 h-3 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Margem Bruta</p>
              <p className="text-sm font-bold text-blue-600">
                {formatPercent(dre.margemBruta)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              dre.margemLiquida >= 0 ? "bg-violet-100 dark:bg-violet-900/30" : "bg-red-100 dark:bg-red-900/30"
            )}>
              <BarChart3 className={cn(
                "w-3 h-3",
                dre.margemLiquida >= 0 ? "text-violet-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Margem Líquida</p>
              <p className={cn(
                "text-sm font-bold",
                dre.margemLiquida >= 0 ? "text-violet-600" : "text-red-600"
              )}>
                {formatPercent(dre.margemLiquida)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Conteúdo baseado na visão selecionada */}
      {viewMode === "resumo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* DRE Estruturado */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">
                DRE - Demonstração do Resultado
              </h3>
              <Badge variant="outline" className="text-[10px]">
                {format(dataInicio, "dd/MM/yy")} - {format(dataFim, "dd/MM/yy")}
              </Badge>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <DRELine 
                label="RECEITA OPERACIONAL BRUTA" 
                value={dre.receitaBruta} 
                percentReceita={100}
                isTotal
              />
              <DRELine 
                label="ISS sobre Serviços" 
                value={dre.deducoes.iss} 
                percentReceita={(dre.deducoes.iss / dre.receitaBruta) * 100}
                isSubtraction
                indent={1}
              />
              <DRELine 
                label="PIS/COFINS" 
                value={dre.deducoes.pisCofins} 
                percentReceita={(dre.deducoes.pisCofins / dre.receitaBruta) * 100}
                isSubtraction
                indent={1}
              />
              <DRELine 
                label="RECEITA OPERACIONAL LÍQUIDA" 
                value={dre.receitaLiquida} 
                percentReceita={(dre.receitaLiquida / dre.receitaBruta) * 100}
                isTotal
              />
              <DRELine 
                label="Custos dos Serviços Prestados" 
                value={dre.custosVariaveis} 
                percentReceita={(dre.custosVariaveis / dre.receitaBruta) * 100}
                isSubtraction
              />
              <DRELine 
                label="LUCRO BRUTO" 
                value={dre.lucroBruto} 
                percentReceita={dre.margemBruta}
                isTotal
                isPositive
              />
              <DRELine 
                label="Despesas Operacionais" 
                value={dre.despesasOperacionais} 
                percentReceita={(dre.despesasOperacionais / dre.receitaBruta) * 100}
                isSubtraction
              />
              <DRELine 
                label="LUCRO OPERACIONAL (EBIT)" 
                value={dre.lucroOperacional} 
                percentReceita={dre.margemOperacional}
                isTotal
                isPositive
              />
              <DRELine 
                label="Despesas Financeiras" 
                value={dre.despesasFinanceiras} 
                percentReceita={(dre.despesasFinanceiras / dre.receitaBruta) * 100}
                isSubtraction
              />
              <DRELine 
                label="LUCRO ANTES DO IR (EBT)" 
                value={dre.lucroAntesIR} 
                percentReceita={(dre.lucroAntesIR / dre.receitaBruta) * 100}
                isTotal
                isPositive
              />
              <DRELine 
                label="Provisão IR/CSLL" 
                value={dre.provisaoIR} 
                percentReceita={(dre.provisaoIR / dre.receitaBruta) * 100}
                isSubtraction
              />
              <div className={cn(
                "flex items-center justify-between py-3 px-3",
                "bg-gradient-to-r",
                dre.lucroLiquido >= 0 
                  ? "from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10" 
                  : "from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10"
              )}>
                <span className="text-sm font-bold">
                  (=) LUCRO LÍQUIDO DO EXERCÍCIO
                </span>
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-lg font-bold tabular-nums",
                    dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatCurrency(dre.lucroLiquido)}
                  </span>
                  <span className={cn(
                    "text-xs font-semibold w-16 text-right",
                    dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatPercent(dre.margemLiquida)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Gráficos */}
          <div className="space-y-4">
            {/* Gráfico de Barras - Receitas vs Despesas */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-4">Receitas vs Despesas</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: "Receitas", valor: dre.receitaBruta, fill: "hsl(var(--chart-2))" },
                    { name: "Despesas", valor: dre.totalDespesas, fill: "hsl(var(--chart-1))" },
                    { name: "Lucro", valor: dre.lucroLiquido, fill: dre.lucroLiquido >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))" },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        borderColor: 'hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="valor" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Gráfico de Pizza - Despesas por Categoria */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-4">Despesas por Categoria</h3>
              {pieData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem despesas no período
                </div>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend 
                        formatter={(value: string) => value.length > 15 ? value.slice(0, 15) + "..." : value}
                        wrapperStyle={{ fontSize: '10px' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {viewMode === "detalhado" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Despesas Detalhadas por Categoria */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">
              Despesas por Categoria
              <Badge variant="secondary" className="ml-2">{Object.keys(dre.despesasPorCategoria).length}</Badge>
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {Object.entries(dre.despesasPorCategoria)
                .sort(([, a], [, b]) => b - a)
                .map(([categoria, valor], index) => (
                  <div key={categoria} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{categoria}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{formatCurrency(valor)}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatPercent((valor / dre.totalDespesas) * 100)}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Receitas por Cliente */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">
              Receitas por Cliente
              <Badge variant="secondary" className="ml-2">{clientesResumo.length}</Badge>
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {receitasPorCliente.map((cliente, index) => (
                <div key={cliente.fullName} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <span className="text-sm">{cliente.fullName}</span>
                      <p className="text-[10px] text-muted-foreground">{cliente.lancamentos} lançamentos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-emerald-600">{formatCurrency(cliente.value)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {formatPercent(cliente.percent)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {viewMode === "mensal" && (
        <div className="space-y-4">
          {/* Gráfico de Evolução Mensal */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Evolução Mensal - Receitas vs Despesas</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis yAxisId="left" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} fontSize={10} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === "margem") return [`${value.toFixed(1)}%`, "Margem"];
                      return [formatCurrency(value), name === "receitas" ? "Receitas" : name === "despesas" ? "Despesas" : "Resultado"];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="margem" name="Margem %" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Tabela Mensal Detalhada */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Detalhamento Mensal</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Mês</TableHead>
                    <TableHead className="text-xs text-right">Receitas</TableHead>
                    <TableHead className="text-xs text-right">Despesas</TableHead>
                    <TableHead className="text-xs text-right">Resultado</TableHead>
                    <TableHead className="text-xs text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dadosMensais.map((mes) => (
                    <TableRow key={mes.mes}>
                      <TableCell className="text-xs font-medium">{mes.mesCompleto}</TableCell>
                      <TableCell className="text-xs text-right text-emerald-600 font-medium">
                        {formatCurrency(mes.receitas)}
                      </TableCell>
                      <TableCell className="text-xs text-right text-red-600 font-medium">
                        {formatCurrency(mes.despesas)}
                      </TableCell>
                      <TableCell className={cn(
                        "text-xs text-right font-semibold",
                        mes.resultado >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {formatCurrency(mes.resultado)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Badge variant={mes.margem >= 0 ? "default" : "destructive"} className="text-[10px]">
                          {formatPercent(mes.margem)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell className="text-xs font-bold">TOTAL</TableCell>
                    <TableCell className="text-xs text-right text-emerald-600 font-bold">
                      {formatCurrency(dadosMensais.reduce((acc, m) => acc + m.receitas, 0))}
                    </TableCell>
                    <TableCell className="text-xs text-right text-red-600 font-bold">
                      {formatCurrency(dadosMensais.reduce((acc, m) => acc + m.despesas, 0))}
                    </TableCell>
                    <TableCell className={cn(
                      "text-xs text-right font-bold",
                      dre.lucroLiquido >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(dadosMensais.reduce((acc, m) => acc + m.resultado, 0))}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      <Badge variant={dre.margemLiquida >= 0 ? "default" : "destructive"} className="text-[10px]">
                        {formatPercent(dre.margemLiquida)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {viewMode === "comparativo" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gráfico de Área - Evolução do Resultado */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Evolução do Resultado</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosMensais}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} fontSize={10} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="resultado" 
                    name="Resultado" 
                    stroke="#8B5CF6" 
                    fill="url(#colorResultado)" 
                    strokeWidth={2}
                  />
                  <defs>
                    <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Indicadores Comparativos */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-4">Indicadores de Performance</h3>
            <div className="space-y-4">
              {/* ROI Operacional */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ROI Operacional</span>
                  <span className={cn(
                    "text-lg font-bold",
                    dre.totalDespesas > 0 && (dre.lucroOperacional / dre.totalDespesas) * 100 >= 0 
                      ? "text-emerald-600" 
                      : "text-red-600"
                  )}>
                    {dre.totalDespesas > 0 
                      ? formatPercent((dre.lucroOperacional / dre.totalDespesas) * 100)
                      : "N/A"
                    }
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Retorno sobre investimento operacional
                </p>
              </div>

              {/* Ponto de Equilíbrio */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cobertura de Custos Fixos</span>
                  <span className={cn(
                    "text-lg font-bold",
                    dre.receitaBruta >= dre.totalDespesas ? "text-emerald-600" : "text-amber-600"
                  )}>
                    {dre.totalDespesas > 0 
                      ? formatPercent((dre.receitaBruta / dre.totalDespesas) * 100)
                      : "N/A"
                    }
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {dre.receitaBruta >= dre.totalDespesas 
                    ? "Receitas cobrem as despesas" 
                    : "Despesas excedem receitas"
                  }
                </p>
              </div>

              {/* Ticket Médio */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ticket Médio por Cliente</span>
                  <span className="text-lg font-bold text-primary">
                    {clientesResumo.length > 0 
                      ? formatCurrency(dre.receitaBruta / clientesResumo.length)
                      : "N/A"
                    }
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Baseado em {clientesResumo.length} cliente(s)
                </p>
              </div>

              {/* Eficiência Operacional */}
              <div className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Eficiência Operacional</span>
                  <span className={cn(
                    "text-lg font-bold",
                    dre.margemOperacional >= 20 ? "text-emerald-600" : 
                    dre.margemOperacional >= 10 ? "text-amber-600" : "text-red-600"
                  )}>
                    {formatPercent(dre.margemOperacional)}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {dre.margemOperacional >= 20 ? "Excelente" : 
                   dre.margemOperacional >= 10 ? "Bom" : "Precisa melhorar"
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
