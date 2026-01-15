import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFechamentosProximos } from "@/hooks/useFechamentosProximos";

export function BillingClosuresCard() {
  const { data: fechamentos = [], isLoading } = useFechamentosProximos(3);

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
      <CardContent className="space-y-2">
        {fechamentos.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {f.nome_fantasia || f.razao_social}
              </p>
              <p className="text-xs text-muted-foreground">
                Dia {f.dia_fechamento}
              </p>
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
      </CardContent>
    </Card>
  );
}
