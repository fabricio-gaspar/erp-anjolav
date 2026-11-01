import { CheckCircle, DollarSign, List, Package } from "lucide-react";
import { Produto } from "@/hooks/useProdutos";

interface ProdutoStatsProps {
  produtos: Produto[];
  total: number;
}

export function ProdutoStats({ produtos, total }: ProdutoStatsProps) {
  const activeOnPage = produtos.filter(product => product.status === "ativo").length;
  const averageOnPage = produtos.length > 0
    ? produtos.reduce((sum, product) => sum + product.preco, 0) / produtos.length
    : 0;
  const stats = [
    {
      label: "Total no filtro",
      value: total,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Nesta página",
      value: produtos.length,
      icon: List,
      color: "text-violet-600",
      bgColor: "bg-violet-500/10",
    },
    {
      label: "Ativos na página",
      value: activeOnPage,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Preço médio da página",
      value: `R$ ${averageOnPage.toFixed(2).replace(".", ",")}`,
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="card-base flex min-w-0 items-center gap-3 p-3">
          <div className={`rounded-lg p-2 ${stat.bgColor}`}>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold tabular-nums text-foreground">{stat.value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
