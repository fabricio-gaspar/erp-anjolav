import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type { StockMovementDirectoryType } from "@/lib/stockMovementDirectory";

interface UseStockMovementDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  type: StockMovementDirectoryType;
}

export interface StockMovementDirectoryItem {
  id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  motivo: string | null;
  saldo_local_anterior: number | null;
  saldo_local_posterior: number | null;
  natureza: string;
  created_at: string;
  produto_nome: string;
  fornecedor_nome: string | null;
  local_origem_codigo: string | null;
  local_destino_codigo: string | null;
}

export interface StockMovementDirectoryPage {
  items: StockMovementDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    entryCount: number;
    exitCount: number;
  };
}

function requiredNonNegativeNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`O histórico de estoque não informou ${field}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`O histórico de estoque retornou ${field} inválido`);
  }
  return parsed;
}

function requiredPositiveInteger(value: unknown, field: string) {
  const parsed = requiredNonNegativeNumber(value, field);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`O histórico de estoque retornou ${field} inválido`);
  }
  return parsed;
}

export function useStockMovementDirectory({
  page,
  pageSize,
  search,
  type,
}: UseStockMovementDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "stock-movement-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      page,
      pageSize,
      search,
      type,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    retry: false,
    queryFn: async (): Promise<StockMovementDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar o histórico de estoque");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_movimentacoes_estoque", {
        _busca: search || null,
        _tipo: type,
        _pagina: page,
        _tamanho: pageSize,
      });
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("O servidor retornou um histórico de estoque inválido");
      }
      const payload = data as unknown as Partial<StockMovementDirectoryPage>;
      if (!Array.isArray(payload.items) || !payload.summary || typeof payload.summary !== "object") {
        throw new Error("O servidor retornou um histórico de estoque incompleto");
      }
      if (!payload.items.every((item) => (
        item
        && typeof item.id === "string"
        && typeof item.produto_nome === "string"
        && (item.tipo === "entrada" || item.tipo === "saida")
      ))) {
        throw new Error("O servidor retornou movimentações de estoque inválidas");
      }
      return {
        items: payload.items as StockMovementDirectoryItem[],
        total: requiredNonNegativeNumber(payload.total, "o total"),
        page: requiredPositiveInteger(payload.page, "a página"),
        pageSize: requiredPositiveInteger(payload.pageSize, "o tamanho da página"),
        summary: {
          entryCount: requiredNonNegativeNumber(payload.summary.entryCount, "a quantidade de entradas"),
          exitCount: requiredNonNegativeNumber(payload.summary.exitCount, "a quantidade de saídas"),
        },
      };
    },
  });
}
