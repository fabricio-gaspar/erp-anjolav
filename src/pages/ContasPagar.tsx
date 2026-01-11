import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  DollarSign,
  CheckCircle,
  TrendingDown,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";

interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago" | "vencido";
  categoria?: string;
}

const mockContas: ContaPagar[] = [
  {
    id: "1",
    descricao: "Conta de Energia - Janeiro/2026",
    fornecedor: "ENEL DISTRIBUIÇÃO",
    valor: 450.0,
    vencimento: "15/01/2026",
    status: "pendente",
    categoria: "Utilidades",
  },
  {
    id: "2",
    descricao: "Aluguel do Galpão",
    fornecedor: "IMOBILIÁRIA CENTRAL",
    valor: 2500.0,
    vencimento: "10/01/2026",
    status: "pago",
    categoria: "Aluguel",
  },
  {
    id: "3",
    descricao: "Fornecedor de Produtos Químicos",
    fornecedor: "QUÍMICA INDUSTRIAL LTDA",
    valor: 1200.0,
    vencimento: "05/01/2026",
    status: "vencido",
    categoria: "Insumos",
  },
];

const ContasPagar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const totalAPagar = mockContas
    .filter((c) => c.status === "pendente" || c.status === "vencido")
    .reduce((sum, c) => sum + c.valor, 0);

  const totalPago = mockContas
    .filter((c) => c.status === "pago")
    .reduce((sum, c) => sum + c.valor, 0);

  const filteredContas = mockContas.filter((conta) => {
    const matchesSearch =
      conta.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conta.fornecedor.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "todos" || conta.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  return (
    <AppLayout title="Contas a Pagar" subtitle="Gerencie suas despesas e pagamentos">
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* A Pagar */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                A PAGAR
              </p>
              <p className="text-2xl font-bold text-destructive mt-1">
                {formatCurrency(totalAPagar)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-destructive flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </Card>

          {/* Pago */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                PAGO
              </p>
              <p className="text-2xl font-bold text-success mt-1">
                {formatCurrency(totalPago)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-success flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </Card>
        </div>

        {/* Table Section */}
        <Card className="overflow-hidden">
          {/* Section Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-destructive" />
              <h3 className="font-semibold text-lg">Contas a Pagar</h3>
            </div>
            <Button className="gap-2 bg-destructive hover:bg-destructive/90">
              <Plus className="w-4 h-4" />
              Nova Despesa
            </Button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Input
                placeholder="Buscar por descrição ou fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">DESCRIÇÃO</TableHead>
                <TableHead className="font-semibold">FORNECEDOR</TableHead>
                <TableHead className="font-semibold text-right">VALOR</TableHead>
                <TableHead className="font-semibold">VENCIMENTO</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Nenhuma conta encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredContas.map((conta) => (
                  <TableRow key={conta.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium">{conta.descricao}</p>
                        {conta.categoria && (
                          <p className="text-xs text-muted-foreground">
                            {conta.categoria}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {conta.fornecedor}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(conta.valor)}
                    </TableCell>
                    <TableCell>{conta.vencimento}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          conta.status === "pago"
                            ? "success"
                            : conta.status === "vencido"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {conta.status === "pago"
                          ? "Pago"
                          : conta.status === "vencido"
                          ? "Vencido"
                          : "Pendente"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {conta.status !== "pago" && (
                          <Button
                            size="sm"
                            className="gap-1 bg-success hover:bg-success/90 h-8"
                          >
                            <Check className="w-3 h-3" />
                            Baixar
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ContasPagar;
