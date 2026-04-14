import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CalendarCheck,
  Clock,
  Loader2,
} from "lucide-react";
import { useEventosAgenda, type CreateEventoData, type EventoAgenda } from "@/hooks/useEventosAgenda";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "lembrete", label: "Lembrete", emoji: "📌" },
  { value: "reuniao", label: "Reunião", emoji: "🤝" },
  { value: "tarefa", label: "Tarefa", emoji: "✅" },
  { value: "outro", label: "Outro", emoji: "📋" },
];

const CORES = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const AgendaEventos = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CreateEventoData>({
    titulo: "",
    descricao: "",
    data_evento: format(new Date(), "yyyy-MM-dd"),
    horario: "",
    tipo: "lembrete",
    cor: "#3b82f6",
  });

  const mesKey = format(currentMonth, "yyyy-MM");
  const { eventos, isLoading, createEvento, deleteEvento, toggleConcluido } = useEventosAgenda(mesKey);

  const eventosNoDia = useMemo(() => {
    const sel = format(selectedDate, "yyyy-MM-dd");
    return eventos.filter((e) => e.data_evento === sel);
  }, [eventos, selectedDate]);

  const eventosPorDia = useMemo(() => {
    const map: Record<string, number> = {};
    eventos.forEach((e) => {
      map[e.data_evento] = (map[e.data_evento] || 0) + 1;
    });
    return map;
  }, [eventos]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0=Sun

  const openNewEvento = () => {
    setFormData({
      titulo: "",
      descricao: "",
      data_evento: format(selectedDate, "yyyy-MM-dd"),
      horario: "",
      tipo: "lembrete",
      cor: "#3b82f6",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;
    await createEvento.mutateAsync({
      ...formData,
      horario: formData.horario || undefined,
      descricao: formData.descricao || undefined,
    });
    setIsModalOpen(false);
  };

  return (
    <AppLayout title="Agenda de Eventos" subtitle="Calendário e lembretes">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-lg font-semibold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const count = eventosPorDia[key] || 0;
              const selected = isSameDay(day, selectedDate);
              const today = isToday(day);

              return (
                <button
                  key={key}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative h-10 rounded-lg text-sm transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground font-bold"
                      : today
                      ? "bg-primary/10 font-semibold"
                      : "hover:bg-muted",
                  )}
                >
                  {format(day, "d")}
                  {count > 0 && (
                    <span className={cn(
                      "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full",
                      selected ? "bg-primary-foreground" : "bg-primary"
                    )} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Day events */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </h3>
            <Button size="sm" onClick={openNewEvento} className="gap-1">
              <Plus className="w-3 h-3" /> Novo
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : eventosNoDia.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum evento neste dia
            </p>
          ) : (
            <div className="space-y-2">
              {eventosNoDia.map((ev) => (
                <div
                  key={ev.id}
                  className={cn(
                    "p-3 rounded-lg border transition-opacity",
                    ev.concluido && "opacity-50"
                  )}
                  style={{ borderLeftColor: ev.cor || "#3b82f6", borderLeftWidth: 3 }}
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={ev.concluido}
                      onCheckedChange={(checked) =>
                        toggleConcluido.mutate({ id: ev.id, concluido: !!checked })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", ev.concluido && "line-through")}>{ev.titulo}</p>
                      {ev.horario && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> {ev.horario.slice(0, 5)}
                        </span>
                      )}
                      {ev.descricao && (
                        <p className="text-xs text-muted-foreground mt-1">{ev.descricao}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEvento.mutate(ev.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* New Event Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              Novo Evento
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Título do evento"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.data_evento}
                  onChange={(e) => setFormData({ ...formData, data_evento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={formData.horario}
                  onChange={(e) => setFormData({ ...formData, horario: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.emoji} {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {CORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, cor: c })}
                    className={cn(
                      "w-7 h-7 rounded-full transition-transform",
                      formData.cor === c && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Detalhes do evento..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createEvento.isPending}>
                {createEvento.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AgendaEventos;
