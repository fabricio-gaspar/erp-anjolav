import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEstoque } from "@/hooks/useEstoque";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function EstoqueBaixoCard() {
  const { produtos } = useEstoque();
  const navigate = useNavigate();

  const itensBaixos = produtos
    .filter((p) => p.ativo && p.quantidade_minima > 0 && p.quantidade_atual <= p.quantidade_minima)
    .sort((a, b) => a.quantidade_atual - b.quantidade_atual);

  if (itensBaixos.length === 0) {
    return (
      <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Estoque
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">Todos os itens acima do mínimo</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/80 shadow-none" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Estoque Baixo
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {itensBaixos.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[180px] px-6 pb-4">
          <div className="space-y-2">
            {itensBaixos.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate("/estoque")}
                className="flex items-center justify-between text-sm border-b border-slate-50 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-slate-50 -mx-2 px-2 py-1 rounded-md transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-700 truncate">{item.nome}</p>
                  <p className="text-xs text-slate-400">
                    {item.quantidade_atual} / {item.quantidade_minima} {item.unidade || "un"}
                  </p>
                </div>
                <Badge
                  variant={item.quantidade_atual === 0 ? "destructive" : "outline"}
                  className="ml-2 shrink-0 text-[10px]"
                >
                  {item.quantidade_atual === 0 ? "Crítico" : "Baixo"}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
