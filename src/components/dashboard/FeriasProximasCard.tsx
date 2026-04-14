import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palmtree, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFeriasProximas } from "@/hooks/useFeriasProximas";

export function FeriasProximasCard() {
  const { data: proximas = [], isLoading } = useFeriasProximas();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-emerald-600" />
            Férias Próximas
          </CardTitle>
          {proximas.length > 0 && (
            <Badge variant="destructive" className="animate-pulse">{proximas.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : proximas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma férias próxima</p>
        ) : (
          proximas.slice(0, 4).map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                {f.dias_restantes <= 0 && <AlertTriangle className="w-3 h-3 text-destructive flex-shrink-0" />}
                <span className="truncate">{f.nome}</span>
              </div>
              <Badge variant={f.dias_restantes <= 0 ? "destructive" : "secondary"} className="flex-shrink-0 ml-2">
                {f.dias_restantes <= 0 ? "Vencida" : `${f.dias_restantes}d`}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
