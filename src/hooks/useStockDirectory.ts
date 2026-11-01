import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type { EstoqueProduto } from "@/hooks/useEstoque";
import type { StockDirectoryStatus } from "@/lib/stockDirectory";

interface UseStockDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  category: string;
  status: StockDirectoryStatus;
}

export interface StockDirectoryPage {
  items: EstoqueProduto[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    activeCount: number;
    lowCount: number;
    zeroCount: number;
    totalValue: number;
  };
}

function requiredNonNegativeNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`O diretório de estoque não informou ${field}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`O diretório de estoque retornou ${field} inválido`);
  }
  return parsed;
}

export function useStockDirectory({
  page,
  pageSize,
  search,
  category,
  status,
}: UseStockDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "stock-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      page,
      pageSize,
      search,
      category,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    retry: false,
    queryFn: async (): Promise<StockDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar o estoque");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_insumos", {
        _busca: search || null,
        _categoria: category === "all" ? null : category,
        _situacao: status,
        _pagina: page,
        _tamanho: pageSize,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor retornou um diretório de estoque inválido");
      }
      const payload = data as unknown as Partial<StockDirectoryPage>;
      if (!Array.isArray(payload.items) || !payload.summary || typeof payload.summary !== "object") {
        throw new Error("O servidor retornou um diretório de estoque incompleto");
      }
      if (!payload.items.every((item) => item && typeof item.id === "string" && typeof item.nome === "string")) {
        throw new Error("O servidor retornou itens de estoque inválidos");
      }
      return {
        items: payload.items as EstoqueProduto[],
        total: requiredNonNegativeNumber(payload.total, "o total"),
        page: requiredNonNegativeNumber(payload.page, "a página"),
        pageSize: requiredNonNegativeNumber(payload.pageSize, "o tamanho da página"),
        summary: {
          activeCount: requiredNonNegativeNumber(payload.summary.activeCount, "a quantidade de ativos"),
          lowCount: requiredNonNegativeNumber(payload.summary.lowCount, "a quantidade abaixo do mínimo"),
          zeroCount: requiredNonNegativeNumber(payload.summary.zeroCount, "a quantidade sem saldo"),
          totalValue: requiredNonNegativeNumber(payload.summary.totalValue, "o valor total"),
        },
      };
    },
  });
}
