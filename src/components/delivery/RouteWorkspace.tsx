import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Gauge,
  History,
  Images,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  RefreshCw,
  Route,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRotasDoDia, useRotaOperacoes, useRotasEntregaMutations } from "@/hooks/useRotasEntrega";
import type { AddressSnapshot, ParadaRota, RotaEntrega, RouteEventType } from "@/hooks/useRotasEntrega";
import { NovaRotaModal } from "@/components/delivery/NovaRotaModal";
import { SignaturePad } from "@/components/delivery/SignaturePad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createDeliveryEvidenceSignedUrl,
  isDeliveryEvidencePath,
  removeOrphanDeliveryEvidence,
  uploadDeliveryEvidence,
  validateDeliveryEvidenceFile,
} from "@/lib/deliveryEvidence";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

interface RouteWorkspaceProps {
  date: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

interface RouteCandidate {
  key: string;
  type: "retirada" | "entrega";
  label: string;
  customerId: string;
  appointmentId: string | null;
  orderId: string | null;
  suggestedTime: string | null;
}

interface ReadyDeliveryRol {
  id: string;
  numero: string;
  cliente: {
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
}

const routeStatus = {
  pendente: { label: "Planejada", className: "border-slate-200 bg-slate-100 text-slate-700" },
  em_rota: { label: "Em rota", className: "border-blue-200 bg-blue-50 text-blue-700" },
  concluida: { label: "Concluída", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  cancelada: { label: "Cancelada", className: "border-red-200 bg-red-50 text-red-700" },
} as const;

const stopStatus: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "border-slate-200 bg-slate-50 text-slate-700" },
  em_atendimento: { label: "No local", className: "border-blue-200 bg-blue-50 text-blue-700" },
  realizada: { label: "Realizada", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  tentativa_falha: { label: "Tentativa sem sucesso", className: "border-red-200 bg-red-50 text-red-700" },
  reagendada: { label: "Reagendada", className: "border-amber-200 bg-amber-50 text-amber-700" },
  cancelada: { label: "Cancelada", className: "border-red-200 bg-red-50 text-red-700" },
};

const eventLabels: Record<RouteEventType, string> = {
  CHEGADA: "Chegada",
  OCORRENCIA: "Ocorrência",
  TENTATIVA_FALHA: "Tentativa sem sucesso",
  REAGENDAMENTO: "Reagendamento",
  CONCLUIDA: "Conclusão",
  ENDERECO_CORRIGIDO: "Correção de endereço",
};

function customerName(stop: ParadaRota) {
  return stop.cliente?.nome_fantasia || stop.cliente?.razao_social || "Cliente não identificado";
}

function addressText(address: AddressSnapshot | null | undefined) {
  if (!address) return "Endereço não informado";
  const street = [address.logradouro, address.numero].filter(Boolean).join(", ");
  const city = [address.bairro, address.cidade, address.uf].filter(Boolean).join(" · ");
  return [street, city].filter(Boolean).join(" — ") || "Endereço não informado";
}

function timeText(time: string | null) {
  return time ? time.slice(0, 5) : null;
}

export function RouteWorkspace({ date, onPreviousDay, onNextDay }: RouteWorkspaceProps) {
  const { data: routes = [], isLoading, isFetching, refetch } = useRotasDoDia(date);
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const mutations = useRotasEntregaMutations();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [newRouteOpen, setNewRouteOpen] = useState(false);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [eventState, setEventState] = useState<{ stop: ParadaRota; type: RouteEventType } | null>(null);
  const [odometerMode, setOdometerMode] = useState<"start" | "finish" | null>(null);
  const isPastDate = date < format(new Date(), "yyyy-MM-dd");
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const { data: readyDeliveryRols = [] } = useQuery<ReadyDeliveryRol[]>({
    queryKey: ["delivery-ready-rols", session?.user.id, activeTenant?.id, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar deliveries prontos");
      }

      let query = supabase
        .from("ordens_servico")
        .select("id, numero, cliente:clientes(razao_social, nome_fantasia)")
        .filter("tenant_id", "eq", activeTenant.id)
        .in("status_logistica", ["aguardando_entrega", "entrega_parcial", "tentativa_falha"])
        .order("data_previsao_entrega", { ascending: true });

      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ReadyDeliveryRol[];
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!routes.length) {
      setSelectedRouteId(null);
      return;
    }
    if (!selectedRouteId || !routes.some((route) => route.id === selectedRouteId)) {
      setSelectedRouteId(routes[0].id);
    }
  }, [routes, selectedRouteId]);

  const selectedRoute = routes.find((route) => route.id === selectedRouteId) || null;

  const moveStop = async (stopId: string, direction: -1 | 1) => {
    if (!selectedRoute?.paradas) return;
    const ids = selectedRoute.paradas.map((stop) => stop.id);
    const index = ids.indexOf(stopId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await mutations.reordenarParadas.mutateAsync({ rotaId: selectedRoute.id, paradaIds: ids });
  };

  return (
    <section className="space-y-4" data-testid="route-workspace">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Route className="h-4 w-4" /> Execução logística
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">Rotas do dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(new Date(`${date}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR })} · ordem manual e histórico auditável
            </p>
          </div>
          <div className="grid w-full grid-cols-[40px_40px_40px_minmax(0,1fr)] gap-2 sm:flex sm:w-auto">
            <Button variant="outline" size="icon" onClick={onPreviousDay} aria-label="Dia anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onNextDay} aria-label="Próximo dia">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()} aria-label="Atualizar rotas">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button className="flex-1 gap-2 font-bold sm:flex-none" onClick={() => setNewRouteOpen(true)} disabled={isPastDate}>
              <Plus className="h-4 w-4" /> Nova rota
            </Button>
          </div>
        </div>
      </div>

      {readyDeliveryRols.length > 0 && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white"><Truck className="h-5 w-5" /></div>
            <div>
              <p className="font-black">{readyDeliveryRols.length} ROL{readyDeliveryRols.length === 1 ? "" : "s"} pronto{readyDeliveryRols.length === 1 ? "" : "s"} para delivery</p>
              <p className="mt-0.5 text-sm text-emerald-800">Aguardando inclusão em uma rota de Entregas e Coletas. {readyDeliveryRols.slice(0, 3).map((rol) => `ROL ${rol.numero}`).join(" · ")}{readyDeliveryRols.length > 3 ? " · …" : ""}</p>
            </div>
          </div>
          <Badge className="w-fit bg-emerald-700 text-white hover:bg-emerald-700">Disponível para rota</Badge>
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : routes.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 text-center">
          <div className="rounded-2xl bg-primary/10 p-4 text-primary"><Truck className="h-8 w-8" /></div>
          <h3 className="mt-4 text-lg font-black">Nenhuma rota planejada</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Crie a rota, inclua as paradas na ordem real de atendimento e atribua motorista e veículo.</p>
          <Button className="mt-5 gap-2" onClick={() => setNewRouteOpen(true)} disabled={isPastDate}><Plus className="h-4 w-4" /> Criar primeira rota</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {routes.map((route) => <RouteSelector key={route.id} route={route} selected={route.id === selectedRouteId} onSelect={() => setSelectedRouteId(route.id)} />)}
          </div>
          {selectedRoute && (
            <RouteDetail
              route={selectedRoute}
              onAddStop={() => setAddStopOpen(true)}
              onStart={() => setOdometerMode("start")}
              onFinish={() => setOdometerMode("finish")}
              onMoveStop={moveStop}
              onEvent={(stop, type) => setEventState({ stop, type })}
              reorderPending={mutations.reordenarParadas.isPending}
            />
          )}
        </div>
      )}

      <NovaRotaModal open={newRouteOpen} onOpenChange={setNewRouteOpen} defaultDate={date} onSuccess={setSelectedRouteId} />
      {selectedRoute && <AddStopDialog open={addStopOpen} onOpenChange={setAddStopOpen} route={selectedRoute} date={date} />}
      {eventState && <RouteEventDialog state={eventState} onOpenChange={(open) => !open && setEventState(null)} />}
      {selectedRoute && odometerMode && <OdometerDialog mode={odometerMode} route={selectedRoute} onOpenChange={(open) => !open && setOdometerMode(null)} />}
    </section>
  );
}

function RouteSelector({ route, selected, onSelect }: { route: RotaEntrega; selected: boolean; onSelect: () => void }) {
  const status = routeStatus[route.status];
  const stops = route.paradas || [];
  const completed = stops.filter((stop) => stop.status === "realizada").length;
  return (
    <button type="button" onClick={onSelect} className={cn("w-full rounded-2xl border bg-card p-4 text-left shadow-sm transition", selected ? "border-primary ring-2 ring-primary/10" : "hover:border-primary/40")}>
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline" className={cn("font-bold", status.className)}>{status.label}</Badge>
        <span className="text-xs font-bold text-muted-foreground">{completed}/{stops.length} paradas</span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 font-bold"><UserRound className="h-4 w-4 text-primary" />{route.motorista?.nome || "Sem motorista"}</div>
        <div className="flex items-center gap-2 text-muted-foreground"><Truck className="h-4 w-4" />{route.veiculo ? `${route.veiculo.modelo} · ${route.veiculo.placa}` : "Sem veículo"}</div>
      </div>
    </button>
  );
}

function RouteDetail({ route, onAddStop, onStart, onFinish, onMoveStop, onEvent, reorderPending }: {
  route: RotaEntrega;
  onAddStop: () => void;
  onStart: () => void;
  onFinish: () => void;
  onMoveStop: (id: string, direction: -1 | 1) => void;
  onEvent: (stop: ParadaRota, type: RouteEventType) => void;
  reorderPending: boolean;
}) {
  const { data: history = [] } = useRotaOperacoes(route.id);
  const stops = route.paradas || [];
  const unresolved = stops.filter((stop) => ["pendente", "em_atendimento"].includes(stop.status)).length;
  return (
    <Card className="min-w-0 overflow-hidden rounded-2xl shadow-sm">
      <CardHeader className="border-b bg-muted/20 p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl"><Navigation className="h-5 w-5 text-primary" /> Rota operacional</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{route.observacoes || "Sem observações de planejamento."}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {route.status === "pendente" && <><Button variant="outline" className="gap-2" onClick={onAddStop}><Plus className="h-4 w-4" /> Adicionar parada</Button><Button className="gap-2" onClick={onStart}><Navigation className="h-4 w-4" /> Iniciar rota</Button></>}
            {route.status === "em_rota" && <Button className="gap-2" onClick={onFinish} disabled={unresolved > 0}><CheckCircle2 className="h-4 w-4" /> Finalizar rota</Button>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Paradas" value={String(stops.length)} />
          <Metric label="Pendentes" value={String(unresolved)} />
          <Metric label="KM inicial" value={route.km_inicial?.toLocaleString("pt-BR") || "—"} />
          <Metric label="KM final" value={route.km_final?.toLocaleString("pt-BR") || "—"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">
        <div>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-black">Sequência de atendimento</h3>{route.status === "pendente" && <span className="text-xs text-muted-foreground">Ordenação manual</span>}</div>
          {stops.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Adicione ao menos uma parada antes de iniciar.</div> : (
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <StopCard key={stop.id} stop={stop} routeStatus={route.status} first={index === 0} last={index === stops.length - 1} onMove={(direction) => onMoveStop(stop.id, direction)} onEvent={(type) => onEvent(stop, type)} reorderPending={reorderPending} />
              ))}
            </div>
          )}
        </div>
        <Separator />
        <div>
          <div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-primary" /><h3 className="font-black">Histórico da rota</h3></div>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma operação registrada.</p> : (
            <div className="space-y-2">
              {history.slice(0, 8).map((operation) => <div key={operation.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2"><div><p className="text-sm font-bold">{eventLabels[operation.tipo as RouteEventType] || operation.tipo.replace(/_/g, " ")}</p>{operation.endereco_anterior && <p className="text-xs text-muted-foreground">Endereço anterior preservado no histórico.</p>}</div><time className="shrink-0 text-xs text-muted-foreground">{format(new Date(operation.created_at), "dd/MM HH:mm")}</time></div>)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-background px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}

function StopCard({ stop, routeStatus: currentRouteStatus, first, last, onMove, onEvent, reorderPending }: {
  stop: ParadaRota;
  routeStatus: RotaEntrega["status"];
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onEvent: (type: RouteEventType) => void;
  reorderPending: boolean;
}) {
  const status = stopStatus[stop.status] || stopStatus.pendente;
  const active = currentRouteStatus === "em_rota" && !["realizada", "cancelada"].includes(stop.status);
  return (
    <article className="rounded-2xl border bg-background p-4" data-testid="route-stop-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{stop.ordem}</span><Badge variant="outline" className={cn("font-bold", status.className)}>{status.label}</Badge><Badge variant="outline">{stop.tipo === "retirada" ? "Retirada" : "Entrega"}</Badge>{stop.tentativas > 0 && <span className="text-xs font-bold text-red-600">{stop.tentativas} tentativa(s)</span>}</div>
          <h4 className="mt-3 font-black">{customerName(stop)}{stop.ordem_servico && <span className="ml-2 font-medium text-muted-foreground">ROL {stop.ordem_servico.numero}</span>}</h4>
          <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{addressText(stop.endereco_snapshot)}</p>
          {(stop.janela_inicio || stop.janela_fim) && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Janela {timeText(stop.janela_inicio) || "—"}–{timeText(stop.janela_fim) || "—"}</p>}
          {stop.reagendada_para && <p className="mt-2 text-xs font-bold text-amber-700">Reagendada para {format(new Date(stop.reagendada_para), "dd/MM/yyyy HH:mm")}</p>}
          {stop.motivo_nao_entrega && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{stop.motivo_nao_entrega}</p>}
          {(isDeliveryEvidencePath(stop.foto_comprovante_url) || isDeliveryEvidencePath(stop.assinatura_url)) && (
            <DeliveryEvidenceViewer stop={stop} />
          )}
        </div>
        {currentRouteStatus === "pendente" && <div className="flex shrink-0 gap-1"><Button variant="outline" size="icon" disabled={first || reorderPending} onClick={() => onMove(-1)} aria-label="Mover parada para cima"><ArrowUp className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={last || reorderPending} onClick={() => onMove(1)} aria-label="Mover parada para baixo"><ArrowDown className="h-4 w-4" /></Button></div>}
      </div>
      {(active || ["pendente", "em_rota"].includes(currentRouteStatus)) && <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
        {active && stop.status !== "em_atendimento" && <Button size="sm" className="gap-1.5" onClick={() => onEvent("CHEGADA")}><CircleDot className="h-3.5 w-3.5" /> Cheguei</Button>}
        {active && stop.status === "em_atendimento" && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onEvent("CONCLUIDA")}><PackageCheck className="h-3.5 w-3.5" /> Concluir</Button>}
        {active && stop.status === "em_atendimento" && <Button size="sm" variant="outline" className="gap-1.5 text-red-600" onClick={() => onEvent("TENTATIVA_FALHA")}><AlertTriangle className="h-3.5 w-3.5" /> Tentativa sem sucesso</Button>}
        {active && <Button size="sm" variant="ghost" onClick={() => onEvent("OCORRENCIA")}>Registrar ocorrência</Button>}
        {!["realizada", "cancelada"].includes(stop.status) && <Button size="sm" variant="ghost" onClick={() => onEvent("ENDERECO_CORRIGIDO")}><MapPin className="mr-1.5 h-3.5 w-3.5" /> Corrigir endereço</Button>}
      </div>}
    </article>
  );
}

function AddStopDialog({ open, onOpenChange, route, date }: { open: boolean; onOpenChange: (open: boolean) => void; route: RotaEntrega; date: string }) {
  const { addParada } = useRotasEntregaMutations();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const [candidateKey, setCandidateKey] = useState("");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [notes, setNotes] = useState("");
  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["route-stop-candidates", session?.user.id, activeTenant?.id, activeArea, date],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para montar a rota");
      }
      let appointmentsQuery = supabase
        .from("agendamentos")
        .select("id, cliente_id, tipo, horario, status, cliente:clientes!fk_agendamentos_cliente!inner(razao_social, classificacao, tenant_id)")
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("data", date)
        .neq("status", "cancelado");
      if (activeArea !== "central") appointmentsQuery = appointmentsQuery.eq("cliente.classificacao", activeArea);
      let ordersQuery = supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, status_logistica, cliente:clientes(razao_social)")
        .filter("tenant_id", "eq", activeTenant.id)
        .in("status_logistica", ["aguardando_entrega", "entrega_parcial", "tentativa_falha"]);
      if (allowedOrigins) ordersQuery = ordersQuery.in("origem", [...allowedOrigins]);
      const [appointments, orders] = await Promise.all([appointmentsQuery, ordersQuery]);
      if (appointments.error) throw appointments.error;
      if (orders.error) throw orders.error;
      const appointmentOptions = (appointments.data || []).map((item) => ({ key: `appointment:${item.id}`, type: item.tipo as "retirada" | "entrega", label: `${item.tipo === "retirada" ? "Retirada" : "Entrega"} · ${item.cliente?.razao_social || "Cliente"}${item.horario ? ` · ${item.horario.slice(0, 5)}` : ""}`, customerId: item.cliente_id, appointmentId: item.id, orderId: null, suggestedTime: item.horario }));
      const orderOptions = (orders.data || []).map((item) => ({ key: `order:${item.id}`, type: "entrega" as const, label: `Entrega · ROL ${item.numero} · ${item.cliente?.razao_social || "Cliente"}`, customerId: item.cliente_id, appointmentId: null, orderId: item.id, suggestedTime: null }));
      return [...appointmentOptions, ...orderOptions] satisfies RouteCandidate[];
    },
    enabled: open && Boolean(session?.user.id && activeTenant?.id),
  });
  const candidate = candidates.find((item) => item.key === candidateKey);
  useEffect(() => { if (open) { setCandidateKey(""); setWindowStart(""); setWindowEnd(""); setNotes(""); } }, [open]);
  useEffect(() => { if (candidate?.suggestedTime) setWindowStart(candidate.suggestedTime.slice(0, 5)); }, [candidate]);
  const submit = async () => {
    if (!candidate) return;
    await addParada.mutateAsync({ rota_id: route.id, tipo: candidate.type, cliente_id: candidate.customerId, ordem_servico_id: candidate.orderId, agendamento_id: candidate.appointmentId, janela_inicio: windowStart || null, janela_fim: windowEnd || null, observacoes: notes || null });
    onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Adicionar parada planejada</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Agendamento ou pedido</Label><Select value={candidateKey} onValueChange={setCandidateKey}><SelectTrigger><SelectValue placeholder={isLoading ? "Carregando..." : "Selecione a origem da parada"} /></SelectTrigger><SelectContent>{candidates.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select>{!isLoading && candidates.length === 0 && <p className="text-xs text-muted-foreground">Nenhum agendamento do dia ou pedido aguardando entrega.</p>}</div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Início da janela</Label><Input type="time" value={windowStart} onChange={(event) => setWindowStart(event.target.value)} /></div><div className="space-y-2"><Label>Fim da janela</Label><Input type="time" value={windowEnd} onChange={(event) => setWindowEnd(event.target.value)} /></div></div><div className="space-y-2"><Label>Instruções</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Referência, portaria ou cuidado especial" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={!candidate || addParada.isPending}>{addParada.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar parada</Button></DialogFooter></DialogContent></Dialog>;
}

function OdometerDialog({ mode, route, onOpenChange }: { mode: "start" | "finish"; route: RotaEntrega; onOpenChange: (open: boolean) => void }) {
  const { iniciarRota, finalizarRota } = useRotasEntregaMutations();
  const [value, setValue] = useState(mode === "start" ? String(route.km_inicial ?? "") : "");
  const pending = iniciarRota.isPending || finalizarRota.isPending;
  const submit = async () => {
    const km = Number(value);
    if (!Number.isFinite(km) || km < 0) return;
    if (mode === "start") await iniciarRota.mutateAsync({ rotaId: route.id, kmInicial: km });
    else await finalizarRota.mutateAsync({ rotaId: route.id, kmFinal: km });
    onOpenChange(false);
  };
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" />{mode === "start" ? "Iniciar rota" : "Finalizar rota"}</DialogTitle></DialogHeader><div className="space-y-2 py-3"><Label>{mode === "start" ? "Quilometragem de saída" : "Quilometragem de retorno"}</Label><Input autoFocus type="number" min={route.km_inicial ?? 0} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Informe o hodômetro" />{mode === "finish" && route.km_inicial !== null && <p className="text-xs text-muted-foreground">KM inicial: {route.km_inicial.toLocaleString("pt-BR")}</p>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={!value || pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "start" ? "Confirmar saída" : "Confirmar retorno"}</Button></DialogFooter></DialogContent></Dialog>;
}

function DeliveryEvidenceViewer({ stop }: { stop: ParadaRota }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Array<{ label: string; url: string }>>([]);
  const references = [
    { label: "Foto da operação", path: stop.foto_comprovante_url },
    { label: "Assinatura do recebedor", path: stop.assinatura_url },
  ].filter((item): item is { label: string; path: string } => isDeliveryEvidencePath(item.path));

  const show = async () => {
    setOpen(true);
    setLoading(true);
    setSignedUrls([]);
    try {
      setSignedUrls(await Promise.all(references.map(async (item) => ({
        label: item.label,
        url: await createDeliveryEvidenceSignedUrl(item.path),
      }))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o comprovante.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="mt-3 gap-1.5" onClick={show}>
        <Images className="h-3.5 w-3.5" /> Ver comprovante{references.length > 1 ? "s" : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Comprovantes privados da parada</DialogTitle></DialogHeader>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {signedUrls.map((item) => (
                <figure key={item.label} className="overflow-hidden rounded-xl border bg-muted/30">
                  <img src={item.url} alt={item.label} className="aspect-[4/3] w-full object-contain" />
                  <figcaption className="border-t px-3 py-2 text-sm font-bold">{item.label}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">O acesso é temporário e restrito à empresa, ao administrador e ao motorista designado.</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RouteEventDialog({ state, onOpenChange }: { state: { stop: ParadaRota; type: RouteEventType }; onOpenChange: (open: boolean) => void }) {
  const { registrarEvento } = useRotasEntregaMutations();
  const { stop, type } = state;
  const [reason, setReason] = useState("");
  const [rescheduledAt, setRescheduledAt] = useState("");
  const [receiver, setReceiver] = useState(stop.recebedor_nome || "");
  const [document, setDocument] = useState(stop.recebedor_documento || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deliveryId, setDeliveryId] = useState("");
  const [address, setAddress] = useState<AddressSnapshot>(stop.endereco_snapshot || {});
  const existingPhoto = isDeliveryEvidencePath(stop.foto_comprovante_url) ? stop.foto_comprovante_url : null;
  const existingSignature = isDeliveryEvidencePath(stop.assinatura_url) ? stop.assinatura_url : null;

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  const { data: deliveryProofs = [] } = useQuery({
    queryKey: ["delivery-proofs", stop.ordem_servico_id],
    queryFn: async () => {
      if (!stop.ordem_servico_id) return [];
      const { data, error } = await supabase
        .from("entregas_pedido")
        .select("id, created_at, nome_recebedor")
        .eq("ordem_servico_id", stop.ordem_servico_id)
        .eq("status", "confirmada")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: type === "CONCLUIDA" && stop.tipo === "entrega" && Boolean(stop.ordem_servico_id),
  });

  const selectPhoto = (file: File | undefined) => {
    if (!file) return;
    try {
      validateDeliveryEvidenceFile(file);
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      toast.error(error instanceof Error ? error.message : "Imagem inválida.");
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const submit = async () => {
    let photoPath = existingPhoto;
    let signaturePath = existingSignature;
    const uploadedPaths: string[] = [];

    if (type === "CONCLUIDA") {
      setUploading(true);
      try {
        if (photoFile) {
          photoPath = await uploadDeliveryEvidence({
            tenantId: stop.tenant_id,
            routeId: stop.rota_id,
            stopId: stop.id,
            purpose: "photo",
            file: photoFile,
          });
          uploadedPaths.push(photoPath);
        }
        if (signatureFile) {
          signaturePath = await uploadDeliveryEvidence({
            tenantId: stop.tenant_id,
            routeId: stop.rota_id,
            stopId: stop.id,
            purpose: "signature",
            file: signatureFile,
          });
          uploadedPaths.push(signaturePath);
        }
      } catch (error) {
        await removeOrphanDeliveryEvidence(uploadedPaths);
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar os comprovantes.");
        setUploading(false);
        return;
      }
    }

    try {
      await registrarEvento.mutateAsync({
        paradaId: stop.id,
        expectedVersion: stop.versao,
        tipo: type,
        motivo: reason || null,
        reagendadaPara: rescheduledAt ? new Date(rescheduledAt).toISOString() : null,
        recebedorNome: receiver || null,
        recebedorDocumento: document || null,
        fotoComprovanteUrl: photoPath,
        assinaturaUrl: signaturePath,
        entregaId: deliveryId || null,
        enderecoCorrigido: type === "ENDERECO_CORRIGIDO" ? address : null,
      });
      onOpenChange(false);
    } catch {
      await removeOrphanDeliveryEvidence(uploadedPaths);
    } finally {
      setUploading(false);
    }
  };

  const needsReason = ["OCORRENCIA", "TENTATIVA_FALHA", "REAGENDAMENTO"].includes(type);
  const needsSchedule = ["TENTATIVA_FALHA", "REAGENDAMENTO"].includes(type);
  const hasPhysicalEvidence = Boolean(document.trim() || photoFile || signatureFile || existingPhoto || existingSignature);
  const valid = type === "CHEGADA"
    || (needsReason && reason.trim().length >= 3 && (type !== "REAGENDAMENTO" || Boolean(rescheduledAt)))
    || (type === "CONCLUIDA" && receiver.trim().length >= 2 && hasPhysicalEvidence && (stop.tipo === "retirada" || Boolean(deliveryId)))
    || (type === "ENDERECO_CORRIGIDO" && Boolean(address.logradouro && address.cidade));
  const pending = uploading || registrarEvento.isPending;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{eventLabels[type]}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {type === "CHEGADA" && <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-700">Confirme que o motorista chegou ao endereço desta parada.</p>}
          {needsReason && <div className="space-y-2"><Label>Motivo ou descrição</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Registre o ocorrido com clareza" /></div>}
          {needsSchedule && <div className="space-y-2"><Label>Reagendar para {type === "TENTATIVA_FALHA" && "(opcional)"}</Label><Input type="datetime-local" value={rescheduledAt} onChange={(event) => setRescheduledAt(event.target.value)} /></div>}
          {type === "CONCLUIDA" && (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
                Fotos e assinaturas ficam privadas. O sistema envia o arquivo somente ao confirmar e libera visualização por link temporário.
              </div>
              <div className="space-y-2"><Label htmlFor={`delivery-receiver-${stop.id}`}>Quem confirmou a operação</Label><Input id={`delivery-receiver-${stop.id}`} value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="Nome do recebedor ou responsável" /></div>
              <div className="space-y-2"><Label htmlFor={`delivery-document-${stop.id}`}>Documento (opcional se houver foto ou assinatura)</Label><Input id={`delivery-document-${stop.id}`} value={document} onChange={(event) => setDocument(event.target.value)} placeholder="CPF, RG ou identificação interna" /></div>
              <div className="space-y-2 rounded-xl border p-3">
                <Label htmlFor={`delivery-photo-${stop.id}`} className="flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Foto da operação</Label>
                <Input
                  id={`delivery-photo-${stop.id}`}
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  disabled={pending}
                  onChange={(event) => selectPhoto(event.target.files?.[0])}
                />
                <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 8 MB. No celular, a câmera traseira será sugerida.</p>
                {photoPreviewUrl && (
                  <div className="relative overflow-hidden rounded-lg border bg-muted/30">
                    <img src={photoPreviewUrl} alt="Prévia da foto da operação" className="max-h-52 w-full object-contain" />
                    <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-8 w-8" onClick={clearPhoto} aria-label="Remover foto"><X className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
              <div className="space-y-2 rounded-xl border p-3">
                <Label>Assinatura do recebedor</Label>
                <SignaturePad disabled={pending} onChange={setSignatureFile} />
              </div>
              {stop.tipo === "entrega" && <div className="space-y-2"><Label htmlFor={`delivery-proof-${stop.id}`}>Comprovante de itens do pedido</Label><Select value={deliveryId} onValueChange={setDeliveryId}><SelectTrigger id={`delivery-proof-${stop.id}`}><SelectValue placeholder="Selecione a entrega confirmada" /></SelectTrigger><SelectContent>{deliveryProofs.map((proof) => <SelectItem key={proof.id} value={proof.id}>{format(new Date(proof.created_at), "dd/MM HH:mm")} · {proof.nome_recebedor}</SelectItem>)}</SelectContent></Select>{deliveryProofs.length === 0 && <p className="text-xs text-amber-700">Registre primeiro a entrega dos itens na tela do pedido.</p>}</div>}
            </>
          )}
          {type === "ENDERECO_CORRIGIDO" && (
            <>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">O endereço anterior continuará preservado no histórico. A correção exige perfil administrador.</p>
              <div className="space-y-2"><Label>Logradouro</Label><Input value={address.logradouro || ""} onChange={(event) => setAddress({ ...address, logradouro: event.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Número</Label><Input value={address.numero || ""} onChange={(event) => setAddress({ ...address, numero: event.target.value })} /></div><div className="space-y-2"><Label>CEP</Label><Input value={address.cep || ""} onChange={(event) => setAddress({ ...address, cep: event.target.value })} /></div></div>
              <div className="space-y-2"><Label>Bairro</Label><Input value={address.bairro || ""} onChange={(event) => setAddress({ ...address, bairro: event.target.value })} /></div>
              <div className="grid grid-cols-[1fr_90px] gap-3"><div className="space-y-2"><Label>Cidade</Label><Input value={address.cidade || ""} onChange={(event) => setAddress({ ...address, cidade: event.target.value })} /></div><div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={address.uf || ""} onChange={(event) => setAddress({ ...address, uf: event.target.value.toUpperCase() })} /></div></div>
              <div className="space-y-2"><Label>Justificativa</Label><Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo da correção" /></div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{uploading ? "Enviando comprovantes..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
