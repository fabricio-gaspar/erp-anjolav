import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Ban, DollarSign, Boxes } from "lucide-react";

interface Props {
  activeCount?: number;
  lowCount?: number;
  zeroCount?: number;
  totalValue?: number;
  isLoading?: boolean;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function EstoqueDashboard({ activeCount, lowCount, zeroCount, totalValue, isLoading = false }: Props) {
  const cards = [
    { label: "Insumos ativos", value: activeCount, icon: Boxes, color: "text-primary", compactValue: false },
    { label: "Abaixo do mínimo", value: lowCount, icon: AlertTriangle, color: "text-amber-700 dark:text-amber-300", compactValue: false },
    { label: "Saldo zerado", value: zeroCount, icon: Ban, color: "text-destructive", compactValue: false },
    { label: "Valor em estoque", value: totalValue == null ? undefined : money.format(totalValue), icon: DollarSign, color: "text-emerald-600", compactValue: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo do estoque ativo">
      {cards.map((c) => (
        <Card key={c.label} className="min-w-0 shadow-none">
          <CardContent className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
            <div className={`shrink-0 rounded-lg bg-muted p-2 ${c.color}`}>
              <c.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className={`${c.compactValue ? "text-[15px] min-[430px]:text-lg" : "text-lg"} truncate font-bold tabular-nums sm:text-xl`}>
                {isLoading || c.value == null ? "—" : c.value}
              </p>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
