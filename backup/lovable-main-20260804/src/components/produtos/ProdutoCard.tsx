import { Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Produto } from "@/hooks/useProdutos";

interface ProdutoCardProps {
  produto: Produto;
  onEdit: (produto: Produto) => void;
  onDelete: (id: string) => void;
  onDuplicate: (produto: Produto) => void;
}

export function ProdutoCard({ produto, onEdit, onDelete, onDuplicate }: ProdutoCardProps) {
  const getUnidadeLabel = (unidade: string | null) => {
    switch (unidade) {
      case "kg": return "Kg";
      case "peca": return "Peça";
      case "metro": return "Metro";
      case "unidade": return "Un";
      default: return "Peça";
    }
  };

  return (
    <div className="bg-card border rounded-md p-2 hover:shadow-sm transition-shadow group relative">
      {/* Name + Status */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <h3 className="font-semibold text-foreground text-xs leading-tight line-clamp-1">
          {produto.nome}
        </h3>
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${produto.status === "ativo" ? "bg-emerald-500" : "bg-amber-500"}`} />
      </div>

      {/* Price */}
      <div className="flex items-baseline">
        <span className="text-sm font-bold text-primary">
          R$ {produto.preco.toFixed(2).replace(".", ",")}
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">
          /{getUnidadeLabel(produto.unidade)}
        </span>
      </div>

      {/* Hover actions */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 bg-background/90 rounded p-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onDuplicate(produto)}
          title="Duplicar"
        >
          <Copy className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onEdit(produto)}
          title="Editar"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-destructive hover:text-destructive"
          onClick={() => onDelete(produto.id)}
          title="Excluir"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
