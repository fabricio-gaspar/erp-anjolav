import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrdemServico {
  id: string;
  numero: string;
  cliente: string;
  previsao?: string;
  prioridade: "normal" | "urgente" | "express";
  tempoProcesso: string;
  status: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  icon: React.ElementType;
  iconColor: string;
  count: number;
  items: OrdemServico[];
}

const mockColumns: KanbanColumn[] = [
  {
    id: "retirado",
    title: "RETIRADO",
    icon: Truck,
    iconColor: "text-warning",
    count: 1,
    items: [
      {
        id: "1",
        numero: "OS-32210005",
        cliente: "FABRICIO GASPAR",
        prioridade: "normal",
        tempoProcesso: "2d em processo",
        status: "retirado",
      },
    ],
  },
  {
    id: "separacao",
    title: "SEPARAÇÃO",
    icon: Scissors,
    iconColor: "text-info",
    count: 0,
    items: [],
  },
  {
    id: "lavagem",
    title: "LAVAGEM",
    icon: Droplets,
    iconColor: "text-primary",
    count: 0,
    items: [],
  },
  {
    id: "passadoria",
    title: "PASSADORIA",
    icon: Wind,
    iconColor: "text-purple-500",
    count: 0,
    items: [],
  },
  {
    id: "embalagem",
    title: "EMBALAGEM",
    icon: Package,
    iconColor: "text-success",
    count: 0,
    items: [],
  },
  {
    id: "pronto_entrega",
    title: "PRONTO ENTREGA",
    icon: CheckCircle,
    iconColor: "text-success",
    count: 0,
    items: [],
  },
  {
    id: "entrega_finalizada",
    title: "ENTREGA FINALIZADA",
    icon: CheckCircle,
    iconColor: "text-muted-foreground",
    count: 0,
    items: [],
  },
];

const FluxoProducao = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [columns] = useState(mockColumns);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fluxo de Produção</h1>
          <p className="text-sm text-muted-foreground">2 ordens em processamento</p>
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
              Ordenação Padrão
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-[200px]">
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
                    column.count > 0 ? "bg-success text-success-foreground" : ""
                  )}
                >
                  {column.count}
                </Badge>
              </div>

              {/* Column Content */}
              <div className="bg-muted/30 rounded-lg p-2 min-h-[400px]">
                {column.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma OS
                  </p>
                ) : (
                  <div className="space-y-2">
                    {column.items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-card border rounded-lg p-3 shadow-sm cursor-grab hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-mono text-primary">
                            {item.numero}
                          </span>
                          <StatusBadge
                            variant={
                              item.prioridade === "urgente"
                                ? "danger"
                                : item.prioridade === "express"
                                ? "warning"
                                : "success"
                            }
                            className="text-[10px]"
                          >
                            {item.prioridade}
                          </StatusBadge>
                        </div>
                        <p className="font-semibold text-sm text-foreground mb-2">
                          {item.cliente}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          Prev.: {item.previsao || "-"}
                        </div>
                        <div className="mt-2">
                          <Badge variant="secondary" className="text-[10px] bg-info-light text-info">
                            <Clock className="w-3 h-3 mr-1" />
                            {item.tempoProcesso}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default FluxoProducao;
