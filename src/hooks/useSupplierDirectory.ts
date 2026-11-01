import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSupplierDirectorySearchFilter,
  getSupplierDirectoryRange,
  type SupplierDirectoryRecurrence,
  type SupplierDirectoryStatus,
} from "@/lib/supplierDirectory";
import type { Fornecedor } from "./useFornecedores";

interface UseSupplierDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  letter: string;
  category: string;
  status: SupplierDirectoryStatus;
  recurrence: SupplierDirectoryRecurrence;
}

export interface SupplierDirectoryPage {
  fornecedores: Fornecedor[];
  total: number;
  page: number;
  pageSize: number;
}

export function useSupplierDirectory({
  page,
  pageSize,
  search,
  letter,
  category,
  status,
  recurrence,
}: UseSupplierDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getSupplierDirectoryRange(page, pageSize);
  const searchFilter = buildSupplierDirectorySearchFilter(search);

  return useQuery({
    queryKey: [
      "supplier-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      letter,
      category,
      status,
      recurrence,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<SupplierDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar fornecedores");
      }

      let query = supabase
        .from("fornecedores")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome")
        .order("id")
        .range(range.from, range.to);

      if (category !== "all") query = query.eq("categoria", category);
      if (status !== "all") query = query.eq("ativo", status === "active");
      if (letter !== "TODOS") query = query.ilike("nome", `${letter}%`);
      if (recurrence === "configured") {
        query = query.not("valor_recorrente", "is", null).gt("valor_recorrente", 0);
      } else if (recurrence === "not_configured") {
        query = query.or("valor_recorrente.is.null,valor_recorrente.eq.0");
      }
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        fornecedores: (data ?? []) as Fornecedor[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}
