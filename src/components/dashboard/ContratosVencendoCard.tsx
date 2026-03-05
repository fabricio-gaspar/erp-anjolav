import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContratosAtivos } from "@/hooks/useContratosAluguel";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, FileCheck } from "lucide-react";
import { differenceInDays, startOfDay } from "date-fns";

export function ContratosVencendoCard() {
  const { data: contratos = [] } = useContratosAtivos();
  const navigate = useNavigate();

  const hoje = startOfDay(new Date());

  const contratosUrgentes = contratos
    .filter((c: any) => c.data_fim)
    .map((c: any) => {
      const fim = startOfDay(new Date(c.data_fim));
      const dias = differenceInDays(fim, hoje);
      return { ...c, diasRestantes: dias };
    })
    .filter((c: any) => c.diasRestantes <= 30)
    .sort((a: any, b: any) => a.diasRestantes - b.diasRestantes);

  if (contratosUrgentes.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum contrato vencendo nos próximos 30 dias
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
          Contratos Vencendo
          <Badge variant="secondary" className="ml-auto bg-warning/20 text-warning-foreground">
            {contratosUrgentes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[180px] px-6 pb-4">
          <div className="space-y-2">
            {contratosUrgentes.map((c: any) => {
              const clienteNome = c.clientes?.nome_fantasia || c.clientes?.razao_social || "Cliente";
              return (
                <div
                  key={c.id}
                  onClick={() => navigate("/clientes")}
                  className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{clienteNome}</p>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                  </div>
                  <Badge
                    variant={c.diasRestantes < 0 ? "destructive" : c.diasRestantes <= 7 ? "destructive" : "outline"}
                    className="ml-2 shrink-0"
                  >
                    {c.diasRestantes < 0
                      ? "Vencido"
                      : c.diasRestantes === 0
                      ? "Hoje"
                      : `${c.diasRestantes} dias`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
