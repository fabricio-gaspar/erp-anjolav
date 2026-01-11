import { Package, CheckCircle, XCircle, DollarSign } from "lucide-react";
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="card-base p-3 flex items-center gap-3">
          <div className={`p-2 rounded-lg ${stat.bgColor}`}>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800">{stat.value}</p>
            <p className="text-[11px] text-slate-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
