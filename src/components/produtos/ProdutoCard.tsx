import { Pencil, Trash2, Thermometer, Clock, Weight, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Produto } from "@/hooks/useProdutos";
import { CATEGORIAS, PROCESSOS_LAVAGEM } from "./ProdutoFilters";

interface ProdutoCardProps {
  produto: Produto;
  onEdit: (produto: Produto) => void;
  onDelete: (id: string) => void;
  onDuplicate: (produto: Produto) => void;
}

export function ProdutoCard({ produto, onEdit, onDelete, onDuplicate }: ProdutoCardProps) {
  const categoriaLabel = CATEGORIAS.find(c => c.value === produto.categoria)?.label || produto.categoria;
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

  const getStatusColor = (status: string) => {
    return status === "ativo" ? "bg-emerald-500/10 text-emerald-600 border-emerald-200" : "bg-amber-500/10 text-amber-600 border-amber-200";
  };

  const getProcessoColor = (processo: string | null) => {
    switch (processo) {
      case "hospitalar": return "bg-red-500/10 text-red-600";
      case "industrial_pesado": return "bg-orange-500/10 text-orange-600";
      case "delicado": return "bg-blue-500/10 text-blue-600";
      case "a_seco": return "bg-purple-500/10 text-purple-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow group relative">
      {/* Header with code and actions */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {produto.codigo && (
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {produto.codigo}
            </span>
          )}
          <Badge variant="outline" className={getStatusColor(produto.status)}>
            {produto.unidade_negocio === "ID1" ? "Industrial" : produto.unidade_negocio === "ID2" ? "Residencial" : "ID1+ID2"}
          </Badge>
        </div>
        
        {/* Status indicator */}
        <div className={`w-2 h-2 rounded-full ${produto.status === "ativo" ? "bg-emerald-500" : "bg-amber-500"}`} />
      </div>

      {/* Product name */}
      <h3 className="font-semibold text-foreground text-sm leading-tight mb-2 line-clamp-2">
        {produto.nome}
      </h3>

      {/* Category badge */}
      {produto.categoria && (
        <Badge variant="secondary" className="text-[10px] mb-3">
          {categoriaLabel}
        </Badge>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {produto.peso_medio_kg && produto.peso_medio_kg > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Weight className="w-3 h-3" />
            <span>{produto.peso_medio_kg} kg</span>
          </div>
        )}
        {produto.temperatura_maxima && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Thermometer className="w-3 h-3" />
            <span>{produto.temperatura_maxima}°C</span>
          </div>
        )}
        {produto.tempo_processo_min && produto.tempo_processo_min > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{produto.tempo_processo_min} min</span>
          </div>
        )}
        {produto.processo_lavagem && (
          <Badge variant="secondary" className={`text-[10px] ${getProcessoColor(produto.processo_lavagem)}`}>
            {processoLabel}
          </Badge>
        )}
      </div>

      {/* Price and unit */}
      <div className="flex items-baseline justify-between pt-2 border-t">
        <div>
          <span className="text-lg font-bold text-primary">
            R$ {produto.preco.toFixed(2).replace(".", ",")}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            /{getUnidadeLabel(produto.unidade)}
          </span>
        </div>
      </div>

      {/* Actions overlay */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onDuplicate(produto)}
          title="Duplicar"
        >
          <Copy className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(produto)}
          title="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(produto.id)}
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
