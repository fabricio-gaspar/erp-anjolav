import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
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
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  return useQuery({
    queryKey: [
      "order-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      filters.rolStatus,
      filters.payment,
      filters.dataInicio,
      filters.dataFim,
    ],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<OrderDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar pedidos");
      }

      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner(razao_social, nome_fantasia, classificacao)
        `, { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("data_retirada", { ascending: false })
        .order("id", { ascending: false })
        .range(range.from, range.to);

      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      if (filters.rolStatus === "entregue") query = query.eq("status", "entregue");
      if (filters.rolStatus === "retirado") query = query.eq("status", "retirada");
      if (filters.rolStatus === "a_retirar") query = query.eq("status", "expedicao");
      if (filters.rolStatus === "nao_entregue") {
        query = query.not("status", "in", "(retirada,expedicao,entregue,cancelada)");
      }
      if (filters.payment === "pago") query = query.eq("status_pagamento", "pago");
      if (filters.payment === "nao_pago") {
        query = query.or("status_pagamento.in.(pendente,parcial),status_pagamento.is.null");
      }
      if (filters.dataInicio) query = query.gte("data_retirada", filters.dataInicio);
      if (filters.dataFim) query = query.lte("data_retirada", filters.dataFim);

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
