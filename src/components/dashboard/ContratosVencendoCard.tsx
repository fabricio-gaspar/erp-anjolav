import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useContratosAtivos } from "@/hooks/useContratosAluguel";
import { useNavigate } from "react-router-dom";
import { FileSignature, CheckCircle2 } from "lucide-react";
import { differenceInDays, startOfDay } from "date-fns";

export function ContratosVencendoCard() {
  const { data: contratos = [] } = useContratosAtivos();
  const navigate = useNavigate();

  const hoje = startOfDay(new Date());

  const lista = (contratos as any[])
    .map((c) => {
      const dias = c.data_fim ? differenceInDays(startOfDay(new Date(c.data_fim)), hoje) : null;
      return { ...c, diasRestantes: dias };
    })
    .sort((a, b) => {
      if (a.diasRestantes === null && b.diasRestantes === null) return 0;
      if (a.diasRestantes === null) return 1;
      if (b.diasRestantes === null) return -1;
      return a.diasRestantes - b.diasRestantes;
    });

  if (lista.length === 0) {
    return (
      <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Contratos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Nenhum contrato cadastrado</p>
        </CardContent>
      </Card>
    );
  }

  const renderBadge = (dias: number | null) => {
    if (dias === null) return <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">Sem prazo</Badge>;
    if (dias < 0) return <Badge variant="destructive" className="ml-2 shrink-0 text-[10px]">Vencido</Badge>;
    if (dias <= 7) return <Badge variant="destructive" className="ml-2 shrink-0 text-[10px]">{dias === 0 ? "Hoje" : `${dias}d`}</Badge>;
    if (dias <= 30) return <Badge className="ml-2 shrink-0 text-[10px] bg-warning text-warning-foreground">{dias}d</Badge>;
    return <Badge variant="outline" className="ml-2 shrink-0 text-[10px] text-success border-success/30">Ativo</Badge>;
  };

  return (
    <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" />
          Contratos Ativos
          <Badge variant="secondary" className="ml-auto text-[10px]">{lista.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[180px] px-6 pb-4">
          <div className="space-y-2">
            {lista.map((c: any) => {
              const clienteNome = c.clientes?.nome_fantasia || c.clientes?.razao_social || "Cliente";
              return (
                <div
                  key={c.id}
                  onClick={() => navigate("/clientes")}
                  className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-700 truncate">{clienteNome}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {c.descricao || "Contrato"} • R$ {Number(c.valor_servico || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {renderBadge(c.diasRestantes)}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
