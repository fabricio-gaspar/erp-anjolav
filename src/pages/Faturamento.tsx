import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
  Filter,
  Calendar,
  TrendingUp,
  Clock,
  DollarSign,
  Eye,
  Play,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FaturaResumo {
  id: string;
  cliente: string;
  rolCount: number;
  valor: number;
  status: "aguardando" | "nota_emitida" | "pago";
  numeroNF?: string;
}

const mockFaturas: FaturaResumo[] = [
  {
    id: "1",
    cliente: "FABRICIO GASPAR",
    rolCount: 1,
    valor: 25.5,
    status: "aguardando",
    numeroNF: "1-202580000001488",
  },
];

const periodOptions = ["Dia", "Semana", "Quinzena", "Mês", "Personalizado"];

const Faturamento = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("Mês");
  const [currentMonth] = useState("janeiro de 2026");

  const totalPrevisto = mockFaturas.reduce((sum, f) => sum + f.valor, 0);
  const pendente = mockFaturas
    .filter((f) => f.status === "aguardando")
    .reduce((sum, f) => sum + f.valor, 0);
  const recebido = mockFaturas
    .filter((f) => f.status === "pago")
    .reduce((sum, f) => sum + f.valor, 0);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Faturamento</h1>
          <p className="text-sm text-muted-foreground">
            Fechamento e emissão de notas fiscais por período
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Selecionar Período</span>
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

          <div className="flex items-center gap-2 ml-4">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{currentMonth}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total Previsto
              </p>
              <p className="text-2xl font-bold text-foreground currency mt-1">
                R$ {totalPrevisto.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mockFaturas.length} clientes ativos
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pendente
              </p>
              <p className="text-2xl font-bold text-warning currency mt-1">
                R$ {pendente.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Aguardando emissão</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recebido
              </p>
              <p className="text-2xl font-bold text-success currency mt-1">
                R$ {recebido.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Faturas pagas</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-success" />
            </div>
          </div>
        </div>

        {/* Billing Table */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h3 className="font-semibold">Resumo do Mês - dezembro 2025</h3>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">CLIENTE</TableHead>
                <TableHead className="font-semibold">VALOR</TableHead>
                <TableHead className="font-semibold">STATUS</TableHead>
                <TableHead className="font-semibold">Nº NF</TableHead>
                <TableHead className="font-semibold text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockFaturas.map((fatura) => (
                <TableRow key={fatura.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">{fatura.cliente}</p>
                      <p className="text-xs text-muted-foreground">{fatura.rolCount} ROL</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold currency">
                    R$ {fatura.valor.toFixed(2).replace(".", ",")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      variant={
                        fatura.status === "pago"
                          ? "success"
                          : fatura.status === "nota_emitida"
                          ? "info"
                          : "warning"
                      }
                    >
                      {fatura.status === "pago"
                        ? "Pago"
                        : fatura.status === "nota_emitida"
                        ? "Nota Emitida"
                        : "Aguardando"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {fatura.numeroNF || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button size="sm" className="gap-1 bg-success hover:bg-success/90">
                        <Play className="w-3 h-3" />
                        Continuar Processo
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
};

export default Faturamento;
