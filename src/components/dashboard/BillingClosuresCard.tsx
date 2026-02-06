import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFechamentosProximos } from "@/hooks/useFechamentosProximos";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const condicaoLabels: Record<string, string> = {
  // Novos valores
  a_vista: "À Vista",
  "5_dias": "5 dias",
  "7_dias": "7 dias",
  "10_dias": "10 dias",
  "15_dias": "15 dias",
  "20_dias": "20 dias",
  "30_dias": "30 dias",
  // Valores antigos (compatibilidade)
  mensal_15: "15 dias",
  mensal_30: "30 dias",
  mensal_45: "45 dias",
  semanal: "7 dias",
};

export function BillingClosuresCard() {
  const { data: fechamentos = [], isLoading } = useFechamentosProximos(3);
  const navigate = useNavigate();

  const handleClienteClick = (clienteId: string) => {
    navigate(`/faturamento?cliente=${clienteId}`);
  };

  if (isLoading) {
    return (
      <Card className="border-warning/20 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-warning" />
            Fechamentos Próximos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (fechamentos.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Fechamentos Próximos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum fechamento nos próximos 3 dias
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/20 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Fechamentos Próximos
          <Badge variant="secondary" className="ml-auto bg-warning/20 text-warning-foreground">
            {fechamentos.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[180px] px-6 pb-4">
          <div className="space-y-2">
            {fechamentos.map((f) => (
              <div
                key={f.id}
                onClick={() => handleClienteClick(f.id)}
                className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {f.nome_fantasia || f.razao_social}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Dia {f.dia_fechamento}</span>
                    {f.condicao_pagamento && (
                      <>
                        <span>•</span>
                        <span>{condicaoLabels[f.condicao_pagamento] || f.condicao_pagamento}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge
                  variant={f.diasRestantes === 0 ? "destructive" : "outline"}
                  className="ml-2 shrink-0"
                >
                  {f.diasRestantes === 0
                    ? "Hoje"
                    : f.diasRestantes === 1
                    ? "Amanhã"
                    : `${f.diasRestantes} dias`}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
