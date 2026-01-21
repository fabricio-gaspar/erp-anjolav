import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
  Truck,
  Scissors,
  Droplets,
  Wind,
  Package,
  CheckCircle,
  Clock,
  Loader2,
  Timer,
  Scale,
  Shirt,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useHistoricoMultiplasOS } from "@/hooks/useHistoricoProducaoResumo";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FormularioEtapa } from "@/components/producao/FormularioEtapa";
import { MiniHistorico, extrairDadosHistorico } from "@/components/producao/MiniHistorico";

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  nextStatus?: string;
}

const columns: KanbanColumn[] = [
  { id: "retirada", title: "RETIRADO", icon: Truck, iconColor: "text-warning", nextStatus: "separacao" },
  { id: "separacao", title: "SEPARAÇÃO", icon: Scissors, iconColor: "text-info", nextStatus: "lavagem" },
  { id: "lavagem", title: "LAVAGEM", icon: Droplets, iconColor: "text-primary", nextStatus: "secagem" },
  { id: "secagem", title: "SECAGEM", icon: Timer, iconColor: "text-primary", nextStatus: "passadoria" },
  { id: "passadoria", title: "PASSADORIA", icon: Wind, iconColor: "text-purple-500", nextStatus: "embalagem" },
  { id: "embalagem", title: "EMBALAGEM", icon: Package, iconColor: "text-success", nextStatus: "expedicao" },
  { id: "expedicao", title: "PRONTO ENTREGA", icon: CheckCircle, iconColor: "text-success", nextStatus: "entregue" },
  { id: "entregue", title: "ENTREGUE", icon: CheckCircle, iconColor: "text-emerald-600" },
];

const FluxoProducao = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOS, setSelectedOS] = useState<{ id: string; status: string; next: string } | null>(null);
  const [filtroPrevisao, setFiltroPrevisao] = useState<Date | null>(null);
  const [filtroPrioridade, setFiltroPrioridade] = useState<string | null>(null);

  const { ordensServico, isLoading, error } = useOrdensServico();

  // IDs das OS para buscar histórico
  const osIds = useMemo(() => ordensServico.map((os) => os.id), [ordensServico]);
  const { data: historicosPorOS = {} } = useHistoricoMultiplasOS(osIds);

  // Agrupar OS por status (excluindo "entregue" e "cancelada" do fluxo)
  const osByStatus = useMemo(() => {
    const grouped: Record<string, typeof ordensServico> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    ordensServico
      .filter((os) => {
        if (os.status === "cancelada") return false;
        // Mostrar entregues apenas do dia atual
        if (os.status === "entregue") {
          const hoje = new Date().toISOString().split("T")[0];
          const dataOS = os.updated_at?.split("T")[0];
          return dataOS === hoje;
        }
        return true;
      })
      .filter(
        (os) =>
          os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
          os.cliente?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      // Filtro de previsão de entrega
      .filter((os) => {
        if (!filtroPrevisao) return true;
        if (!os.data_previsao_entrega) return false;
        return isSameDay(new Date(os.data_previsao_entrega), filtroPrevisao);
      })
      // Filtro de prioridade
      .filter((os) => {
        if (!filtroPrioridade) return true;
        return os.prioridade === filtroPrioridade;
      })
      .forEach((os) => {
        if (grouped[os.status]) {
          grouped[os.status].push(os);
        }
      });

    return grouped;
  }, [ordensServico, searchTerm, filtroPrevisao, filtroPrioridade]);

  const totalEmProcessamento = ordensServico.filter(
    (os) => !["entregue", "cancelada"].includes(os.status)
  ).length;

  const handleCardClick = (osId: string, currentStatus: string, nextStatus?: string) => {
    if (nextStatus) {
      setSelectedOS({ id: osId, status: currentStatus, next: nextStatus });
    }
  };

  const getPrioridadeVariant = (prioridade: string | null) => {
    switch (prioridade) {
      case "urgente":
        return "danger";
      case "alta":
        return "warning";
      case "baixa":
        return "default";
      default:
        return "success";
    }
  };

  return (
    <AppLayout 
      title="Fluxo de Produção" 
      subtitle={`${totalEmProcessamento} ${totalEmProcessamento === 1 ? "ordem" : "ordens"} em processamento`}
    >
      <div className="content-panel">
        <div className="space-y-3">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou OS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filtro de Data Previsão */}
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant={filtroPrevisao ? "default" : "outline"} 
                  size="sm" 
                  className="gap-2 h-9 hidden sm:flex"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden md:inline">
                    {filtroPrevisao 
                      ? format(filtroPrevisao, "dd/MM", { locale: ptBR }) 
                      : "Data Previsão"}
                  </span>
                  {filtroPrevisao && (
                    <X 
                      className="w-3 h-3 ml-1" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiltroPrevisao(null);
                      }} 
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={filtroPrevisao || undefined}
                  onSelect={(date) => setFiltroPrevisao(date || null)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {/* Filtro de Prioridade */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant={filtroPrioridade ? "default" : "outline"} 
                  size="sm" 
                  className="gap-2 h-9 hidden sm:flex"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden md:inline">
                    {filtroPrioridade 
                      ? filtroPrioridade.charAt(0).toUpperCase() + filtroPrioridade.slice(1)
                      : "Prioridade"}
                  </span>
                  {filtroPrioridade && (
                    <X 
                      className="w-3 h-3 ml-1" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiltroPrioridade(null);
                      }} 
                    />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFiltroPrioridade("urgente")}>
                  <span className="w-2 h-2 rounded-full bg-destructive mr-2" />
                  Urgente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFiltroPrioridade("alta")}>
                  <span className="w-2 h-2 rounded-full bg-warning mr-2" />
                  Alta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFiltroPrioridade("normal")}>
                  <span className="w-2 h-2 rounded-full bg-success mr-2" />
                  Normal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFiltroPrioridade("baixa")}>
                  <span className="w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                  Baixa
                </DropdownMenuItem>
                {filtroPrioridade && (
                  <DropdownMenuItem onClick={() => setFiltroPrioridade(null)}>
                    <X className="w-3 h-3 mr-2" />
                    Limpar filtro
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando ordens...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            Erro ao carregar ordens de serviço
          </div>
        ) : (
          <div className="overflow-x-auto pb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
            <div className="flex gap-3 min-w-max lg:grid lg:grid-cols-8 lg:min-w-0">
            {columns.map((column) => {
              const columnItems = osByStatus[column.id] || [];
              return (
                <div key={column.id} className="min-w-[260px] lg:min-w-0">
                  {/* Column Header */}
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <column.icon className={cn("w-4 h-4", column.iconColor)} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {column.title}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]",
                        columnItems.length > 0 ? "bg-success text-success-foreground" : ""
                      )}
                    >
                      {columnItems.length}
                    </Badge>
                  </div>

                  {/* Column Content */}
                  <div className="bg-muted/30 rounded-lg p-2 min-h-[400px] max-h-[calc(100vh-220px)] overflow-y-auto">
                    {columnItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Nenhuma OS
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {columnItems.map((os) => {
                          const historico = historicosPorOS[os.id] || [];
                          const { quantidadePecas, pesoTotal, ultimoFuncionario } = extrairDadosHistorico(historico);

                          return (
                            <div
                              key={os.id}
                              onClick={() => handleCardClick(os.id, os.status, column.nextStatus)}
                              className={cn(
                                "bg-card border rounded-lg p-3 shadow-sm transition-all",
                                column.nextStatus
                                  ? "cursor-pointer hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5"
                                  : ""
                              )}
                            >
                              {/* Header: Número e Prioridade */}
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-xs font-mono font-semibold text-primary">
                                  {os.numero}
                                </span>
                                <StatusBadge
                                  variant={getPrioridadeVariant(os.prioridade)}
                                  className="text-[10px]"
                                >
                                  {os.prioridade || "normal"}
                                </StatusBadge>
                              </div>

                              {/* Cliente */}
                              <p className="font-semibold text-sm text-foreground mb-2 line-clamp-1">
                                {os.cliente?.razao_social || "Cliente não definido"}
                              </p>

                              {/* Dados do Histórico: Peças e Peso */}
                              {(quantidadePecas > 0 || pesoTotal > 0) && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 bg-muted/50 rounded px-2 py-1">
                                  {quantidadePecas > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Shirt className="w-3 h-3" />
                                      <span>{quantidadePecas} pç</span>
                                    </div>
                                  )}
                                  {pesoTotal > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Scale className="w-3 h-3" />
                                      <span>{pesoTotal.toFixed(1)}kg</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Mini Histórico Timeline */}
                              {historico.length > 0 && (
                                <div className="mb-2 py-1 border-t border-b border-border/50">
                                  <MiniHistorico historico={historico} maxItems={4} />
                                </div>
                              )}

                              {/* Data Previsão */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  Prev.:{" "}
                                  {os.data_previsao_entrega
                                    ? format(new Date(os.data_previsao_entrega), "dd/MM", {
                                        locale: ptBR,
                                      })
                                    : "-"}
                                </span>
                              </div>

                              {/* Footer: Tempo e Funcionário */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] bg-info/10 text-info"
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  {formatDistanceToNow(new Date(os.created_at), {
                                    locale: ptBR,
                                    addSuffix: false,
                                  })}
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
        </div>
      </div>

      {/* Modal de Formulário */}
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
