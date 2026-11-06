import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildClientDirectorySearchFilter,
  getClientDirectoryRange,
  type ClientDirectoryStatus,
} from "@/lib/clientDirectory";
import type { Cliente } from "./useClientes";

interface UseClienteDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: ClientDirectoryStatus;
}

export interface ClienteDirectoryPage {
  clientes: Cliente[];
  total: number;
  page: number;
  pageSize: number;
}

export function useClienteDirectory({ page, pageSize, search, status }: UseClienteDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getClientDirectoryRange(page, pageSize);
  const searchFilter = buildClientDirectorySearchFilter(search);

  return useQuery({
    queryKey: [
      "client-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<ClienteDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar clientes");
      }

      let query = supabase
        .from("clientes")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("razao_social")
        .order("id")
        .range(range.from, range.to);

      if (activeArea === "industrial" || activeArea === "residencial") {
        query = query.eq("classificacao", activeArea);
      }
      if (status !== "all") query = query.eq("ativo", status === "active");
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        clientes: (data ?? []) as Cliente[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}
