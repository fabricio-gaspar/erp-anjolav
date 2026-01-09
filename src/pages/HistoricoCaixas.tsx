import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Lock, DollarSign, TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CaixaFechado {
  id: string;
  dataAbertura: Date;
  dataFechamento: Date;
  operador: string;
  totalVendas: number;
  diferenca: number;
}

interface CaixaAberto {
  id: string;
  operador: string;
  dataAbertura: Date;
}

// Mock data
const mockCaixaAberto: CaixaAberto | null = {
  id: "1",
  operador: "Fabricio Gaspar",
  dataAbertura: new Date(2026, 0, 9, 14, 37),
};

const mockCaixasFechados: CaixaFechado[] = [];

const HistoricoCaixas = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [caixaAberto] = useState<CaixaAberto | null>(mockCaixaAberto);
  const [caixasFechados] = useState<CaixaFechado[]>(mockCaixasFechados);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMonthYear = (date: Date) => {
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const filteredCaixas = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return caixasFechados.filter(
      (caixa) => caixa.dataFechamento >= start && caixa.dataFechamento <= end
    );
  }, [caixasFechados, selectedMonth]);

  const totals = useMemo(() => {
    const totalVendas = filteredCaixas.reduce((acc, c) => acc + c.totalVendas, 0);
    const mediaPorDia = filteredCaixas.length > 0 
      ? totalVendas / filteredCaixas.length 
      : 0;
    const diferencasAcumuladas = filteredCaixas.reduce((acc, c) => acc + c.diferenca, 0);
    
    return {
      totalVendas,
      mediaPorDia,
      diferencasAcumuladas,
      qtdCaixas: filteredCaixas.length,
    };
  }, [filteredCaixas]);

  // Get previous month for the "Caixas Fechados" section title
  const previousMonth = useMemo(() => {
    const prev = new Date(selectedMonth);
    prev.setMonth(prev.getMonth() - 1);
    return prev;
  }, [selectedMonth]);

  return (
    <AppLayout title="Histórico de Caixas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Histórico de Caixas
            </h1>
            <p className="text-sm text-muted-foreground">
              Consulte todos os fechamentos anteriores
            </p>
          </div>
          
          {/* Month Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {formatMonthYear(selectedMonth)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => date && setSelectedMonth(date)}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Current Open Register */}
        {caixaAberto && (
          <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Caixa Atualmente Aberto</p>
                  <p className="text-sm text-muted-foreground">
                    {caixaAberto.operador} • Aberto em {format(caixaAberto.dataAbertura, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-md border border-emerald-200">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">ABERTO</span>
              </div>
            </div>
          </Card>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Vendas */}
          <Card className="p-4 border-l-4 border-l-primary">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wide">
                  TOTAL VENDAS
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(totals.totalVendas)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {totals.qtdCaixas} caixas fechados
                </p>
              </div>
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </Card>

          {/* Média por Dia */}
          <Card className="p-4 border-l-4 border-l-violet-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">
                  MÉDIA POR DIA
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {formatCurrency(totals.mediaPorDia)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ticket médio diário
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-violet-500" />
            </div>
          </Card>

          {/* Diferenças Acumuladas */}
          <Card className="p-4 border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  DIFERENÇAS ACUMULADAS
                </p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  totals.diferencasAcumuladas >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {totals.diferencasAcumuladas >= 0 ? "+ " : ""}
                  {formatCurrency(totals.diferencasAcumuladas)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sobras e faltas
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
          </Card>
        </div>

        {/* Closed Registers Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">
              Caixas Fechados - {format(previousMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
          </div>

          {filteredCaixas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground">
                Nenhum caixa fechado neste período
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCaixas.map((caixa) => (
                <Card key={caixa.id} className="p-4 border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Lock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {format(caixa.dataFechamento, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {caixa.operador} • Fechado às {format(caixa.dataFechamento, "HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {formatCurrency(caixa.totalVendas)}
                      </p>
                      <p className={cn(
                        "text-sm",
                        caixa.diferenca >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {caixa.diferenca >= 0 ? "+" : ""}
                        {formatCurrency(caixa.diferenca)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default HistoricoCaixas;
