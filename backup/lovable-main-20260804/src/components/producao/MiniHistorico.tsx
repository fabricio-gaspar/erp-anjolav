import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Truck,
  Scissors,
  Droplets,
  Wind,
  Package,
  CheckCircle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoricoProducao } from "@/hooks/useHistoricoProducao";

interface MiniHistoricoProps {
  historico: HistoricoProducao[];
  maxItems?: number;
}

const etapaConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  retirada: { icon: Truck, color: "text-warning", bgColor: "bg-warning/20", label: "Retirado" },
  separacao: { icon: Scissors, color: "text-info", bgColor: "bg-info/20", label: "Separação" },
  lavagem: { icon: Droplets, color: "text-primary", bgColor: "bg-primary/20", label: "Lavagem" },
  secagem: { icon: Timer, color: "text-primary", bgColor: "bg-primary/20", label: "Secagem" },
  passadoria: { icon: Wind, color: "text-purple-500", bgColor: "bg-purple-500/20", label: "Passadoria" },
  embalagem: { icon: Package, color: "text-success", bgColor: "bg-success/20", label: "Embalagem" },
  expedicao: { icon: CheckCircle, color: "text-success", bgColor: "bg-success/20", label: "Pronto Entrega" },
  entregue: { icon: CheckCircle, color: "text-muted-foreground", bgColor: "bg-muted", label: "Entregue" },
};

export function MiniHistorico({ historico, maxItems = 4 }: MiniHistoricoProps) {
  const ultimosRegistros = historico.slice(-maxItems);

  if (ultimosRegistros.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {ultimosRegistros.map((registro, index) => {
          const config = etapaConfig[registro.etapa_nova] || {
            icon: CheckCircle,
            color: "text-muted-foreground",
            bgColor: "bg-muted",
            label: registro.etapa_nova,
          };
          const Icon = config.icon;
          const isLast = index === ultimosRegistros.length - 1;

          // Extrair dados do formulário
          const dados = registro.dados_formulario as Record<string, unknown> || {};
          const pecas = dados.quantidade_pecas as number;
          const peso = dados.peso_total_kg as number || dados.peso_final_kg as number;

          return (
            <Tooltip key={registro.id}>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full w-5 h-5 transition-transform hover:scale-110",
                      config.bgColor,
                      isLast ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                    )}
                  >
                    <Icon className={cn("h-3 w-3", config.color)} />
                  </div>
                  {index < ultimosRegistros.length - 1 && (
                    <div className="w-2 h-0.5 bg-border" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(registro.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {registro.funcionario?.nome && (
                    <p className="text-xs">Por: {registro.funcionario.nome}</p>
                  )}
                  {pecas && <p className="text-xs">Peças: {pecas}</p>}
                  {peso && <p className="text-xs">Peso: {peso}kg</p>}
                  {registro.tempo_na_etapa_anterior && (
                    <p className="text-xs text-muted-foreground">
                      Tempo anterior: {registro.tempo_na_etapa_anterior}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

// Componente para extrair dados resumidos do histórico
export function extrairDadosHistorico(historico: HistoricoProducao[]) {
  let quantidadePecas = 0;
  let pesoTotal = 0;
  let ultimoFuncionario: string | null = null;

  historico.forEach((registro) => {
    const dados = registro.dados_formulario as Record<string, unknown> || {};
    
    if (dados.quantidade_pecas) {
      quantidadePecas = dados.quantidade_pecas as number;
    }
    if (dados.peso_total_kg) {
      pesoTotal = dados.peso_total_kg as number;
    }
    if (dados.peso_final_kg) {
      pesoTotal = dados.peso_final_kg as number;
    }
    if (registro.funcionario?.nome) {
      ultimoFuncionario = registro.funcionario.nome;
    }
  });

  return { quantidadePecas, pesoTotal, ultimoFuncionario };
}
