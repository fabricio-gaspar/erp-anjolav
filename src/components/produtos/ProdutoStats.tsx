import { Package, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Produto } from "@/hooks/useProdutos";

interface ProdutoStatsProps {
  produtos: Produto[];
}

export function ProdutoStats({ produtos }: ProdutoStatsProps) {
  const total = produtos.length;
  const ativos = produtos.filter(p => p.status === "ativo").length;
  const inativos = produtos.filter(p => p.status === "inativo").length;
  const mediaPreco = total > 0 
    ? produtos.reduce((sum, p) => sum + p.preco, 0) / total 
    : 0;

  const stats = [
    {
      label: "Total Cadastrados",
      value: total,
      icon: Package,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Ativos",
      value: ativos,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Inativos",
      value: inativos,
      icon: XCircle,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Preço Médio",
      value: `R$ ${mediaPreco.toFixed(2).replace(".", ",")}`,
      icon: DollarSign,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
