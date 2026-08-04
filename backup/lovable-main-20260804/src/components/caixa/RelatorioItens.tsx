import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Download,
  Printer,
  Package,
  TrendingUp,
  BarChart3,
  Loader2,
  Filter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface RelatorioItensProps {
  startDate: Date;
  endDate: Date;
}

interface ItemResumo {
  produto_nome: string;
  quantidade: number;
  valor_total: number;
  preco_medio: number;
  qtd_os: number;
}

interface ItemDetalhado {
  id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  cor_item: string | null;
  marca_item: string | null;
  avarias: string | null;
  posicao_prateleira: string | null;
  os_numero: string;
  cliente_nome: string;
  data: string;
}

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export function RelatorioItens({ startDate, endDate }: RelatorioItensProps) {
  const [viewMode, setViewMode] = useState<"resumo" | "detalhado">("resumo");
  const [filterProduto, setFilterProduto] = useState("todos");

  // Buscar itens do período
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["relatorio-itens", startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_ordem_servico")
        .select(`
          id,
          produto_nome,
          quantidade,
          preco_unitario,
          subtotal,
          cor_item,
          marca_item,
          avarias,
          posicao_prateleira,
          ordens_servico!inner(
            numero,
            data_retirada,
            clientes(razao_social, nome_fantasia)
          )
        `)
        .gte("ordens_servico.data_retirada", format(startDate, "yyyy-MM-dd"))
        .lte("ordens_servico.data_retirada", format(endDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any) => ({
        id: item.id,
        produto_nome: item.produto_nome,
        quantidade: Number(item.quantidade) || 0,
        preco_unitario: Number(item.preco_unitario) || 0,
        subtotal: Number(item.subtotal) || 0,
        cor_item: item.cor_item,
        marca_item: item.marca_item,
        avarias: item.avarias,
        posicao_prateleira: item.posicao_prateleira,
        os_numero: item.ordens_servico?.numero || "",
        cliente_nome: item.ordens_servico?.clientes?.nome_fantasia || 
                      item.ordens_servico?.clientes?.razao_social || "N/A",
        data: item.ordens_servico?.data_retirada || "",
      }));
    },
  });

  // Agrupar por produto
  const resumoPorProduto = useMemo(() => {
    const map = new Map<string, ItemResumo>();

    itens.forEach((item) => {
      const existing = map.get(item.produto_nome);
      if (existing) {
        existing.quantidade += item.quantidade;
        existing.valor_total += item.subtotal;
        existing.qtd_os += 1;
        existing.preco_medio = existing.valor_total / existing.quantidade;
      } else {
        map.set(item.produto_nome, {
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          valor_total: item.subtotal,
          preco_medio: item.preco_unitario,
          qtd_os: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.quantidade - a.quantidade);
  }, [itens]);

  // Filtrar itens detalhados
  const itensFiltrados = useMemo(() => {
    if (filterProduto === "todos") return itens;
    return itens.filter((item) => item.produto_nome === filterProduto);
  }, [itens, filterProduto]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    return {
      totalPecas: itens.reduce((acc, i) => acc + i.quantidade, 0),
      totalValor: itens.reduce((acc, i) => acc + i.subtotal, 0),
      totalProdutos: resumoPorProduto.length,
      comAvarias: itens.filter((i) => i.avarias).length,
      topProduto: resumoPorProduto[0]?.produto_nome || "N/A",
    };
  }, [itens, resumoPorProduto]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    return resumoPorProduto.slice(0, 10).map((item) => ({
      nome: item.produto_nome.length > 15 
        ? item.produto_nome.substring(0, 15) + "..." 
        : item.produto_nome,
      quantidade: item.quantidade,
      valor: item.valor_total,
    }));
  }, [resumoPorProduto]);

  const pieData = useMemo(() => {
    const top5 = resumoPorProduto.slice(0, 5);
    const outros = resumoPorProduto.slice(5);
    const outrosTotal = outros.reduce((acc, i) => acc + i.quantidade, 0);

    const data = top5.map((item, index) => ({
      name: item.produto_nome,
      value: item.quantidade,
      fill: COLORS[index % COLORS.length],
    }));

    if (outrosTotal > 0) {
      data.push({
        name: "Outros",
        value: outrosTotal,
        fill: "#9CA3AF",
      });
    }

    return data;
  }, [resumoPorProduto]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExportCSV = () => {
    const csvRows: string[] = [];
    
    if (viewMode === "resumo") {
      csvRows.push("Produto,Quantidade,Valor Total,Preço Médio,Qtd OS");
      resumoPorProduto.forEach((item) => {
        csvRows.push(
          `"${item.produto_nome}",${item.quantidade},${item.valor_total.toFixed(2)},${item.preco_medio.toFixed(2)},${item.qtd_os}`
        );
      });
    } else {
      csvRows.push("Data,OS,Cliente,Produto,Qtd,Valor,Cor,Marca,Avarias,Prateleira");
      itensFiltrados.forEach((item) => {
        csvRows.push(
          `${item.data},${item.os_numero},"${item.cliente_nome}","${item.produto_nome}",${item.quantidade},${item.subtotal.toFixed(2)},"${item.cor_item || ""}","${item.marca_item || ""}","${item.avarias || ""}","${item.posicao_prateleira || ""}"`
        );
      });
    }

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_itens_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="resumo">Resumo</SelectItem>
              <SelectItem value="detalhado">Detalhado</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === "detalhado" && (
            <Select value={filterProduto} onValueChange={setFilterProduto}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os produtos</SelectItem>
                {resumoPorProduto.map((item) => (
                  <SelectItem key={item.produto_nome} value={item.produto_nome}>
                    {item.produto_nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Peças</p>
              <p className="text-xl font-bold">{stats.totalPecas.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-lg font-bold text-success">{formatCurrency(stats.totalValor)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Tipos</p>
              <p className="text-xl font-bold">{stats.totalProdutos}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Com Avarias</p>
              <p className="text-xl font-bold text-warning">{stats.comAvarias}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Mais Vendido</p>
              <p className="text-sm font-bold truncate max-w-[120px]">{stats.topProduto}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      {viewMode === "resumo" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Top 10 Produtos por Quantidade</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [value, "Quantidade"]} />
                <Bar dataKey="quantidade" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie Chart */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Distribuição por Produto</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Peças"]} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            {viewMode === "resumo" ? (
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">Qtd OS</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {viewMode === "resumo" ? (
              resumoPorProduto.map((item, index) => (
                <TableRow key={item.produto_nome}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      {item.produto_nome}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold">{item.quantidade}</TableCell>
                  <TableCell className="text-right text-success">{formatCurrency(item.valor_total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.preco_medio)}</TableCell>
                  <TableCell className="text-right">{item.qtd_os}</TableCell>
                </TableRow>
              ))
            ) : (
              itensFiltrados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.data + "T12:00:00"), "dd/MM/yy", { locale: ptBR })}</TableCell>
                  <TableCell className="font-medium">{item.os_numero}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{item.cliente_nome}</TableCell>
                  <TableCell>{item.produto_nome}</TableCell>
                  <TableCell className="text-right">{item.quantidade}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.cor_item && (
                        <Badge variant="outline" className="text-[10px]">
                          🎨 {item.cor_item}
                        </Badge>
                      )}
                      {item.marca_item && (
                        <Badge variant="outline" className="text-[10px]">
                          🏷️ {item.marca_item}
                        </Badge>
                      )}
                      {item.avarias && (
                        <Badge variant="destructive" className="text-[10px]">
                          ⚠️ Avaria
                        </Badge>
                      )}
                      {item.posicao_prateleira && (
                        <Badge variant="secondary" className="text-[10px]">
                          📍 {item.posicao_prateleira}
                        </Badge>
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
  );
}
