import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Calendar,
  Filter,
  RefreshCw,
  Clock,
  Loader2,
  Scale,
  Shirt,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFilteredOrdensServico } from "@/hooks/useFilteredOrdensServico";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useHistoricoMultiplasOS } from "@/hooks/useHistoricoProducaoResumo";
import { useAgendamentosRetiradaPendentes } from "@/hooks/useFluxoProducao";
import { format, formatDistanceToNow, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FormularioEtapa } from "@/components/producao/FormularioEtapa";
import { MiniHistorico, extrairDadosHistorico } from "@/components/producao/MiniHistorico";
import { AgendamentoCard } from "@/components/producao/AgendamentoCard";
import { FinalizadasLista } from "@/components/producao/FinalizadasLista";
import {
  ExpeditionWorkspace,
  ProductionQueueWorkspace,
} from "@/components/producao/ProductionQueueWorkspace";
import { getNextProductionStage, productionColumns } from "@/lib/productionWorkflow";

const FluxoProducao = () => {
  const { activeArea } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOS, setSelectedOS] = useState<{ id: string; status: string; next: string } | null>(null);
  const [filtroPrevisao, setFiltroPrevisao] = useState<Date | null>(null);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string | null>(null);

  const { data: ordensServico = [], isLoading, error } = useFilteredOrdensServico();
  const { data: agendamentosPendentes = [] } = useAgendamentosRetiradaPendentes();

  const osIds = useMemo(() => ordensServico.map((os) => os.id), [ordensServico]);
  const { data: historicosPorOS = {} } = useHistoricoMultiplasOS(osIds);

  const osByStatus = useMemo(() => {
    const grouped: Record<string, typeof ordensServico> = {};
    productionColumns.forEach((col) => {
      grouped[col.id] = [];
    });

    ordensServico
      .filter((os) => {
        if (os.status === "cancelada" || os.status === "entregue") return false;
        // Workspace filtering is now handled by the hook
        return true;
      })
      .filter(
        (os) =>
          os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
          os.cliente?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .filter((os) => {
        if (!filtroPrevisao) return true;
        if (!os.data_previsao_entrega) return false;
        return isSameDay(parseISO(os.data_previsao_entrega), filtroPrevisao);
      })
      .filter((os) => {
        if (!filtroPrioridade) return true;
        return os.prioridade === filtroPrioridade;
      })
      .forEach((os) => {
        const col = productionColumns.find((c) => (c.statuses as readonly string[]).includes(os.status));
        if (col) grouped[col.id].push(os);
      });

    return grouped;
  }, [ordensServico, searchTerm, filtroPrevisao, filtroPrioridade]);

  const totalEmProducao = ordensServico.filter(
    (os) => !["entregue", "cancelada", "retirada"].includes(os.status)
  ).length;
  const totalProntas = ordensServico.filter((os) => os.status === "expedicao").length;
  const totalAguardando = agendamentosPendentes.length + (osByStatus["retirada"]?.length || 0);

  const handleCardClick = (osId: string, currentStatus: string, nextStatus?: string) => {
    if (nextStatus) {
      setSelectedOS({ id: osId, status: currentStatus, next: nextStatus });
    }
  };

  const handleOrderAdvance = (order: (typeof ordensServico)[number], nextStatus: string) => {
    setSelectedOS({ id: order.id, status: order.status, next: nextStatus });
  };

  const getPrioridadeVariant = (prioridade: string | null) => {
    switch (prioridade) {
      case "urgente": return "danger";
      case "alta": return "warning";
      case "baixa": return "default";
      default: return "success";
    }
  };

  const subtitle = `${totalAguardando} aguardando · ${totalEmProducao} em produção · ${totalProntas} prontas`;

  return (
    <AppLayout title="Fluxo de Produção" subtitle={`${subtitle} - ${activeArea.charAt(0).toUpperCase() + activeArea.slice(1)}`}>
      <div className="page-shell">
        <PageHeader
          eyebrow={`Produção ${activeArea === "residencial" ? "doméstica" : "industrial"}`}
          title="Fluxo de Produção"
          description="Filas por etapa, prazo e prioridade com operação individual ou em lote"
        />

        <div className="content-panel">
        <Tabs defaultValue="filas" className="space-y-3">
          <TabsList className="page-tabs-list">
            <TabsTrigger value="filas" className="page-tab-trigger">Filas</TabsTrigger>
            <TabsTrigger value="kanban" className="page-tab-trigger">Kanban</TabsTrigger>
            <TabsTrigger value="expedicao" className="page-tab-trigger">Expedição</TabsTrigger>
            <TabsTrigger value="finalizadas" className="page-tab-trigger">Finalizadas</TabsTrigger>
          </TabsList>

          <TabsContent value="filas" className="mt-0">
            <ProductionQueueWorkspace
              orders={ordensServico}
              isLoading={isLoading}
              onAdvance={handleOrderAdvance}
            />
          </TabsContent>

          <TabsContent value="kanban" className="space-y-3 mt-0">
            {/* Filters */}
            <div className="page-toolbar">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou ROL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={filtroPrevisao ? "default" : "outline"} size="sm" className="gap-2 h-9 hidden sm:flex">
                      <Calendar className="w-4 h-4" />
                      <span className="hidden md:inline">
                        {filtroPrevisao ? format(filtroPrevisao, "dd/MM", { locale: ptBR }) : "Previsão"}
                      </span>
                      {filtroPrevisao && (
                        <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setFiltroPrevisao(null); }} />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={filtroPrevisao || undefined} onSelect={(d) => setFiltroPrevisao(d || null)} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={filtroPrioridade ? "default" : "outline"} size="sm" className="gap-2 h-9 hidden sm:flex">
                      <Filter className="w-4 h-4" />
                      <span className="hidden md:inline">
                        {filtroPrioridade ? filtroPrioridade.charAt(0).toUpperCase() + filtroPrioridade.slice(1) : "Prioridade"}
                      </span>
                      {filtroPrioridade && (
                        <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setFiltroPrioridade(null); }} />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setFiltroPrioridade("urgente")}>Urgente</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFiltroPrioridade("alta")}>Alta</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFiltroPrioridade("normal")}>Normal</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFiltroPrioridade("baixa")}>Baixa</DropdownMenuItem>
                    {filtroPrioridade && (
                      <DropdownMenuItem onClick={() => setFiltroPrioridade(null)}>
                        <X className="w-3 h-3 mr-2" /> Limpar filtro
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando...</span>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">Erro ao carregar ROLs</div>
            ) : (
              <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-3 min-w-[1200px] xl:grid xl:grid-cols-6 xl:min-w-0">
                  {productionColumns.map((column) => {
                    const columnItems = osByStatus[column.id] || [];
                    const agendamentosNaColuna = column.id === "retirada" ? agendamentosPendentes : [];
                    const totalCount = columnItems.length + agendamentosNaColuna.length;

                    return (
                      <div key={column.id} className="min-w-[260px] lg:min-w-0">
                        <div className="flex items-center gap-2 mb-3 px-2">
                          <column.icon className={cn("w-4 h-4", column.iconColor)} />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {column.title}
                          </span>
                          <Badge variant="secondary" className={cn(
                            "rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]",
                            totalCount > 0 ? "bg-success text-success-foreground" : ""
                          )}>
                            {totalCount}
                          </Badge>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-2 min-h-[400px] max-h-[calc(100vh-260px)] overflow-y-auto">
                          {totalCount === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">Nenhum ROL</p>
                          ) : (
                            <div className="space-y-2">
                              {agendamentosNaColuna.map((ag) => (
                                <AgendamentoCard key={`ag-${ag.id}`} agendamento={ag} />
                              ))}

                              {columnItems.map((os) => {
                                const historico = historicosPorOS[os.id] || [];
                                const { quantidadePecas, pesoTotal, ultimoFuncionario } = extrairDadosHistorico(historico);
                                return (
                                  <div
                                    key={os.id}
                                    onClick={() => handleCardClick(os.id, os.status, getNextProductionStage(os.status) || undefined)}
                                    className={cn(
                                      "bg-card border rounded-lg p-3 shadow-sm transition-all",
                                      getNextProductionStage(os.status) ? "cursor-pointer hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5" : ""
                                    )}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <span className="text-xs font-mono font-semibold text-primary">{os.numero}</span>
                                      <StatusBadge variant={getPrioridadeVariant(os.prioridade)} className="text-[10px]">
                                        {os.prioridade || "normal"}
                                      </StatusBadge>
                                    </div>
                                    <p className="font-semibold text-sm text-foreground mb-2 line-clamp-1">
                                      {os.cliente?.razao_social || "Cliente não definido"}
                                    </p>
                                    {(quantidadePecas > 0 || pesoTotal > 0) && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 bg-muted/50 rounded px-2 py-1">
                                        {quantidadePecas > 0 && (
                                          <div className="flex items-center gap-1"><Shirt className="w-3 h-3" /><span>{quantidadePecas} pç</span></div>
                                        )}
                                        {pesoTotal > 0 && (
                                          <div className="flex items-center gap-1"><Scale className="w-3 h-3" /><span>{pesoTotal.toFixed(1)}kg</span></div>
                                        )}
                                      </div>
                                    )}
                                    {historico.length > 0 && (
                                      <div className="mb-2 py-1 border-t border-b border-border/50">
                                        <MiniHistorico historico={historico} maxItems={4} />
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Calendar className="w-3 h-3" />
                                      <span>Prev.: {os.data_previsao_entrega ? format(parseISO(os.data_previsao_entrega), "dd/MM", { locale: ptBR }) : "-"}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                      <Badge variant="secondary" className="text-[10px] bg-info/10 text-info">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {formatDistanceToNow(new Date(os.created_at), { locale: ptBR, addSuffix: false })}
                                      </Badge>
                                      {ultimoFuncionario && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                          <User className="w-3 h-3" />
                                          <span className="truncate max-w-[60px]">{ultimoFuncionario}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="expedicao" className="mt-0">
            <ExpeditionWorkspace
              orders={ordensServico}
              histories={historicosPorOS}
              onAdvance={handleOrderAdvance}
            />
          </TabsContent>

          <TabsContent value="finalizadas" className="mt-0">
            <FinalizadasLista />
          </TabsContent>
        </Tabs>
      </div>
    </div>

      {selectedOS && (
        <FormularioEtapa
          ordemServicoId={selectedOS.id}
          etapaAtual={selectedOS.status}
          proximaEtapa={selectedOS.next}
          onClose={() => setSelectedOS(null)}
          onSuccess={() => setSelectedOS(null)}
        />
      )}
    </AppLayout>
  );
};

export default FluxoProducao;
