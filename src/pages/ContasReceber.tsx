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
  TrendingUp,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";

interface ContaReceber {
  id: string;
  descricao: string;
  cliente: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "recebido" | "vencido";
}

const mockContas: ContaReceber[] = [
  {
    id: "1",
    descricao: "Fatura NFS-e 1-202500000001488 - FABRICIO GASPAR",
    cliente: "FABRICIO GASPAR",
    valor: 5.0,
    vencimento: "03/01/2026",
    status: "pendente",
  },
];

const ContasReceber = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const totalAReceber = mockContas
    .filter((c) => c.status === "pendente" || c.status === "vencido")
    .reduce((sum, c) => sum + c.valor, 0);

  const totalRecebido = mockContas
    .filter((c) => c.status === "recebido")
    .reduce((sum, c) => sum + c.valor, 0);

  const filteredContas = mockContas.filter((conta) => {
    const matchesSearch =
      conta.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conta.cliente.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "todos" || conta.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  return (
    <AppLayout title="Contas a Receber">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie suas receitas e pagamentos
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* A Receber */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                A RECEBER
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {formatCurrency(totalAReceber)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </Card>

          {/* Recebido */}
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                RECEBIDO
              </p>
              <p className="text-2xl font-bold text-success mt-1">
                {formatCurrency(totalRecebido)}
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
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg">Contas a Receber</h3>
            </div>
            <Button className="gap-2 bg-success hover:bg-success/90">
              <Plus className="w-4 h-4" />
              Nova Receita
            </Button>
          </div>

          {/* Filters */}
          <div className="p-4 border-b flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-xl">
              <Input
                placeholder="Buscar por descrição ou cliente..."
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
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">DESCRIÇÃO</TableHead>
                <TableHead className="font-semibold">CLIENTE</TableHead>
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
                    <TableCell className="font-medium">{conta.descricao}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {conta.cliente}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(conta.valor)}
                    </TableCell>
                    <TableCell>{conta.vencimento}</TableCell>
                    <TableCell>
                      <StatusBadge
                        variant={
                          conta.status === "recebido"
                            ? "success"
                            : conta.status === "vencido"
                            ? "danger"
                            : "warning"
                        }
                      >
                        {conta.status === "recebido"
                          ? "Recebido"
                          : conta.status === "vencido"
                          ? "Vencido"
                          : "Pendente"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {conta.status !== "recebido" && (
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

export default ContasReceber;
