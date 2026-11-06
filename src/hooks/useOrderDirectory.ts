import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildOrderDirectoryPattern,
  buildOrderDirectoryClientFilter,
  buildOrderIdentifierPattern,
  getOrderDirectoryRange,
  type OrderDirectoryFilters,
} from "@/lib/orderDirectory";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import type { OrdemServico } from "./useOrdensServico";

interface UseOrderDirectoryOptions {
  page: number;
  pageSize: number;
  filters: OrderDirectoryFilters;
  enabled?: boolean;
}

export interface OrderDirectoryPage {
  orders: OrdemServico[];
  total: number;
  page: number;
  pageSize: number;
}

export function useOrderDirectory({ page, pageSize, filters, enabled = true }: UseOrderDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getOrderDirectoryRange(page, pageSize);
  const orderPattern = buildOrderIdentifierPattern(filters.orderSearch);
  const clientFilter = buildOrderDirectoryClientFilter(filters.clientSearch);
  const responsiblePattern = buildOrderDirectoryPattern(filters.responsibleSearch);
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  return useQuery({
    queryKey: [
      "order-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      orderPattern,
      clientFilter,
      responsiblePattern,
      filters.operational,
      filters.payment,
      filters.quality,
      filters.logistics,
      filters.fiscal,
      filters.deadline,
    ],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<OrderDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar pedidos");
      }

      const responsibleRelation = responsiblePattern
        ? "motorista:motoristas!ordens_servico_motorista_id_fkey!inner(nome)"
        : "motorista:motoristas!ordens_servico_motorista_id_fkey(nome)";
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner(razao_social, nome_fantasia, classificacao),
          ${responsibleRelation},
          veiculo:veiculos!ordens_servico_veiculo_id_fkey(placa, modelo)
        `, { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(range.from, range.to);

      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      if (orderPattern) query = query.ilike("numero", orderPattern);
      if (clientFilter) query = query.or(clientFilter, { referencedTable: "cliente" });
      if (responsiblePattern) query = query.ilike("motorista.nome", responsiblePattern);
      if (filters.operational === "open") query = query.not("status", "in", "(entregue,cancelada)");
      else if (filters.operational !== "all") query = query.eq("status", filters.operational);
      if (filters.payment !== "all") query = query.eq("status_pagamento", filters.payment);
      if (filters.quality !== "all") query = query.eq("status_qualidade", filters.quality);
      if (filters.logistics !== "all") query = query.eq("status_logistica", filters.logistics);
      if (filters.fiscal !== "all") query = query.eq("status_fiscal", filters.fiscal);

      const now = new Date();
      const today = format(now, "yyyy-MM-dd");
      if (filters.deadline === "late") {
        query = query
          .lt("data_previsao_entrega", today)
          .not("status", "in", "(entregue,cancelada)");
      } else if (filters.deadline === "today") {
        query = query.eq("data_previsao_entrega", today);
      } else if (filters.deadline === "next_7_days") {
        query = query
          .gte("data_previsao_entrega", today)
          .lte("data_previsao_entrega", format(addDays(now, 6), "yyyy-MM-dd"));
      } else if (filters.deadline === "without_deadline") {
        query = query.is("data_previsao_entrega", null);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        orders: (data ?? []) as OrdemServico[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}
