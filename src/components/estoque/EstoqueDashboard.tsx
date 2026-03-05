import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, DollarSign, Boxes } from "lucide-react";

interface Props {
  totalItens: number;
  itensBaixos: number;
  valorTotal: number;
}

export function EstoqueDashboard({ totalItens, itensBaixos, valorTotal }: Props) {
  const cards = [
    { label: "Total de Insumos", value: totalItens, icon: Boxes, color: "text-primary" },
    { label: "Abaixo do Mínimo", value: itensBaixos, icon: AlertTriangle, color: "text-destructive" },
    { label: "Valor em Estoque", value: `R$ ${valorTotal.toFixed(2)}`, icon: DollarSign, color: "text-emerald-600" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-xl font-bold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
