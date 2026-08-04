import { Package, FileText, CheckCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Estatisticas {
  totalOS: number;
  osEntregues: number;
  osEmProcesso: number;
  totalPecas: number;
  valorFaturado: number;
  faturasPagas: number;
  totalFaturas: number;
}

interface EstatisticasClienteProps {
  estatisticas: Estatisticas | null | undefined;
  isLoading: boolean;
}

export function EstatisticasCliente({ estatisticas, isLoading }: EstatisticasClienteProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (!estatisticas) return null;

  const stats = [
    {
      label: "OS este mês",
      value: estatisticas.totalOS,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      label: "Peças processadas",
      value: estatisticas.totalPecas,
      icon: Package,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      label: "Entregas concluídas",
      value: estatisticas.osEntregues,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      label: "Faturamento",
      value: `R$ ${estatisticas.valorFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Resumo do Mês</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
