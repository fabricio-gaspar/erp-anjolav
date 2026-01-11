import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
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
  Loader2,
} from "lucide-react";
import { useFaturas } from "@/hooks/useFaturas";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const periodOptions = ["Dia", "Semana", "Quinzena", "Mês", "Personalizado"];

const Faturamento = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("Mês");
  const [currentDate, setCurrentDate] = useState(new Date());

  const periodoInicio = format(startOfMonth(currentDate), "yyyy-MM-dd");
  const periodoFim = format(endOfMonth(currentDate), "yyyy-MM-dd");

  const { faturas, summary, isLoading } = useFaturas(periodoInicio, periodoFim);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
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
                R$ {summary.totalPrevisto.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.totalClientes} clientes ativos
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
                R$ {summary.pendente.toFixed(2).replace(".", ",")}
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
                R$ {summary.pago.toFixed(2).replace(".", ",")}
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
            <h3 className="font-semibold">
              Resumo do Mês - {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : faturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>Nenhuma fatura encontrada neste período</p>
            </div>
          ) : (
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
                {faturas.map((fatura) => (
                  <TableRow key={fatura.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">
                          {fatura.cliente?.razao_social || "Cliente"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(fatura.periodo_inicio), "dd/MM")} - {format(new Date(fatura.periodo_fim), "dd/MM/yyyy")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold currency">
                      R$ {Number(fatura.valor_total).toFixed(2).replace(".", ",")}
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
                      {fatura.numero_nf || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        {fatura.status !== "pago" && (
                          <Button size="sm" className="gap-1 bg-success hover:bg-success/90">
                            <Play className="w-3 h-3" />
                            Continuar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Faturamento;
