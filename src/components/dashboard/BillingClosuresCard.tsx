import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFechamentosProximos } from "@/hooks/useFechamentosProximos";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BILLING_FREQUENCY_LABELS } from "@/lib/customerPaymentTerms";

function getBadgeForDias(dias: number) {
  if (dias === 0) {
    return <Badge variant="destructive" className="ml-2 shrink-0">HOJE</Badge>;
  }
  if (dias === 1) {
    return <Badge className="ml-2 shrink-0 border-transparent bg-orange-500 text-white">AMANHÃ</Badge>;
  }
  if (dias <= 3) {
    return <Badge className="ml-2 shrink-0 border-transparent bg-yellow-500 text-white">{dias} dias</Badge>;
  }
  return <Badge variant="outline" className="ml-2 shrink-0">{dias} dias</Badge>;
}

export function BillingClosuresCard() {
  const { data: fechamentos = [], isLoading } = useFechamentosProximos(31);
  const navigate = useNavigate();

  const handleClienteClick = (clienteId: string) => {
    navigate(`/industrial/lancamentos?tab=pendentes&cliente=${clienteId}`);
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-slate-400" />
            Fechamentos Próximos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (fechamentos.length === 0) {
    return (
      <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Fechamentos Próximos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">
            Nenhum fechamento programado este mês
          </p>
        </CardContent>
      </Card>
    );
  }

  const urgentes = fechamentos.filter((f) => f.diasRestantes <= 1);
  const proximos = fechamentos.filter((f) => f.diasRestantes > 1);

  const cardBorder = "border-slate-200/80 shadow-none";
  const iconColor = urgentes.length > 0 ? "text-destructive" : "text-warning";

  const renderItem = (f: typeof fechamentos[0]) => (
    <div
      key={f.id}
      onClick={() => handleClienteClick(f.id)}
      className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-md transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {f.nomeFantasia || f.razaoSocial}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(parseISO(f.dataFechamento), "dd/MM", { locale: ptBR })}</span>
          <span>•</span>
          <span>{BILLING_FREQUENCY_LABELS[f.periodicidade]}</span>
          <span>•</span>
          <span>{f.quantidadePendente} origem{f.quantidadePendente === 1 ? "" : "s"}</span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-primary">
          {f.valorPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} pendente
        </p>
      </div>
      {getBadgeForDias(f.diasRestantes)}
    </div>
  );

  return (
    <Card className={cardBorder} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
          Fechamentos Próximos
          <Badge variant="secondary" className="ml-auto bg-warning/20 text-warning-foreground">
            {fechamentos.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[160px] px-6 pb-3">
          <div className="space-y-2">
            {urgentes.length > 0 && (
              <>
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide">⚠ Urgentes</p>
                {urgentes.map(renderItem)}
              </>
            )}
            {proximos.length > 0 && (
              <>
                {urgentes.length > 0 && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Próximos</p>
                )}
                {proximos.map(renderItem)}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
