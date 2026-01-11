import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FormularioEtapa } from "@/components/producao/FormularioEtapa";

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
  { id: "entregue", title: "ENTREGUE", icon: CheckCircle, iconColor: "text-muted-foreground" },
];

const FluxoProducao = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOS, setSelectedOS] = useState<{ id: string; status: string; next: string } | null>(null);

  const { ordensServico, isLoading, error } = useOrdensServico();

  // Agrupar OS por status
  const osByStatus = useMemo(() => {
    const grouped: Record<string, typeof ordensServico> = {};
    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    ordensServico
      .filter((os) => os.status !== "cancelada")
      .filter(
        (os) =>
          os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
          os.cliente?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .forEach((os) => {
        if (grouped[os.status]) {
          grouped[os.status].push(os);
        }
      });

    return grouped;
  }, [ordensServico, searchTerm]);

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
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fluxo de Produção</h1>
          <p className="text-sm text-muted-foreground">
            {totalEmProcessamento} {totalEmProcessamento === 1 ? "ordem" : "ordens"} em processamento
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente ou OS..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Data Previsão
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Prioridade
            </Button>
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
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnItems = osByStatus[column.id] || [];
              return (
                <div key={column.id} className="flex-shrink-0 w-[220px]">
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
                  <div className="bg-muted/30 rounded-lg p-2 min-h-[400px]">
                    {columnItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">
                        Nenhuma OS
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {columnItems.map((os) => (
                          <div
                            key={os.id}
                            onClick={() => handleCardClick(os.id, os.status, column.nextStatus)}
                            className={cn(
                              "bg-card border rounded-lg p-3 shadow-sm transition-shadow",
                              column.nextStatus
                                ? "cursor-pointer hover:shadow-md hover:border-primary/50"
                                : ""
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="text-xs font-mono text-primary">
                                {os.numero}
                              </span>
                              <StatusBadge
                                variant={getPrioridadeVariant(os.prioridade)}
                                className="text-[10px]"
                              >
                                {os.prioridade || "normal"}
                              </StatusBadge>
                            </div>
                            <p className="font-semibold text-sm text-foreground mb-2 line-clamp-1">
                              {os.cliente?.razao_social || "Cliente não definido"}
                            </p>
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
                            <div className="mt-2">
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
