import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContasPagar } from "@/hooks/useContasPagar";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CreditCard } from "lucide-react";
import { differenceInDays, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ContasVencendoCard() {
  const { contas } = useContasPagar();
  const navigate = useNavigate();

  const hoje = startOfDay(new Date());

  const contasUrgentes = contas
    .filter((c) => c.status === "pendente" || c.status === "vencido")
    .map((c) => {
      const venc = startOfDay(new Date(c.vencimento));
      const dias = differenceInDays(venc, hoje);
      return { ...c, diasRestantes: dias };
    })
    .filter((c) => c.diasRestantes <= 3)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  if (contasUrgentes.length === 0) {
    return (
      <Card className="border-success/20 bg-success/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Contas a Pagar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma conta vencendo nos próximos 3 dias
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Contas a Pagar
          <Badge variant="destructive" className="ml-auto">
            {contasUrgentes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[160px] px-6 pb-3">
          <div className="space-y-2">
            {contasUrgentes.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate("/contas-pagar")}
                className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.fornecedor || c.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {Number(c.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} • {format(new Date(c.vencimento), "dd/MM", { locale: ptBR })}
                  </p>
                </div>
                <Badge
                  variant={c.diasRestantes < 0 ? "destructive" : c.diasRestantes === 0 ? "destructive" : "outline"}
                  className="ml-2 shrink-0"
                >
                  {c.diasRestantes < 0
                    ? "Vencida"
                    : c.diasRestantes === 0
                    ? "Hoje"
                    : c.diasRestantes === 1
                    ? "Amanhã"
                    : `${c.diasRestantes} dias`}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
