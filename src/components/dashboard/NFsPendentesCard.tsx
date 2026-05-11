import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFaturas } from "@/hooks/useFaturas";
import { useNavigate } from "react-router-dom";
import { FileWarning, CheckCircle2 } from "lucide-react";

export function NFsPendentesCard() {
  const { faturas } = useFaturas();
  const navigate = useNavigate();

  const pendentes = (faturas || []).filter(
    (f: any) => !f.numero_nf && (f.status === "pendente" || f.status === "enviado")
  );

  const total = pendentes.reduce((s: number, f: any) => s + Number(f.valor_total || 0), 0);

  if (pendentes.length === 0) {
    return (
      <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            NFs Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Todas notas emitidas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-warning" />
          NFs Pendentes
          <Badge variant="secondary" className="ml-auto text-[10px]">{pendentes.length}</Badge>
        </CardTitle>
        <p className="text-xs text-slate-500 font-semibold pt-1">
          R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[160px] px-6 pb-3">
          <div className="space-y-2">
            {pendentes.slice(0, 6).map((f: any) => (
              <div
                key={f.id}
                onClick={() => navigate("/lancamentos?tab=faturas")}
                className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-700 truncate">
                    {f.cliente?.nome_fantasia || f.cliente?.razao_social || "Cliente"}
                  </p>
                  <p className="text-xs text-slate-400">
                    R$ {Number(f.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">Emitir</Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
