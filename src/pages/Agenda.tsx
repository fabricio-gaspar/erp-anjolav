import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Package, Truck } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewType = "semanal" | "quinzenal" | "mensal";
type EventType = "retirada" | "entrega";

interface AgendaEvent {
  id: string;
  clientName: string;
  type: EventType;
  frequency: string;
  date: Date;
}

// Mock data for events
const generateMockEvents = (baseDate: Date): AgendaEvent[] => {
  const events: AgendaEvent[] = [];
  const startOfCurrentWeek = startOfWeek(baseDate, { weekStartsOn: 0 });
  
  // Add recurring events on Mondays (Retirada) and Wednesdays (Entrega)
  for (let week = 0; week < 5; week++) {
    const weekStart = addWeeks(startOfCurrentWeek, week);
    
    // Monday - Retirada
    events.push({
      id: `ret-${week}`,
      clientName: "Anjolav Serv",
      type: "retirada",
      frequency: "Semanal",
      date: addDays(weekStart, 1), // Monday
    });
    
    // Wednesday - Entrega
    events.push({
      id: `ent-${week}`,
      clientName: "Anjolav Serv",
      type: "entrega",
      frequency: "Semanal",
      date: addDays(weekStart, 3), // Wednesday
    });
  }
  
  return events;
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Agenda() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 4)); // 04 Jan 2026
  const [viewType, setViewType] = useState<ViewType>("semanal");
  const [filterRetirada, setFilterRetirada] = useState(true);
  const [filterEntrega, setFilterEntrega] = useState(true);
  
  const events = generateMockEvents(currentDate);

  const getWeeksToShow = () => {
    switch (viewType) {
      case "semanal":
        return 1;
      case "quinzenal":
        return 2;
      case "mensal":
        return 5;
      default:
        return 1;
    }
  };

  const weeksToShow = getWeeksToShow();
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
  const endDate = addDays(startDate, weeksToShow * 7 - 1);

  const formatDateRange = () => {
    const start = format(startDate, "dd MMM", { locale: ptBR });
    const end = format(endDate, "dd MMM yyyy", { locale: ptBR });
    return `${start} - ${end}`;
  };

  const navigatePrevious = () => {
    setCurrentDate(addDays(currentDate, -7 * weeksToShow));
  };

  const navigateNext = () => {
    setCurrentDate(addDays(currentDate, 7 * weeksToShow));
  };

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const matchesDate = isSameDay(event.date, date);
      const matchesFilter =
        (filterRetirada && event.type === "retirada") ||
        (filterEntrega && event.type === "entrega");
      return matchesDate && matchesFilter;
    });
  };

  const generateCalendarDays = () => {
    const days: Date[] = [];
    for (let i = 0; i < weeksToShow * 7; i++) {
      days.push(addDays(startDate, i));
    }
    return days;
  };

  const calendarDays = generateCalendarDays();

  const isFriday = (date: Date) => date.getDay() === 5;

  return (
    <AppLayout title="Agenda" subtitle="Programação de retiradas e entregas">
      <div className="space-y-3">
        {/* Header with filters and navigation */}
        <div className="flex items-center justify-between">
          {/* Left side - Filters */}
          <div className="flex items-center gap-3">
            <Button
              variant={filterRetirada ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterRetirada(!filterRetirada)}
              className={`gap-2 ${filterRetirada ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Package className="h-4 w-4" />
              Retirada
            </Button>
            
            <Button
              variant={filterEntrega ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilterEntrega(!filterEntrega)}
              className={`gap-2 ${filterEntrega ? "bg-emerald-500 text-white hover:bg-emerald-600" : "text-muted-foreground"}`}
            >
              <Truck className="h-4 w-4" />
              Entrega
            </Button>

            <div className="flex items-center gap-1 ml-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                Semanal
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Quinzenal
              </Badge>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                Mensal
              </Badge>
            </div>
          </div>

          {/* Right side - Navigation */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[160px] text-center">
                {formatDateRange()}
              </span>
              <Button variant="ghost" size="icon" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={viewType === "semanal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("semanal")}
                className={viewType === "semanal" ? "" : "text-muted-foreground"}
              >
                Semanal
              </Button>
              <Button
                variant={viewType === "quinzenal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("quinzenal")}
                className={viewType === "quinzenal" ? "" : "text-muted-foreground"}
              >
                Quinzenal
              </Button>
              <Button
                variant={viewType === "mensal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("mensal")}
                className={viewType === "mensal" ? "" : "text-muted-foreground"}
              >
                Mensal
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {/* Header row with day names */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-4 py-3 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar rows */}
          {Array.from({ length: weeksToShow }).map((_, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
                const dayEvents = getEventsForDay(date);
                const isWeekend = isFriday(date);

                return (
                  <div
                    key={dayIndex}
                    className="min-h-[120px] p-3 border-r border-border last:border-r-0 flex flex-col"
                  >
                    {/* Date */}
                    <span
                      className={`text-sm font-medium mb-2 ${
                        isWeekend ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {format(date, "dd/MM")}
                    </span>

                    {/* Events */}
                    <div className="flex-1 space-y-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className={`p-2 rounded-md border-l-4 bg-card shadow-sm ${
                              event.type === "retirada"
                                ? "border-l-primary"
                                : "border-l-emerald-500"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-sm">
                              {event.type === "retirada" ? (
                                <Package className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Truck className="h-3.5 w-3.5 text-emerald-500" />
                              )}
                              <span className="font-medium text-foreground">
                                {event.clientName}
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`mt-1 text-xs ${
                                event.type === "retirada"
                                  ? "bg-primary/10 text-primary border-primary/20"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              }`}
                            >
                              {event.frequency}
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Sem agendamentos
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
