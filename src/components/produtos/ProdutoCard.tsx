import { Pencil, Trash2, Thermometer, Clock, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Produto } from "@/hooks/useProdutos";
import { PROCESSOS_LAVAGEM } from "./ProdutoFilters";

interface ProdutoCardProps {
  produto: Produto;
  onEdit: (produto: Produto) => void;
  onDelete: (id: string) => void;
  onDuplicate: (produto: Produto) => void;
}

export function ProdutoCard({ produto, onEdit, onDelete, onDuplicate }: ProdutoCardProps) {
  const processoLabel = PROCESSOS_LAVAGEM.find(p => p.value === produto.processo_lavagem)?.label || produto.processo_lavagem;

  const getUnidadeLabel = (unidade: string | null) => {
    switch (unidade) {
      case "kg": return "Kg";
      case "peca": return "Peça";
      case "metro": return "Metro";
      case "unidade": return "Un";
      default: return "Peça";
    }
  };

  const getUnidadeNegocioLabel = (un: string | null) => {
    switch (un) {
      case "ID1": return "Industrial";
      case "ID2": return "Residencial";
      default: return "Ambos";
    }
  };

  const getUnidadeNegocioColor = (un: string | null) => {
    switch (un) {
      case "ID1": return "bg-cyan-500/10 text-cyan-700 border-cyan-200";
      case "ID2": return "bg-violet-500/10 text-violet-700 border-violet-200";
      default: return "bg-slate-500/10 text-slate-600 border-slate-200";
    }
  };

  const getProcessoColor = (processo: string | null) => {
    switch (processo) {
      case "hospitalar": return "bg-red-500/10 text-red-600";
      case "industrial_pesado": return "bg-orange-500/10 text-orange-600";
      case "delicado": return "bg-blue-500/10 text-blue-600";
      case "a_seco": return "bg-purple-500/10 text-purple-600";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="bg-card border rounded-md p-3 hover:shadow-sm transition-shadow group relative">
      {/* Header: Badge + Status */}
      <div className="flex items-center justify-between mb-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${getUnidadeNegocioColor(produto.unidade_negocio)}`}>
          {getUnidadeNegocioLabel(produto.unidade_negocio)}
        </Badge>
        <div className={`w-1.5 h-1.5 rounded-full ${produto.status === "ativo" ? "bg-emerald-500" : "bg-amber-500"}`} />
      </div>

      {/* Product name */}
      <h3 className="font-semibold text-foreground text-sm leading-tight mb-1 line-clamp-1">
        {produto.nome}
      </h3>

      {/* Compact info row */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        {produto.temperatura_maxima && (
          <span className="flex items-center gap-0.5">
            <Thermometer className="w-3 h-3" />
            {produto.temperatura_maxima}°C
          </span>
        )}
        {produto.tempo_processo_min && produto.tempo_processo_min > 0 && (
          <span className="flex items-center gap-0.5">
            <Clock className="w-3 h-3" />
            {produto.tempo_processo_min} min
          </span>
        )}
      </div>

      {/* Process badge */}
      {produto.processo_lavagem && (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 h-4 mb-2 ${getProcessoColor(produto.processo_lavagem)}`}>
          {processoLabel}
        </Badge>
      )}

      {/* Price */}
      <div className="flex items-baseline pt-1.5 border-t">
        <span className="text-base font-bold text-primary">
          R$ {produto.preco.toFixed(2).replace(".", ",")}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">
          /{getUnidadeLabel(produto.unidade)}
        </span>
      </div>

      {/* Hover actions */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-background/90 rounded p-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onDuplicate(produto)}
          title="Duplicar"
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onEdit(produto)}
          title="Editar"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => onDelete(produto.id)}
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
