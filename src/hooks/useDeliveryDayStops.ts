import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { AddressSnapshot } from "@/hooks/useRotasEntrega";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import { clientClassificationMatchesArea } from "@/lib/operations";

export interface DeliveryDayStop {
  key: string;
  type: "retirada" | "entrega";
  source: "agendamento" | "rol";
  customerId: string;
  customerName: string;
  address: AddressSnapshot | null;
  appointmentId: string | null;
  orderId: string | null;
  rolNumber: string | null;
  scheduledTime: string | null;
  overdue: boolean;
}

interface ClientSummary {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  classificacao: string;
  tenant_id: string;
}

interface AppointmentRow {
  id: string;
  cliente_id: string;
  tipo: "retirada" | "entrega";
  data: string;
  horario: string | null;
  status: string | null;
  operation_type: string | null;
  cliente: ClientSummary | null;
}

interface OrderRow {
  id: string;
  numero: string;
  cliente_id: string;
  agendamento_id: string | null;
  data_previsao_entrega: string | null;
  status_logistica: string;
  endereco_atendimento_snapshot: Json;
  operation_type: string | null;
  cliente: ClientSummary | null;
}

interface AddressRow extends AddressSnapshot {
  cliente_id: string;
  principal: boolean;
  updated_at: string;
}

function isAddressSnapshot(value: Json | null | undefined): AddressSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AddressSnapshot;
}

function customerName(client: ClientSummary | null) {
  return client?.nome_fantasia?.trim() || client?.razao_social?.trim() || "Cliente sem identificação";
}

function belongsToOperation(
  operationType: string | null,
  client: ClientSummary | null,
  activeArea: string,
) {
  if (activeArea === "central") return true;
  const expectedOperation = activeArea === "industrial" ? "industrial" : "domestico";
  const expectedClassification = activeArea === "industrial" ? "industrial" : "residencial";
  return operationType ? operationType === expectedOperation : clientClassificationMatchesArea(client?.classificacao, expectedClassification);
}

function addressHasCoordinates(address: AddressSnapshot | null | undefined) {
  return address?.latitude != null
    && address?.longitude != null
    && Number.isFinite(Number(address.latitude))
    && Number.isFinite(Number(address.longitude));
}

export function useDeliveryDayStops(date: string) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["delivery-day-stops", session?.user.id, activeTenant?.id, activeArea, date],
    queryFn: async (): Promise<DeliveryDayStop[]> => {
      if (!session?.user.id || !activeTenant?.id || !date) return [];

      let appointmentsQuery = supabase
        .from("agendamentos")
        .select("id, cliente_id, tipo, data, horario, status, operation_type, cliente:clientes!fk_agendamentos_cliente!inner(id, razao_social, nome_fantasia, classificacao, tenant_id)")
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("data", date)
        .neq("status", "cancelado")
        .neq("status", "realizado");

      if (activeArea !== "central") {
        appointmentsQuery = appointmentsQuery.or(`operation_type.eq.${activeArea === "industrial" ? "industrial" : "domestico"},operation_type.is.null`);
      }

      let ordersQuery = supabase
        .from("ordens_servico")
        .select("id, numero, cliente_id, agendamento_id, data_previsao_entrega, status_logistica, endereco_atendimento_snapshot, operation_type, cliente:clientes!ordens_servico_cliente_id_fkey!inner(id, razao_social, nome_fantasia, classificacao, tenant_id)")
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("entrega_modalidade", "entrega")
        .lte("data_previsao_entrega", date)
        .in("status_logistica", ["aguardando_entrega", "entrega_parcial", "tentativa_falha"])
        .neq("status", "cancelada")
        .neq("status", "entregue");

      const allowedOrigins = getAllowedOrderOrigins(activeArea);
      if (allowedOrigins) ordersQuery = ordersQuery.in("origem", [...allowedOrigins]);

      const [appointmentsResult, ordersResult] = await Promise.all([appointmentsQuery, ordersQuery]);
      if (appointmentsResult.error) throw appointmentsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const appointments = (appointmentsResult.data || []) as unknown as AppointmentRow[];
      const orders = (ordersResult.data || []) as unknown as OrderRow[];
      const scopedAppointments = appointments.filter((item) =>
        belongsToOperation(item.operation_type, item.cliente, activeArea)
        && (item.tipo === "retirada" || item.tipo === "entrega"),
      );
      const scopedOrders = orders.filter((item) => belongsToOperation(item.operation_type, item.cliente, activeArea));
      const customerIds = [...new Set([...scopedAppointments, ...scopedOrders].map((item) => item.cliente_id))];

      const addressesResult = customerIds.length
        ? await supabase
          .from("enderecos_clientes")
          .select("cliente_id, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude, principal, updated_at")
          .in("cliente_id", customerIds)
          .eq("ativo", true)
          .order("principal", { ascending: false })
          .order("updated_at", { ascending: false })
        : { data: [], error: null };
      if (addressesResult.error) throw addressesResult.error;

      const primaryAddressByCustomer = new Map<string, AddressRow>();
      for (const address of (addressesResult.data || []) as unknown as AddressRow[]) {
        if (!primaryAddressByCustomer.has(address.cliente_id)) primaryAddressByCustomer.set(address.cliente_id, address);
      }

      const orderAppointmentIds = new Set(scopedOrders.map((order) => order.agendamento_id).filter((id): id is string => Boolean(id)));
      const appointmentStops: DeliveryDayStop[] = scopedAppointments
        .filter((appointment) => !orderAppointmentIds.has(appointment.id))
        .map((appointment) => ({
          key: `appointment:${appointment.id}`,
          type: appointment.tipo,
          source: "agendamento",
          customerId: appointment.cliente_id,
          customerName: customerName(appointment.cliente),
          address: primaryAddressByCustomer.get(appointment.cliente_id) ?? null,
          appointmentId: appointment.id,
          orderId: null,
          rolNumber: null,
          scheduledTime: appointment.horario,
          overdue: false,
        }));

      const orderStops: DeliveryDayStop[] = scopedOrders.map((order) => {
        const snapshot = isAddressSnapshot(order.endereco_atendimento_snapshot);
        const fallback = primaryAddressByCustomer.get(order.cliente_id) ?? null;
        const address = snapshot && addressHasCoordinates(snapshot)
          ? snapshot
          : fallback || snapshot;
        return {
          key: `rol:${order.id}`,
          type: "entrega",
          source: "rol",
          customerId: order.cliente_id,
          customerName: customerName(order.cliente),
          address,
          appointmentId: order.agendamento_id,
          orderId: order.id,
          rolNumber: order.numero,
          scheduledTime: null,
          overdue: Boolean(order.data_previsao_entrega && order.data_previsao_entrega < date),
        };
      });

      return [...appointmentStops, ...orderStops];
    },
    enabled: Boolean(session?.user.id && activeTenant?.id && date),
    staleTime: 30_000,
  });
}
