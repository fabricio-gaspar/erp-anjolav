import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Lock, 
  LockOpen, 
  DollarSign, 
  TrendingUp, 
  Calendar as CalendarIcon,
  Plus,
  BarChart3,
  Package,
  Users,
  AlertTriangle,
  Eye
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCaixaAberto, useCaixasFechados, Caixa } from "@/hooks/useCaixa";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { DetalhesCaixaModal } from "@/components/caixa/DetalhesCaixaModal";
import { RelatorioMovimentacoes } from "@/components/caixa/RelatorioMovimentacoes";
import { RelatorioPecas } from "@/components/caixa/RelatorioPecas";
import { RelatorioOperadores } from "@/components/caixa/RelatorioOperadores";
import { RelatorioDiferencas } from "@/components/caixa/RelatorioDiferencas";
import { RelatorioItens } from "@/components/caixa/RelatorioItens";

const HistoricoCaixas = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [selectedCaixa, setSelectedCaixa] = useState<Caixa | null>(null);
  const [showDetalhesCaixa, setShowDetalhesCaixa] = useState(false);

  const { data: caixaAberto, isLoading: isLoadingAberto } = useCaixaAberto();
  
  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);
  
  const { data: caixasFechados = [], isLoading: isLoadingFechados } = useCaixasFechados(startDate, endDate);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMonthYear = (date: Date) => {
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const totals = useMemo(() => {
    const totalVendas = caixasFechados.reduce((acc, c) => acc + Number(c.valor_vendas || 0), 0);
    const mediaPorDia = caixasFechados.length > 0 
      ? totalVendas / caixasFechados.length 
      : 0;
    const diferencasAcumuladas = caixasFechados.reduce((acc, c) => acc + Number(c.diferenca || 0), 0);
    
    return {
      totalVendas,
      mediaPorDia,
      diferencasAcumuladas,
      qtdCaixas: caixasFechados.length,
    };
  }, [caixasFechados]);

  const handleViewCaixa = (caixa: Caixa) => {
    setSelectedCaixa(caixa);
    setShowDetalhesCaixa(true);
  };

  return (
    <AppLayout title="Histórico de Caixas">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-foreground">
              Relatórios de Caixa
            </h1>
            <p className="text-sm text-muted-foreground">
              Consulte histórico, movimentações, peças e análises
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

        {/* Current Open Register or Open Button */}
        {caixaAberto ? (
          <Card className="p-4 border-l-4 border-l-emerald-500 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <LockOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Caixa Atualmente Aberto</p>
                  <p className="text-sm text-muted-foreground">
                    {caixaAberto.operador} • Aberto em {format(new Date(caixaAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-md border border-emerald-200">
                  <LockOpen className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">ABERTO</span>
                </div>
                <Button 
                  onClick={() => setShowFecharCaixa(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Fechar Caixa
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border-l-4 border-l-muted">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhum caixa aberto</p>
                  <p className="text-sm text-muted-foreground">
                    Abra um caixa para começar a registrar vendas
                  </p>
                </div>
              </div>
              <Button onClick={() => setShowAbrirCaixa(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Abrir Caixa
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="resumo" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="resumo" className="gap-2">
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Resumo</span>
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Movimentações</span>
              </TabsTrigger>
              <TabsTrigger value="itens" className="gap-2">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Itens</span>
              </TabsTrigger>
              <TabsTrigger value="pecas" className="gap-2">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Peças</span>
              </TabsTrigger>
              <TabsTrigger value="operadores" className="gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Operadores</span>
              </TabsTrigger>
              <TabsTrigger value="diferencas" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Diferenças</span>
              </TabsTrigger>
            </TabsList>

            {/* Resumo Mensal Tab */}
            <TabsContent value="resumo" className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-l-primary">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-medium text-primary uppercase tracking-wide">
                        TOTAL VENDAS
                      </p>
                      <p className="text-2xl font-black text-foreground mt-1">
                        {formatCurrency(totals.totalVendas)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totals.qtdCaixas} caixas fechados
                      </p>
                    </div>
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-violet-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">
                        MÉDIA POR DIA
                      </p>
                      <p className="text-2xl font-black text-foreground mt-1">
                        {formatCurrency(totals.mediaPorDia)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ticket médio diário
                      </p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-violet-500" />
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-emerald-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        DIFERENÇAS ACUMULADAS
                      </p>
                      <p className={cn(
                        "text-2xl font-black mt-1",
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

              {/* Closed Registers List */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  <h2 className="font-semibold text-foreground">
                    Caixas Fechados - {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                  </h2>
                </div>

                {isLoadingFechados ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : caixasFechados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <Lock className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground">
                      Nenhum caixa fechado neste período
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caixasFechados.map((caixa) => (
                      <Card 
                        key={caixa.id} 
                        className="p-4 border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleViewCaixa(caixa)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Lock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {caixa.data_fechamento 
                                  ? format(new Date(caixa.data_fechamento), "dd/MM/yyyy", { locale: ptBR })
                                  : "-"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {caixa.operador} • Fechado às {caixa.data_fechamento 
                                  ? format(new Date(caixa.data_fechamento), "HH:mm")
                                  : "-"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="font-black text-foreground">
                                {formatCurrency(Number(caixa.valor_vendas) || 0)}
                              </p>
                              <p className={cn(
                                "text-sm",
                                Number(caixa.diferenca) >= 0 ? "text-emerald-600" : "text-red-600"
                              )}>
                                {Number(caixa.diferenca) >= 0 ? "+" : ""}
                                {formatCurrency(Number(caixa.diferenca) || 0)}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-muted-foreground">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Movimentações Tab */}
            <TabsContent value="movimentacoes">
              <RelatorioMovimentacoes startDate={startDate} endDate={endDate} />
            </TabsContent>

            {/* Itens Tab */}
            <TabsContent value="itens">
              <RelatorioItens startDate={startDate} endDate={endDate} />
            </TabsContent>

            {/* Peças Tab */}
            <TabsContent value="pecas">
              <RelatorioPecas startDate={startDate} endDate={endDate} />
            </TabsContent>

            {/* Operadores Tab */}
            <TabsContent value="operadores">
              <RelatorioOperadores startDate={startDate} endDate={endDate} />
            </TabsContent>

            {/* Diferenças Tab */}
            <TabsContent value="diferencas">
              <RelatorioDiferencas startDate={startDate} endDate={endDate} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* Modals */}
      {caixaAberto && (
        <FecharCaixaModal
          open={showFecharCaixa}
          onOpenChange={setShowFecharCaixa}
          caixa={caixaAberto}
        />
      )}
      
      <AbrirCaixaModal
        open={showAbrirCaixa}
        onOpenChange={setShowAbrirCaixa}
      />

      <DetalhesCaixaModal
        open={showDetalhesCaixa}
        onOpenChange={setShowDetalhesCaixa}
        caixa={selectedCaixa}
      />
    </AppLayout>
  );
};

export default HistoricoCaixas;
