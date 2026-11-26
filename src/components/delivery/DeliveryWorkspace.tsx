import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, ExternalLink, Loader2, RefreshCw, Search, Truck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { getCanonicalPdvPath } from "@/lib/authorization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DeliveryFilter = "dia" | "entregue" | "para_entregar";

type DeliveryRow = {
  id: string;
  origem: string;
  numero: string;
  data_previsao_entrega: string | null;
  data_entrega: string | null;
  status: string;
  status_logistica: string | null;
  cliente: { razao_social: string; nome_fantasia: string | null } | null;
};

function isDelivered(row: DeliveryRow) {
  return row.status === "entregue"
    || row.status_logistica === "entregue"
    || Boolean(row.data_entrega);
}

function dateLabel(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function statusLabel(row: DeliveryRow) {
  return isDelivered(row) ? "Entregue" : "Para entregar";
}

export function DeliveryWorkspace() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filter, setFilter] = useState<DeliveryFilter>("dia");
  const [criteria, setCriteria] = useState({ date: format(new Date(), "yyyy-MM-dd"), filter: "dia" as DeliveryFilter });
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const query = useQuery({
    queryKey: ["delivery-day-orders", session?.user.id, activeTenant?.id, activeArea, criteria.date],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!activeTenant?.id) throw new Error("Selecione uma empresa ativa para consultar o Delivery.");
      let request = supabase
        .from("ordens_servico")
        .select("id,origem,numero,data_previsao_entrega,data_entrega,status,status_logistica,cliente:clientes!ordens_servico_cliente_id_fkey!inner(razao_social,nome_fantasia,tenant_id)")
        .eq("tenant_id", activeTenant.id)
        .eq("cliente.tenant_id", activeTenant.id)
        .eq("entrega_modalidade", "entrega")
        .eq("data_previsao_entrega", criteria.date)
        .not("status", "in", '("cancelada","cancelado")')
        .order("numero", { ascending: true });
      if (allowedOrigins) request = request.in("origem", [...allowedOrigins]);
      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as unknown as DeliveryRow[];
    },
  });

  const rows = (query.data ?? []).filter((row) => {
    if (criteria.filter === "entregue") return isDelivered(row);
    if (criteria.filter === "para_entregar") return !isDelivered(row);
    return true;
  });

  const openOrder = (row: DeliveryRow) => {
    if (location.pathname.startsWith("/admin")) {
      const params = new URLSearchParams({ id: row.id });
      if (row.origem === "industrial") params.set("operacao", "industrial");
      if (row.origem === "residencial" || row.origem === "loja") params.set("operacao", "domestico");
      navigate(`/admin/operacoes/ordens?${params}`);
      return;
    }
    navigate(`${getCanonicalPdvPath(activeArea === "industrial" ? "industrial" : "residencial")}/ordens?id=${encodeURIComponent(row.id)}`);
  };

  const consult = () => setCriteria({ date, filter });

  return (
    <section className="space-y-4" data-testid="delivery-workspace">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Truck className="h-4 w-4" /> Delivery
            </div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-foreground sm:text-2xl">Entregas do dia</h2>
            <p className="mt-1 text-sm text-muted-foreground">Consulte os ROLs Delivery por dia e acompanhe o que já foi entregue.</p>
          </div>
          <Button variant="outline" size="icon" onClick={() => void query.refetch()} disabled={query.isFetching} aria-label="Atualizar entregas">
            <RefreshCw className={query.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[220px_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="delivery-day-filter" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" /> Filtrar dia
            </Label>
            <Input id="delivery-day-filter" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-status-filter" className="text-xs font-semibold text-muted-foreground">O que consultar</Label>
            <select
              id="delivery-status-filter"
              value={filter}
              onChange={(event) => {
                const nextFilter = event.target.value as DeliveryFilter;
                setFilter(nextFilter);
                setCriteria({ date, filter: nextFilter });
              }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="dia">Entrega do dia</option>
              <option value="entregue">Entregue</option>
              <option value="para_entregar">Para entregar</option>
            </select>
          </div>
          <Button className="gap-2" onClick={consult} disabled={!date}>
            <Search className="h-4 w-4" /> Consultar
          </Button>
        </div>
      </div>

      {query.isFetching ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card py-12 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando entregas…
        </div>
      ) : query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm" role="alert">
          <span className="text-destructive">Não foi possível carregar as entregas deste dia.</span>
          <Button size="sm" variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="font-black">{criteria.filter === "dia" ? "Entrega do dia" : criteria.filter === "entregue" ? "Entregues" : "Para entregar"}</h3>
              <p className="text-sm text-muted-foreground">{dateLabel(criteria.date)}</p>
            </div>
            <Badge variant="outline">{rows.length} ROL{rows.length === 1 ? "" : "s"}</Badge>
          </div>
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum ROL Delivery encontrado para este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">ROL</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ação</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3 font-semibold">{row.numero}</td>
                      <td className="px-4 py-3">{row.cliente?.nome_fantasia || row.cliente?.razao_social || "Cliente"}</td>
                      <td className="px-4 py-3">{dateLabel(row.data_previsao_entrega)}</td>
                      <td className="px-4 py-3"><Badge variant="outline" className={isDelivered(row) ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "border-amber-500/30 bg-amber-500/10 text-amber-700"}>{statusLabel(row)}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => openOrder(row)} className="gap-2"><ExternalLink className="h-4 w-4" /> Abrir ROL</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
