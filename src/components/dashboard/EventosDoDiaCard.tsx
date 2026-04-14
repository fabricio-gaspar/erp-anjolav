import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEventosHoje } from "@/hooks/useEventosAgenda";
import { useNavigate } from "react-router-dom";

const tipoIcons: Record<string, string> = {
  lembrete: "📌",
  reuniao: "🤝",
  tarefa: "✅",
  outro: "📋",
};

export function EventosDoDiaCard() {
  const { data: eventos = [], isLoading } = useEventosHoje();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            Eventos do Dia
          </CardTitle>
          <Badge variant="secondary">{eventos.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento para hoje</p>
        ) : (
          eventos.slice(0, 4).map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 text-sm">
              <span>{tipoIcons[ev.tipo] || "📋"}</span>
              {ev.horario && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {ev.horario.slice(0, 5)}
                </span>
              )}
              <span className="truncate flex-1">{ev.titulo}</span>
            </div>
          ))
        )}
        <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => navigate("/agenda-eventos")}>
          Ver agenda completa <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
