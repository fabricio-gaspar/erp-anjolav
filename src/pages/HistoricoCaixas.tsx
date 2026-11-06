import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
} from "lucide-react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useCaixaAberto,
  useClosedCashRegisterDirectory,
  type ClosedCashRegister,
  type CashDifferenceFilter,
} from "@/hooks/useCaixa";
import { usePermissaoModulo } from "@/hooks/usePermissoesUsuario";
import { FecharCaixaModal } from "@/components/caixa/FecharCaixaModal";
import { AbrirCaixaModal } from "@/components/caixa/AbrirCaixaModal";
import { DetalhesCaixaModal } from "@/components/caixa/DetalhesCaixaModal";
import { RelatorioMovimentacoes } from "@/components/caixa/RelatorioMovimentacoes";
import { RelatorioPecas } from "@/components/caixa/RelatorioPecas";
import { RelatorioOperadores } from "@/components/caixa/RelatorioOperadores";
import { RelatorioDiferencas } from "@/components/caixa/RelatorioDiferencas";
import { RelatorioItens } from "@/components/caixa/RelatorioItens";

const HistoricoCaixas = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [selectedCaixa, setSelectedCaixa] = useState<ClosedCashRegister | null>(null);
  const [showDetalhesCaixa, setShowDetalhesCaixa] = useState(false);

  const cashPermission = usePermissaoModulo("caixa");
  const canOperateCash = cashPermission.allowed;
  const {
    data: caixaAberto,
    isLoading: isLoadingAberto,
    isError: isOpenCashError,
    refetch: refetchOpenCash,
  } = useCaixaAberto(canOperateCash);
  
  const startDate = startOfMonth(selectedMonth);
  const endDate = endOfMonth(selectedMonth);
  const endExclusive = startOfMonth(addMonths(selectedMonth, 1));
  const page = Math.max(1, Number.parseInt(searchParams.get("caixa_pagina") || "1", 10) || 1);
  const search = searchParams.get("caixa_busca") || "";
  const differenceParam = searchParams.get("caixa_diferenca") || "todos";
  const difference: CashDifferenceFilter = ["todos", "com", "sem", "sobra", "falta"].includes(differenceParam)
    ? differenceParam as CashDifferenceFilter
    : "todos";
  const deferredSearch = useDeferredValue(search);
  const directory = useClosedCashRegisterDirectory({
    startDate,
    endExclusive,
    page,
    search: deferredSearch,
    difference,
  });
  const caixasFechados = directory.data?.items ?? [];
  const totals = directory.data?.summary;
  const totalPages = directory.data?.paginas ?? 1;

  useEffect(() => {
    if (!directory.isLoading && page > totalPages) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("caixa_pagina", String(totalPages));
        return next;
      }, { replace: true });
    }
  }, [directory.isLoading, page, setSearchParams, totalPages]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatMonthYear = (date: Date) => {
    return format(date, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const setDirectoryParam = (key: string, value: string | null) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === "todos" || (key === "caixa_pagina" && value === "1")) next.delete(key);
      else next.set(key, value);
      if (key !== "caixa_pagina") next.delete("caixa_pagina");
      return next;
    }, { replace: true });
  };

  const handleViewCaixa = (caixa: ClosedCashRegister) => {
    setSelectedCaixa(caixa);
    setShowDetalhesCaixa(true);
  };

  return (
    <AppLayout title="Histórico de Caixas">
      <div className="page-shell">
        <PageHeader
          eyebrow="Financeiro e conferência"
          title="Relatórios de Caixa"
          description="Consulte histórico, movimentações, peças e análises"
          actions={(
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full gap-2 sm:w-auto">
                <CalendarIcon className="w-4 h-4" />
                {formatMonthYear(selectedMonth)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedMonth}
                onSelect={(date) => {
                  if (!date) return;
                  setSelectedMonth(date);
                  setDirectoryParam("caixa_pagina", "1");
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          )}
        />

        {/* Current register is operational context; report-only users stay read-only. */}
        {cashPermission.isLoading || (canOperateCash && isLoadingAberto) ? (
          <Card className="h-28 animate-pulse bg-muted/30" aria-label="Carregando situação do caixa" />
        ) : cashPermission.isError ? (
          <Card className="border-amber-200 bg-amber-50/60 p-4">
            <p className="font-semibold text-amber-900">Não foi possível verificar sua permissão de caixa</p>
            <p className="mt-1 text-sm text-amber-800">O relatório continua disponível, mas as ações operacionais ficaram bloqueadas.</p>
          </Card>
        ) : !canOperateCash ? (
          <Card className="border-l-4 border-l-blue-500 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Modo de consulta</p>
                <p className="text-sm text-muted-foreground">Seu perfil pode analisar os fechamentos, mas não abrir ou fechar o caixa.</p>
              </div>
            </div>
          </Card>
        ) : isOpenCashError ? (
          <Card className="border-red-200 bg-red-50/60 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-red-900">Não foi possível consultar o caixa atual</p>
                <p className="text-sm text-red-700">Tente novamente antes de iniciar uma operação.</p>
              </div>
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => void refetchOpenCash()}>
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </Button>
            </div>
          </Card>
        ) : caixaAberto ? (
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/50 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <LockOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">Caixa atualmente aberto</p>
                  <p className="break-words text-sm text-muted-foreground">
                    {caixaAberto.operador} • Aberto em {format(new Date(caixaAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-100 px-3">
                  <LockOpen className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">ABERTO</span>
                </div>
                <Button onClick={() => setShowFecharCaixa(true)} className="min-h-11 bg-red-600 hover:bg-red-700">
                  <Lock className="mr-2 h-4 w-4" /> Fechar caixa
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-muted p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhum caixa aberto</p>
                  <p className="text-sm text-muted-foreground">Abra um caixa para começar a registrar vendas.</p>
                </div>
              </div>
              <Button onClick={() => setShowAbrirCaixa(true)} className="min-h-11 gap-2">
                <Plus className="h-4 w-4" /> Abrir caixa
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <Card className="p-3 sm:p-6">
          <Tabs defaultValue="resumo" className="space-y-6">
            <div className="max-w-full overflow-x-auto pb-1">
            <TabsList className="page-tabs-list min-w-max justify-start">
              <TabsTrigger value="resumo" className="page-tab-trigger gap-2">
                <Lock className="w-4 h-4" />
                <span>Resumo</span>
              </TabsTrigger>
              <TabsTrigger value="movimentacoes" className="page-tab-trigger gap-2">
                <BarChart3 className="w-4 h-4" />
                <span>Movimentações</span>
              </TabsTrigger>
              <TabsTrigger value="itens" className="page-tab-trigger gap-2">
                <Package className="w-4 h-4" />
                <span>Itens</span>
              </TabsTrigger>
              <TabsTrigger value="pecas" className="page-tab-trigger gap-2">
                <Package className="w-4 h-4" />
                <span>Peças</span>
              </TabsTrigger>
              <TabsTrigger value="operadores" className="page-tab-trigger gap-2">
                <Users className="w-4 h-4" />
                <span>Operadores</span>
              </TabsTrigger>
              <TabsTrigger value="diferencas" className="page-tab-trigger gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Diferenças</span>
              </TabsTrigger>
            </TabsList>
            </div>

            {/* Resumo Mensal Tab */}
            <TabsContent value="resumo" className="space-y-6">
              {/* KPI Cards */}
              {directory.isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Carregando resumo dos caixas">
                  {[0, 1, 2].map((item) => (
                    <Card key={item} className="h-[102px] animate-pulse border-l-4 border-l-muted bg-muted/30" />
                  ))}
                </div>
              ) : !directory.isError ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <Card className="p-4 border-l-4 border-l-primary">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-medium text-primary uppercase tracking-wide">
                        TOTAL VENDAS
                      </p>
                      <p className="text-2xl font-black text-foreground mt-1">
                        {formatCurrency(totals?.total_vendas ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totals?.quantidade ?? 0} caixas fechados
                      </p>
                    </div>
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                </Card>

                <Card className="p-4 border-l-4 border-l-violet-500">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">
                        MÉDIA POR CAIXA
                      </p>
                      <p className="text-2xl font-black text-foreground mt-1">
                        {formatCurrency(totals?.media_por_caixa ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Valor médio dos fechamentos
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
                        (totals?.total_diferencas ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {(totals?.total_diferencas ?? 0) >= 0 ? "+ " : ""}
                        {formatCurrency(totals?.total_diferencas ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totals?.quantidade_com_diferenca ?? 0} fechamento(s) divergente(s)
                      </p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                </Card>
              </div>
              ) : null}

              {/* Closed Registers List */}
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                      <h2 className="font-semibold text-foreground">
                        Caixas fechados — {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Busca, divergências e totais usam o mesmo recorte autorizado.
                    </p>
                  </div>
                  {directory.isFetching && !directory.isLoading && (
                    <span className="text-xs text-muted-foreground">Atualizando resultados…</span>
                  )}
                </div>

                <Card className="p-3 sm:p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setDirectoryParam("caixa_busca", event.target.value)}
                        placeholder="Buscar por operador ou identificação"
                        aria-label="Buscar caixas por operador ou identificação"
                        className="min-h-11 pl-9"
                      />
                    </div>
                    <Select value={difference} onValueChange={(value) => setDirectoryParam("caixa_diferenca", value)}>
                      <SelectTrigger className="min-h-11" aria-label="Filtrar caixas por diferença">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as diferenças</SelectItem>
                        <SelectItem value="com">Com diferença</SelectItem>
                        <SelectItem value="sem">Sem diferença</SelectItem>
                        <SelectItem value="sobra">Somente sobras</SelectItem>
                        <SelectItem value="falta">Somente faltas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                {directory.isLoading ? (
                  <div className="flex items-center justify-center py-16" aria-label="Carregando caixas fechados">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : directory.isError ? (
                  <Card className="border-red-200 bg-red-50/60 p-6 text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
                    <p className="mt-3 font-semibold text-red-900">Não foi possível carregar os fechamentos</p>
                    <p className="mt-1 text-sm text-red-700">Nenhum total foi substituído por zero.</p>
                    <Button variant="outline" className="mt-4 min-h-11 gap-2" onClick={() => void directory.refetch()}>
                      <RefreshCw className="h-4 w-4" /> Tentar novamente
                    </Button>
                  </Card>
                ) : caixasFechados.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
                      <Lock className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium text-foreground">Nenhum fechamento encontrado</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search || difference !== "todos"
                        ? "Ajuste os filtros para ampliar a consulta."
                        : "Ainda não há caixa fechado neste período."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {caixasFechados.map((caixa) => (
                      <Card key={caixa.id} className="p-4 transition-colors hover:bg-muted/20">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Lock className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                {caixa.data_fechamento 
                                  ? format(new Date(caixa.data_fechamento), "dd/MM/yyyy", { locale: ptBR })
                                  : "-"}
                              </p>
                              <p className="break-words text-sm text-muted-foreground">
                                {caixa.operador} • Fechado às {caixa.data_fechamento 
                                  ? format(new Date(caixa.data_fechamento), "HH:mm")
                                  : "-"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">Caixa {caixa.identificador_caixa}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t pt-3 sm:justify-end sm:border-0 sm:pt-0">
                            <div className="text-left sm:text-right">
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
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-11 w-11 shrink-0 text-muted-foreground"
                              onClick={() => handleViewCaixa(caixa)}
                              aria-label={`Ver fechamento de ${caixa.operador}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {!directory.isError && (directory.data?.total ?? 0) > 0 && (
                  <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Exibindo {((page - 1) * (directory.data?.tamanho_pagina ?? 12)) + 1}–{Math.min(
                        page * (directory.data?.tamanho_pagina ?? 12),
                        directory.data?.total ?? 0,
                      )} de {directory.data?.total ?? 0} fechamentos
                    </p>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        className="min-h-11 gap-2"
                        disabled={page <= 1 || directory.isFetching}
                        onClick={() => setDirectoryParam("caixa_pagina", String(page - 1))}
                        aria-label="Página anterior de caixas"
                      >
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </Button>
                      <span className="min-w-20 text-center text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                      <Button
                        variant="outline"
                        className="min-h-11 gap-2"
                        disabled={page >= totalPages || directory.isFetching}
                        onClick={() => setDirectoryParam("caixa_pagina", String(page + 1))}
                        aria-label="Próxima página de caixas"
                      >
                        Próxima <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
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
