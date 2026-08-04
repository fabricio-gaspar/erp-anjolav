import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

interface AjudaAtalhosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ATALHOS = [
  { tecla: "F1", descricao: "Ajuda / Lista de atalhos", grupo: "Sistema" },
  { tecla: "F2", descricao: "Selecionar cliente", grupo: "Cliente" },
  { tecla: "F3", descricao: "Foco na busca de produtos", grupo: "Produtos" },
  { tecla: "F4", descricao: "Abrir pagamento", grupo: "Venda" },
  { tecla: "F5", descricao: "Consultar OS", grupo: "Consulta" },
  { tecla: "F6", descricao: "Histórico de vendas do dia", grupo: "Consulta" },
  { tecla: "F7", descricao: "Sangria / Suprimento", grupo: "Caixa" },
  { tecla: "F8", descricao: "Limpar carrinho", grupo: "Venda" },
  { tecla: "F9", descricao: "Último cliente", grupo: "Cliente" },
  { tecla: "F10", descricao: "Fechar caixa", grupo: "Caixa" },
  { tecla: "F11", descricao: "Modo tela cheia", grupo: "Sistema" },
  { tecla: "+", descricao: "Aumentar quantidade do último item", grupo: "Carrinho" },
  { tecla: "-", descricao: "Diminuir quantidade do último item", grupo: "Carrinho" },
  { tecla: "ESC", descricao: "Fechar modal / Cancelar ação", grupo: "Sistema" },
];

const GRUPOS = ["Sistema", "Cliente", "Produtos", "Venda", "Carrinho", "Consulta", "Caixa"];

const GRUPO_CORES: Record<string, string> = {
  Sistema: "bg-slate-100 text-slate-700",
  Cliente: "bg-blue-100 text-blue-700",
  Produtos: "bg-purple-100 text-purple-700",
  Venda: "bg-emerald-100 text-emerald-700",
  Carrinho: "bg-amber-100 text-amber-700",
  Consulta: "bg-cyan-100 text-cyan-700",
  Caixa: "bg-rose-100 text-rose-700",
};

export function AjudaAtalhosModal({ open, onOpenChange }: AjudaAtalhosModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Atalhos de Teclado (F1)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {GRUPOS.map((grupo) => {
            const atalhosDoGrupo = ATALHOS.filter((a) => a.grupo === grupo);
            if (atalhosDoGrupo.length === 0) return null;

            return (
              <div key={grupo}>
                <p className={cn("text-xs font-semibold px-2 py-1 rounded-md inline-block mb-2", GRUPO_CORES[grupo])}>
                  {grupo}
                </p>
                <div className="space-y-1">
                  {atalhosDoGrupo.map((atalho) => (
                    <div
                      key={atalho.tecla}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">
                        {atalho.descricao}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-semibold bg-muted border rounded-md shadow-sm min-w-[40px] text-center">
                        {atalho.tecla}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Pressione <kbd className="px-1.5 py-0.5 text-xs bg-muted border rounded">ESC</kbd> para fechar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
