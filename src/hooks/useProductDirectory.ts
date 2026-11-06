import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  buildProductDirectorySearchFilter,
  getProductDirectoryRange,
  type ProductDirectoryStatus,
} from "@/lib/productDirectory";
import { getAllowedProductUnits } from "@/lib/workspaceScope";
import type { Produto } from "./useProdutos";

interface UseProductDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  letter: string;
  category: string;
  businessUnit: string;
  status: ProductDirectoryStatus;
}

export interface ProductDirectoryPage {
  produtos: Produto[];
  total: number;
  page: number;
  pageSize: number;
}

export function useProductDirectory({
  page,
  pageSize,
  search,
  letter,
  category,
  businessUnit,
  status,
}: UseProductDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const range = getProductDirectoryRange(page, pageSize);
  const searchFilter = buildProductDirectorySearchFilter(search);
  const allowedBusinessUnits = getAllowedProductUnits(activeArea);
  const incompatibleBusinessUnit = businessUnit !== "all" && Boolean(
    allowedBusinessUnits && !allowedBusinessUnits.includes(businessUnit),
  );

  return useQuery({
    queryKey: [
      "product-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      range.page,
      range.pageSize,
      searchFilter,
      letter,
      category,
      businessUnit,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<ProductDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar produtos");
      }
      if (incompatibleBusinessUnit) {
        return { produtos: [], total: 0, page: range.page, pageSize: range.pageSize };
      }

      let query = supabase
        .from("produtos")
        .select("*", { count: "exact" })
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome")
        .order("id")
        .range(range.from, range.to);

      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      if (businessUnit !== "all") query = query.eq("unidade_negocio", businessUnit);
      if (category !== "all") query = query.eq("categoria", category);
      if (status !== "all") query = query.eq("status", status === "active" ? "ativo" : "inativo");
      if (letter !== "TODOS") query = query.ilike("nome", `${letter}%`);
      if (searchFilter) query = query.or(searchFilter);

      const { data, error, count } = await query;
      if (error) throw error;

      return {
        produtos: (data ?? []) as Produto[],
        total: count ?? data?.length ?? 0,
        page: range.page,
        pageSize: range.pageSize,
      };
    },
  });
}
