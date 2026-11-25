import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Route, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapBaseLayer } from "@/components/ui/MapBaseLayer";
import { useConfiguracoesGerais } from "@/hooks/useConfiguracoesGerais";
import type { DeliveryDayStop } from "@/hooks/useDeliveryDayStops";
import type { AddressSnapshot, RotaEntrega } from "@/hooks/useRotasEntrega";
import { cn } from "@/lib/utils";

interface DeliveryDayMapProps {
  routes: RotaEntrega[];
  stops: DeliveryDayStop[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

interface MapStop {
  key: string;
  type: "retirada" | "entrega";
  customerName: string;
  address: AddressSnapshot | null;
  rolNumber: string | null;
  scheduledTime: string | null;
  overdue?: boolean;
}

interface StopGroup {
  key: string;
  label: string;
  description: string;
  savedOrder: boolean;
  stops: MapStop[];
}

function hasCoordinates(address: AddressSnapshot | null | undefined): address is AddressSnapshot & { latitude: number; longitude: number } {
  return address?.latitude != null
    && address?.longitude != null
    && Number.isFinite(Number(address.latitude))
    && Number.isFinite(Number(address.longitude));
}

function haversineKm(a: [number, number], b: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLat = radians(b[0] - a[0]);
  const deltaLng = radians(b[1] - a[1]);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(a[0])) * Math.cos(radians(b[0])) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function sortByProximity(stops: MapStop[], origin: [number, number] | null): MapStop[] {
  if (!origin) {
    return [...stops].sort((a, b) => (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99"));
  }

  const pending = [...stops];
  const ordered: MapStop[] = [];
  let current = origin;
  while (pending.length) {
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    pending.forEach((stop, index) => {
      if (!hasCoordinates(stop.address)) return;
      const distance = haversineKm(current, [Number(stop.address.latitude), Number(stop.address.longitude)]);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    if (nearestIndex < 0) {
      ordered.push(...pending.splice(0).sort((a, b) => (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99")));
      break;
    }
    const [next] = pending.splice(nearestIndex, 1);
    ordered.push(next);
    if (hasCoordinates(next.address)) current = [Number(next.address.latitude), Number(next.address.longitude)];
  }
  return ordered;
}

function stopAddress(address: AddressSnapshot | null) {
  if (!address) return "Endereço não informado";
  const street = [address.logradouro, address.numero].filter(Boolean).join(", ");
  const neighborhood = [address.bairro, address.cidade, address.uf].filter(Boolean).join(" · ");
  return [street, neighborhood].filter(Boolean).join(" — ") || "Endereço não informado";
}

function numberedMarker(number: number, isPickup = false) {
  const background = isPickup ? "#d97706" : "#2563eb";
  return new L.DivIcon({
    className: "delivery-sequence-marker",
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid #fff;border-radius:50%;background:${background};color:#fff;font:700 13px/1 system-ui;box-shadow:0 2px 8px #0f172a55">${number}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function originMarker() {
  return new L.DivIcon({
    className: "delivery-sequence-origin",
    html: '<span style="display:grid;place-items:center;width:30px;height:30px;border:2px solid #fff;border-radius:8px;background:#0f172a;color:#fff;font:700 12px/1 system-ui;box-shadow:0 2px 8px #0f172a55">L</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitMap({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export function DeliveryDayMap({ routes, stops, isLoading, isError, onRetry }: DeliveryDayMapProps) {
  const { configuracao } = useConfiguracoesGerais();
  const origin = useMemo<[number, number] | null>(() => {
    const latitude = configuracao?.endereco_latitude;
    const longitude = configuracao?.endereco_longitude;
    return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [latitude, longitude]
      : null;
  }, [configuracao?.endereco_latitude, configuracao?.endereco_longitude]);

  const activeRoutes = useMemo(() => routes.filter((route) => route.status !== "cancelada"), [routes]);
  const assignedOrderIds = useMemo(() => new Set(activeRoutes.flatMap((route) => (route.paradas || [])
    .filter((stop) => stop.status !== "cancelada")
    .map((stop) => stop.ordem_servico_id)
    .filter((id): id is string => Boolean(id)))), [activeRoutes]);
  const assignedAppointmentIds = useMemo(() => new Set(activeRoutes.flatMap((route) => (route.paradas || [])
    .filter((stop) => stop.status !== "cancelada")
    .map((stop) => stop.agendamento_id)
    .filter((id): id is string => Boolean(id)))), [activeRoutes]);
  const pendingStops = useMemo(() => stops.filter((stop) =>
    !(stop.orderId && assignedOrderIds.has(stop.orderId))
    && !(stop.appointmentId && assignedAppointmentIds.has(stop.appointmentId)),
  ), [assignedAppointmentIds, assignedOrderIds, stops]);

  const groups = useMemo<StopGroup[]>(() => {
    const savedGroups = activeRoutes
      .filter((route) => route.paradas?.some((stop) => stop.status !== "cancelada"))
      .map((route) => ({
        key: `route:${route.id}`,
        label: `Rota · ${route.motorista?.nome || route.veiculo?.placa || route.id.slice(0, 8)}`,
        description: `Sequência salva · ${route.paradas?.filter((stop) => stop.status !== "cancelada").length || 0} paradas`,
        savedOrder: true,
        stops: [...(route.paradas || [])]
          .filter((stop) => stop.status !== "cancelada")
          .sort((a, b) => a.ordem - b.ordem)
          .map((stop) => ({
            key: `route-stop:${stop.id}`,
            type: stop.tipo,
            customerName: stop.cliente?.nome_fantasia || stop.cliente?.razao_social || "Cliente não identificado",
            address: stop.endereco_snapshot || null,
            rolNumber: stop.ordem_servico?.numero || null,
            scheduledTime: stop.janela_inicio,
            overdue: false,
          })),
      }));
    const suggested = pendingStops.length ? [{
      key: "suggested",
      label: "Pendentes sem rota",
      description: `${pendingStops.length} paradas · sequência sugerida`,
      savedOrder: false,
      stops: pendingStops.map((stop) => ({
        key: stop.key,
        type: stop.type,
        customerName: stop.customerName,
        address: stop.address,
        rolNumber: stop.rolNumber,
        scheduledTime: stop.scheduledTime,
        overdue: stop.overdue,
      })),
    }] : [];
    return [...savedGroups, ...suggested];
  }, [activeRoutes, pendingStops]);

  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  useEffect(() => {
    if (!groups.some((group) => group.key === selectedGroupKey)) setSelectedGroupKey(groups[0]?.key || "");
  }, [groups, selectedGroupKey]);

  const selectedGroup = groups.find((group) => group.key === selectedGroupKey) || null;
  const orderedStops = useMemo(() => {
    if (!selectedGroup || selectedGroup.savedOrder) return selectedGroup?.stops || [];
    return sortByProximity(selectedGroup.stops, origin);
  }, [origin, selectedGroup]);

  const mappedStops = useMemo(() => orderedStops.filter((stop) => hasCoordinates(stop.address)), [orderedStops]);
  const points = useMemo<Array<[number, number]>>(() => {
    const customerPoints = mappedStops.map((stop) => [Number(stop.address!.latitude), Number(stop.address!.longitude)] as [number, number]);
    return origin ? [origin, ...customerPoints] : customerPoints;
  }, [mappedStops, origin]);
  const center = points[0] || [-23.5505, -46.6333];
  const line = useMemo(() => [
    ...(origin ? [origin] : []),
    ...mappedStops.map((stop) => [Number(stop.address!.latitude), Number(stop.address!.longitude)] as [number, number]),
  ], [mappedStops, origin]);

  return (
    <Card className="overflow-hidden rounded-2xl shadow-sm" data-testid="delivery-day-map">
      <CardHeader className="gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><Route className="h-5 w-5 text-primary" />Mapa e sequência do dia</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Rotas salvas mantêm a ordem definida; paradas sem rota recebem uma sugestão pela proximidade em linha reta.</p>
        </div>
        {groups.length > 1 && (
          <Select value={selectedGroupKey} onValueChange={setSelectedGroupKey}>
            <SelectTrigger className="w-full sm:w-[280px]" aria-label="Selecionar sequência para o mapa"><SelectValue placeholder="Selecione uma sequência" /></SelectTrigger>
            <SelectContent>{groups.map((group) => <SelectItem key={group.key} value={group.key}>{group.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)] sm:p-5">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border bg-muted/20 text-sm text-muted-foreground" role="status">Buscando paradas do dia…</div>
        ) : isError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/10 px-5 text-center lg:col-span-2" role="alert">
            <p className="font-semibold">Não foi possível buscar as rotas e paradas desta data.</p>
            <Button variant="outline" onClick={onRetry}>Tentar novamente</Button>
          </div>
        ) : !selectedGroup ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-5 text-center lg:col-span-2">
            <Truck className="h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 font-semibold">Nenhuma coleta, entrega ou ROL pendente para esta data.</p>
            <p className="mt-1 text-sm text-muted-foreground">Escolha outra data e clique em Buscar.</p>
          </div>
        ) : (
          <>
            <div className="min-w-0">
              {mappedStops.length ? (
                <div className="h-[320px] overflow-hidden rounded-xl border bg-muted/20 sm:h-[380px]">
                  <MapContainer key={`${selectedGroup.key}:${mappedStops.map((stop) => stop.key).join(",")}`} center={center} zoom={12} className="h-full w-full" scrollWheelZoom>
                    <MapBaseLayer />
                    <FitMap points={points} />
                    {origin && <Marker position={origin} icon={originMarker()}><Popup><strong>{configuracao?.nome_empresa || "Lavanderia"}</strong><br />Ponto de saída</Popup></Marker>}
                    {mappedStops.map((stop) => {
                      const sequenceNumber = orderedStops.findIndex((item) => item.key === stop.key) + 1;
                      const position: [number, number] = [Number(stop.address!.latitude), Number(stop.address!.longitude)];
                      return <Marker key={stop.key} position={position} icon={numberedMarker(sequenceNumber, stop.type === "retirada")}>
                        <Popup>
                          <strong>{sequenceNumber}. {stop.type === "retirada" ? "Coleta" : "Entrega"}</strong><br />
                          {stop.customerName}<br />
                          {stop.rolNumber ? `ROL ${stop.rolNumber} · ` : ""}{stop.scheduledTime ? stop.scheduledTime.slice(0, 5) : "Sem horário"}<br />
                          {stopAddress(stop.address)}
                        </Popup>
                      </Marker>;
                    })}
                    {line.length > 1 && <Polyline positions={line} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.75, dashArray: selectedGroup.savedOrder ? undefined : "8 8" }} />}
                  </MapContainer>
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-5 text-center">
                  <MapPin className="h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 font-semibold">Sem coordenadas para exibir as paradas no mapa.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Confira se os endereços dos clientes têm localização cadastrada.</p>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />Entrega</span>
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-600" />Coleta</span>
                {origin && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-slate-900" />Lavanderia</span>}
                <span className="basis-full">O traçado é ilustrativo e não considera ruas, trânsito ou restrições viárias.</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">{selectedGroup.label}</h3>
                  <p className="text-xs text-muted-foreground">{selectedGroup.savedOrder ? selectedGroup.description : origin ? "Sugestão por proximidade a partir da lavanderia" : "Sem coordenadas da lavanderia: ordenado pelo horário"}</p>
                </div>
                <Badge variant="secondary">{orderedStops.length} paradas</Badge>
              </div>
              {orderedStops.length ? (
                <ol className="max-h-[380px] space-y-2 overflow-y-auto pr-1" aria-label="Sequência de atendimento">
                  {orderedStops.map((stop, index) => (
                    <li key={stop.key} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white", stop.type === "retirada" ? "bg-amber-600" : "bg-blue-600")}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{stop.customerName}</p>
                          <Badge variant="outline" className="text-[10px]">{stop.type === "retirada" ? "Coleta" : "Entrega"}</Badge>
                          {stop.rolNumber && <Badge variant="secondary" className="text-[10px]">ROL {stop.rolNumber}</Badge>}
                          {!hasCoordinates(stop.address) && <Badge variant="outline" className="text-[10px]">Sem coordenadas</Badge>}
                          {stop.overdue && <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{stopAddress(stop.address)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{stop.scheduledTime ? `Horário: ${stop.scheduledTime.slice(0, 5)}` : "Horário não definido"}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhuma parada nesta sequência.</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
