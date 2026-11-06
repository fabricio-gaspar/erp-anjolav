import { Archive, Copy, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Produto } from "@/hooks/useProdutos";

interface ProdutoCardProps {
  produto: Produto;
  onEdit: (produto: Produto) => void;
  onArchive: (produto: Produto) => void;
  onReactivate: (produto: Produto) => void;
  onDuplicate: (produto: Produto) => void;
}

export function ProdutoCard({ produto, onEdit, onArchive, onReactivate, onDuplicate }: ProdutoCardProps) {
  const unitLabel = produto.unidade === "kg"
    ? "kg"
    : produto.unidade === "metro"
      ? "metro"
      : produto.unidade === "unidade"
        ? "un."
        : "peça";
  const sizeLabel = produto.porte === "pequeno"
    ? "Pequeno"
    : produto.porte === "medio"
      ? "Médio"
      : produto.porte === "grande"
        ? "Grande"
        : null;
  const active = produto.status === "ativo";

  return (
    <article className="flex min-h-40 flex-col rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {produto.codigo || "Sem código"}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-tight text-foreground">
            {produto.nome}
          </h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label={`Ações do produto ${produto.nome}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(produto)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(produto)}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar
            </DropdownMenuItem>
            {active ? (
              <DropdownMenuItem onClick={() => onArchive(produto)}>
                <Archive className="mr-2 h-4 w-4" /> Arquivar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onReactivate(produto)}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reativar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-lg font-black tabular-nums text-primary">
              R$ {produto.preco.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-[11px] text-muted-foreground">por {unitLabel}</p>
          </div>
          <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
            active
              ? "border-emerald-100 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-500",
          )}>
            {active ? "Ativo" : "Arquivado"}
          </span>
        </div>
        {(sizeLabel || produto.categoria) && (
          <p className="mt-3 truncate border-t pt-2 text-[11px] text-muted-foreground">
            {[sizeLabel && `Porte ${sizeLabel}`, produto.categoria].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </article>
  );
}
