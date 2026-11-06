import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Package, Truck, Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAgendamentos, Agendamento, AgendamentoInsert, AgendamentoUpdate } from "@/hooks/useAgendamentos";
import { useFilteredAgendamentos } from "@/hooks/useFilteredAgendamentos";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AgendaEventCard } from "@/components/agenda/AgendaEventCard";
import { NovoAgendamentoModal } from "@/components/agenda/NovoAgendamentoModal";
import { CancelarAgendamentoModal } from "@/components/agenda/CancelarAgendamentoModal";
import { DetalhesAgendamentoModal } from "@/components/agenda/DetalhesAgendamentoModal";
import { AtribuirMotoristaModal } from "@/components/agenda/AtribuirMotoristaModal";
import { ObservacaoModal } from "@/components/agenda/ObservacaoModal";
import { ReagendarModal } from "@/components/agenda/ReagendarModal";
import { RouteWorkspace } from "@/components/delivery/RouteWorkspace";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewType = "semanal" | "quinzenal" | "mensal";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeArea } = useWorkspace();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("semanal");
  const [filterRetirada, setFilterRetirada] = useState(searchParams.get("tipo") !== "entrega");
  const [filterEntrega, setFilterEntrega] = useState(searchParams.get("tipo") !== "retirada");
  const [showCanceled, setShowCanceled] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [workspaceView, setWorkspaceView] = useState<"agenda" | "rotas">(
    searchParams.get("view") === "rotas" ? "rotas" : "agenda",
  );

  // Modals state
  const [novoModalOpen, setNovoModalOpen] = useState(false);
  const [cancelarModalOpen, setCancelarModalOpen] = useState(false);
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [motoristaModalOpen, setMotoristaModalOpen] = useState(false);
  const [observacaoModalOpen, setObservacaoModalOpen] = useState(false);
  const [reagendarModalOpen, setReagendarModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);

  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    setNovoModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("novo");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const requestedType = searchParams.get("tipo");
    if (requestedType === "retirada") {
      setFilterRetirada(true);
      setFilterEntrega(false);
    } else if (requestedType === "entrega") {
      setFilterRetirada(false);
      setFilterEntrega(true);
    }
  }, [searchParams]);

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

  // Fetch agendamentos from database
  const filtroData = useMemo(() => ({
    inicio: format(startDate, "yyyy-MM-dd"),
    fim: format(endDate, "yyyy-MM-dd"),
  }), [startDate, endDate]);

  const {
    createAgendamento,
    updateAgendamento,
  } = useAgendamentos();

  const { data: agendamentos = [], isLoading } = useFilteredAgendamentos(filtroData);

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
    return agendamentos.filter((agendamento) => {
      const agendamentoDate = new Date(agendamento.data + "T12:00:00");
      const matchesDate = isSameDay(agendamentoDate, date);
      const matchesTypeFilter =
        (filterRetirada && agendamento.tipo === "retirada") ||
        (filterEntrega && agendamento.tipo === "entrega");
      const matchesStatusFilter =
        (showCanceled || agendamento.status !== "cancelado") &&
        (showCompleted || agendamento.status !== "realizado");
      return matchesDate && matchesTypeFilter && matchesStatusFilter;
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

  // Handlers
  const handleCreateAgendamento = (agendamento: AgendamentoInsert) => {
    createAgendamento.mutate(agendamento, {
      onSuccess: () => setNovoModalOpen(false),
    });
  };

  const handleMarkCompleted = (id: string) => {
    updateAgendamento.mutate({ id, status: "realizado" });
  };

  const handleCancelAgendamento = (id: string, motivo: string) => {
    const observacoesAtuais = selectedAgendamento?.observacoes || "";
    const novasObservacoes = motivo
      ? `${observacoesAtuais}\n[Cancelado] ${motivo}`.trim()
      : observacoesAtuais;

    updateAgendamento.mutate(
      { id, status: "cancelado", observacoes: novasObservacoes },
      { onSuccess: () => setCancelarModalOpen(false) }
    );
  };

  const handleUpdateAgendamento = (id: string, updates: AgendamentoUpdate) => {
    updateAgendamento.mutate({ id, ...updates });
  };

  const handleAssignDriver = (id: string, motoristaId: string | null) => {
    updateAgendamento.mutate({ id, motorista_id: motoristaId });
  };

  const handleAddObservation = (id: string, observacoes: string) => {
    updateAgendamento.mutate({ id, observacoes });
  };

  const handleReschedule = (id: string, novaData: string, novoHorario: string | null) => {
    updateAgendamento.mutate({ id, data: novaData, horario: novoHorario });
  };

  // Modal openers
  const openCancelarModal = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setCancelarModalOpen(true);
  };

  const openDetalhesModal = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setDetalhesModalOpen(true);
  };

  const openMotoristaModal = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setMotoristaModalOpen(true);
  };

  const openObservacaoModal = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setObservacaoModalOpen(true);
  };

  const openReagendarModal = (agendamento: Agendamento) => {
    setSelectedAgendamento(agendamento);
    setReagendarModalOpen(true);
  };

  return (
    <AppLayout title="Agenda" subtitle={`Programação de retiradas e entregas - ${activeArea.charAt(0).toUpperCase() + activeArea.slice(1)}`}>
      <div className="page-shell">
        <PageHeader
          eyebrow="Logística e agendamentos"
          title="Agenda Operacional"
          description="Controle integrado de coletas e entregas planejadas"
          actions={(
            <Button onClick={() => setNovoModalOpen(true)} className="w-full gap-2 font-bold sm:w-auto">
              <Plus className="h-4 w-4" />
              Novo Agendamento
            </Button>
          )}
        />

        <Tabs value={workspaceView} onValueChange={(value) => setWorkspaceView(value as "agenda" | "rotas")}>
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl bg-muted/70 p-1 sm:w-[360px]">
            <TabsTrigger value="agenda" className="gap-2 py-2.5 font-bold">
              <Package className="h-4 w-4" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="rotas" className="gap-2 py-2.5 font-bold">
              <Truck className="h-4 w-4" /> Rotas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {workspaceView === "agenda" ? (
        <div className="space-y-3">
        {/* Header with filters and navigation */}
        <div className="page-toolbar md:justify-between">
          {/* Left side - Filters */}
          <div className="flex items-center gap-2 flex-wrap">
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

            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className={`gap-1.5 text-xs ${showCompleted ? "text-emerald-600" : "text-muted-foreground"}`}
            >
              {showCompleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Realizados
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCanceled(!showCanceled)}
              className={`gap-1.5 text-xs ${showCanceled ? "text-destructive" : "text-muted-foreground"}`}
            >
              {showCanceled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Cancelados
            </Button>

            <div className="hidden lg:flex items-center gap-1">
              <div className="h-6 w-px bg-border mx-1" />
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

          {/* Right side - Navigation and Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-sm text-muted-foreground min-w-[120px] sm:min-w-[160px] text-center">
                {formatDateRange()}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center bg-muted rounded-lg p-0.5 sm:p-1">
              <Button
                variant={viewType === "semanal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("semanal")}
                className={`text-xs sm:text-sm px-2 sm:px-3 ${viewType === "semanal" ? "" : "text-muted-foreground"}`}
              >
                Sem.
              </Button>
              <Button
                variant={viewType === "quinzenal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("quinzenal")}
                className={`text-xs sm:text-sm px-2 sm:px-3 ${viewType === "quinzenal" ? "" : "text-muted-foreground"}`}
              >
                Quinz.
              </Button>
              <Button
                variant={viewType === "mensal" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewType("mensal")}
                className={`text-xs sm:text-sm px-2 sm:px-3 ${viewType === "mensal" ? "" : "text-muted-foreground"}`}
              >
                Mensal
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-lg border border-border overflow-hidden overflow-x-auto">
          {/* Header row with day names */}
          <div className="grid grid-cols-7 border-b border-border min-w-[700px]">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-4 py-3 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Calendar rows */}
          {!isLoading &&
            Array.from({ length: weeksToShow }).map((_, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 border-b border-border last:border-b-0 min-w-[700px]">
                {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date, dayIndex) => {
                  const dayEvents = getEventsForDay(date);
                  const isWeekend = isFriday(date);
                  const isToday = isSameDay(date, new Date());

                  return (
                    <div
                      key={dayIndex}
                      className={`min-h-[120px] p-3 border-r border-border last:border-r-0 flex flex-col ${
                        isToday ? "bg-primary/5" : ""
                      }`}
                    >
                      {/* Date */}
                      <span
                        className={`text-sm font-medium mb-2 ${
                          isToday
                            ? "text-primary font-black"
                            : isWeekend
                            ? "text-destructive"
                            : "text-foreground"
                        }`}
                      >
                        {format(date, "dd/MM")}
                      </span>

                      {/* Events */}
                      <div className="flex-1 space-y-2">
                        {dayEvents.length > 0 ? (
                          dayEvents.map((agendamento) => (
                            <AgendaEventCard
                              key={agendamento.id}
                              agendamento={agendamento}
                              onMarkCompleted={handleMarkCompleted}
                              onCancel={openCancelarModal}
                              onReschedule={openReagendarModal}
                              onAssignDriver={openMotoristaModal}
                              onAddObservation={openObservacaoModal}
                              onViewDetails={openDetalhesModal}
                            />
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
        ) : (
          <RouteWorkspace
            date={format(currentDate, "yyyy-MM-dd")}
            onPreviousDay={() => setCurrentDate(addDays(currentDate, -1))}
            onNextDay={() => setCurrentDate(addDays(currentDate, 1))}
          />
        )}

      {/* Modals */}
      <NovoAgendamentoModal
        open={novoModalOpen}
        onOpenChange={setNovoModalOpen}
        onSave={handleCreateAgendamento}
      />

      <CancelarAgendamentoModal
        open={cancelarModalOpen}
        onOpenChange={setCancelarModalOpen}
        agendamento={selectedAgendamento}
        onConfirm={handleCancelAgendamento}
      />

      <DetalhesAgendamentoModal
        open={detalhesModalOpen}
        onOpenChange={setDetalhesModalOpen}
        agendamento={selectedAgendamento}
        onSave={handleUpdateAgendamento}
      />

      <AtribuirMotoristaModal
        open={motoristaModalOpen}
        onOpenChange={setMotoristaModalOpen}
        agendamento={selectedAgendamento}
        onSave={handleAssignDriver}
      />

      <ObservacaoModal
        open={observacaoModalOpen}
        onOpenChange={setObservacaoModalOpen}
        agendamento={selectedAgendamento}
        onSave={handleAddObservation}
      />

      <ReagendarModal
        open={reagendarModalOpen}
        onOpenChange={setReagendarModalOpen}
        agendamento={selectedAgendamento}
        onSave={handleReschedule}
      />
      </div>
    </AppLayout>
  );
}
