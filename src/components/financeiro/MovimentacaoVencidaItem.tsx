import { TrendingUp, TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MovimentacaoVencidaItemProps {
  tipo: "fatura" | "despesa";
  descricao: string;
  cliente: string;
  dataVencimento: string;
  valor: number;
}

export function MovimentacaoVencidaItem({ tipo, descricao, cliente, dataVencimento, valor }: MovimentacaoVencidaItemProps) {
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => {
    try { return format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
  };

  const isFatura = tipo === "fatura";

  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {isFatura ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-destructive shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{descricao}</p>
          <p className="text-[11px] text-muted-foreground">
            {cliente} · {formatDate(dataVencimento)}
          </p>
        </div>
      </div>
      <span className={`text-sm font-semibold shrink-0 ml-3 ${isFatura ? "text-emerald-500" : "text-destructive"}`}>
        {formatCurrency(valor)}
      </span>
    </div>
  );
}
