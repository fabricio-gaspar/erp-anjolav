import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Truck,
  Scissors,
  Droplets,
  Wind,
  Package,
  CheckCircle,
  XCircle,
  Timer,
  Thermometer,
  User,
  Scale,
  Shirt,
  Box,
  Car,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { HistoricoProducao } from "@/hooks/useHistoricoProducao";

interface HistoricoTimelineProps {
  historico: HistoricoProducao[];
}

const etapaConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  retirada: { icon: Truck, color: "text-warning", label: "Retirado" },
  separacao: { icon: Scissors, color: "text-info", label: "Separação" },
  lavagem: { icon: Droplets, color: "text-primary", label: "Lavagem" },
  secagem: { icon: Timer, color: "text-primary", label: "Secagem" },
  passadoria: { icon: Wind, color: "text-purple-500", label: "Passadoria" },
  embalagem: { icon: Package, color: "text-success", label: "Embalagem" },
  expedicao: { icon: CheckCircle, color: "text-success", label: "Pronto Entrega" },
  entregue: { icon: CheckCircle, color: "text-muted-foreground", label: "Entregue" },
  cancelada: { icon: XCircle, color: "text-destructive", label: "Cancelada" },
};

function renderDadosEtapa(etapa: string, dados: Record<string, unknown>) {
  if (!dados || Object.keys(dados).length === 0) return null;

  const items: React.ReactNode[] = [];

  switch (etapa) {
    case "separacao":
      if (dados.quantidade_pecas) {
        items.push(
          <div key="pecas" className="flex items-center gap-2">
            <Shirt className="w-3 h-3 text-muted-foreground" />
            <span>Peças: <strong>{String(dados.quantidade_pecas)}</strong></span>
          </div>
        );
      }
      if (dados.peso_total_kg) {
        items.push(
          <div key="peso" className="flex items-center gap-2">
            <Scale className="w-3 h-3 text-muted-foreground" />
            <span>Peso: <strong>{String(dados.peso_total_kg)}kg</strong></span>
          </div>
        );
      }
      if (dados.itens_danificados) {
        items.push(
          <div key="danos" className="flex items-start gap-2 mt-1">
            <FileText className="w-3 h-3 text-destructive mt-0.5" />
            <span className="text-destructive">Avarias: {dados.itens_danificados as string}</span>
          </div>
        );
      }
      break;

    case "lavagem":
    case "secagem":
      if (dados.maquina_utilizada) {
        items.push(
          <div key="maquina" className="flex items-center gap-2">
            <Box className="w-3 h-3 text-muted-foreground" />
            <span>Máquina: <strong>{dados.maquina_utilizada as string}</strong></span>
          </div>
        );
      }
      if (dados.temperatura) {
        items.push(
          <div key="temp" className="flex items-center gap-2">
            <Thermometer className="w-3 h-3 text-muted-foreground" />
            <span>Temperatura: <strong>{String(dados.temperatura)}°C</strong></span>
          </div>
        );
      }
      if (dados.produtos_utilizados) {
        items.push(
          <div key="produtos" className="flex items-start gap-2 mt-1">
            <Package className="w-3 h-3 text-muted-foreground mt-0.5" />
            <span>Produtos: {dados.produtos_utilizados as string}</span>
          </div>
        );
      }
      break;

    case "passadoria":
      if (dados.tipo_acabamento) {
        items.push(
          <div key="acabamento" className="flex items-center gap-2">
            <Wind className="w-3 h-3 text-muted-foreground" />
            <span>Acabamento: <Badge variant="secondary" className="text-[10px] ml-1">{dados.tipo_acabamento as string}</Badge></span>
          </div>
        );
      }
      if (dados.quantidade_passada) {
        items.push(
          <div key="qtd" className="flex items-center gap-2">
            <Shirt className="w-3 h-3 text-muted-foreground" />
            <span>Qtd processada: <strong>{String(dados.quantidade_passada)}</strong></span>
          </div>
        );
      }
      if (dados.observacoes_qualidade) {
        items.push(
          <div key="qualidade" className="flex items-start gap-2 mt-1">
            <FileText className="w-3 h-3 text-muted-foreground mt-0.5" />
            <span>Qualidade: {dados.observacoes_qualidade as string}</span>
          </div>
        );
      }
      break;

    case "embalagem":
      if (dados.tipo_embalagem) {
        items.push(
          <div key="tipo" className="flex items-center gap-2">
            <Package className="w-3 h-3 text-muted-foreground" />
            <span>Tipo: <Badge variant="secondary" className="text-[10px] ml-1">{dados.tipo_embalagem as string}</Badge></span>
          </div>
        );
      }
      if (dados.quantidade_volumes) {
        items.push(
          <div key="volumes" className="flex items-center gap-2">
            <Box className="w-3 h-3 text-muted-foreground" />
            <span>Volumes: <strong>{String(dados.quantidade_volumes)}</strong></span>
          </div>
        );
      }
      if (dados.peso_final_kg) {
        items.push(
          <div key="peso" className="flex items-center gap-2">
            <Scale className="w-3 h-3 text-muted-foreground" />
            <span>Peso final: <strong>{String(dados.peso_final_kg)}kg</strong></span>
          </div>
        );
      }
      if (dados.pronto_para_entrega) {
        items.push(
          <div key="pronto" className="flex items-center gap-2 mt-1">
            <CheckCircle className="w-3 h-3 text-success" />
            <span className="text-success">Pronto para entrega</span>
          </div>
        );
      }
      break;

    case "entregue":
      if (dados.data_hora_entrega) {
        items.push(
          <div key="data" className="flex items-center gap-2">
            <Timer className="w-3 h-3 text-muted-foreground" />
            <span>Entregue em: <strong>{format(new Date(dados.data_hora_entrega as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></span>
          </div>
        );
      }
      if (dados.motorista_id) {
        items.push(
          <div key="motorista" className="flex items-center gap-2">
            <Car className="w-3 h-3 text-muted-foreground" />
            <span>Motorista vinculado</span>
          </div>
        );
      }
      break;

    default:
      // Para etapas sem tratamento específico, mostrar dados genéricos
      Object.entries(dados).forEach(([key, value]) => {
        if (value && typeof value !== 'object') {
          items.push(
            <div key={key} className="flex items-center gap-2">
              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
              <strong>{String(value)}</strong>
            </div>
          );
        }
      });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-2 p-2 bg-muted/30 rounded-md space-y-1 text-xs">
      {items}
    </div>
  );
}

export function HistoricoTimeline({ historico }: HistoricoTimelineProps) {
  if (historico.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Nenhum registro no histórico
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {historico.map((registro, index) => {
        const config = etapaConfig[registro.etapa_nova] || {
          icon: CheckCircle,
          color: "text-muted-foreground",
          label: registro.etapa_nova,
        };
        const Icon = config.icon;
        const isLast = index === historico.length - 1;
        const dados = registro.dados_formulario as Record<string, unknown> || {};

        return (
          <div key={registro.id} className="relative flex gap-3">
            {/* Linha conectora */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
            )}

            {/* Ícone */}
            <div
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background border-2",
                config.color.replace("text-", "border-")
              )}
            >
              <Icon className={cn("h-3 w-3", config.color)} />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 pb-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(registro.created_at), {
                    locale: ptBR,
                    addSuffix: true,
                  })}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {format(new Date(registro.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>

              {registro.funcionario?.nome && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <User className="w-3 h-3" />
                  <span>Por: {registro.funcionario.nome}</span>
                </div>
              )}

              {/* Dados específicos da etapa */}
              {renderDadosEtapa(registro.etapa_nova, dados)}

              {registro.observacoes && (
                <p className="text-xs mt-2 bg-muted/50 p-2 rounded border-l-2 border-primary/50">
                  💬 {registro.observacoes}
                </p>
              )}

              {registro.tempo_na_etapa_anterior && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Timer className="w-3 h-3" />
                  <span>Tempo na etapa anterior: {registro.tempo_na_etapa_anterior}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
