import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type {
  StockLocationBalanceStatus,
  StockLocationDirectoryStatus,
} from "@/lib/stockLocationDirectory";

interface UseStockLocationDirectoryOptions {
  page: number;
  pageSize: number;
  search: string;
  status: StockLocationDirectoryStatus;
}

interface UseStockLocationBalanceDirectoryOptions {
  locationId: string | null;
  page: number;
  pageSize: number;
  search: string;
  status: StockLocationBalanceStatus;
}

export interface StockLocationDirectoryItem {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao: number;
  created_at: string;
  updated_at: string;
  produtos_com_saldo: number;
  quantidade_total: number;
  saldo_atualizado_em: string | null;
}

export interface StockLocationDirectoryPage {
  items: StockLocationDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    activeCount: number;
    archivedCount: number;
    withBalanceCount: number;
    totalQuantity: number;
  };
}

export interface StockLocationBalanceItem {
  estoque_local_id: string;
  estoque_produto_id: string;
  produto_nome: string;
  produto_categoria: string | null;
  produto_unidade: string | null;
  produto_ativo: boolean;
  estoque_total: number;
  quantidade_minima: number;
  quantidade_local: number;
  versao_saldo: number;
  saldo_atualizado_em: string | null;
}

export interface StockLocationBalancePage {
  location: {
    id: string;
    codigo: string;
    nome: string;
    ativo: boolean;
  };
  items: StockLocationBalanceItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    activeProductCount: number;
    withBalanceCount: number;
    totalQuantity: number;
  };
}

function requiredNonNegativeNumber(value: unknown, field: string) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`O diretório de locais não informou ${field}`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`O diretório de locais retornou ${field} inválido`);
  }
  return parsed;
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`O diretório de locais retornou ${field} inválido`);
  }
  return value;
}

function requirePayload(data: unknown, description: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`O servidor retornou ${description} inválido`);
  }
  return data as Record<string, unknown>;
}

export function useStockLocationDirectory({
  page,
  pageSize,
  search,
  status,
}: UseStockLocationDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "stock-location-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      page,
      pageSize,
      search,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    retry: false,
    queryFn: async (): Promise<StockLocationDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar locais de estoque");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_locais_estoque", {
        _busca: search || null,
        _situacao: status,
        _pagina: page,
        _tamanho: pageSize,
      });
      if (error) throw error;
      const payload = requirePayload(data, "um diretório de locais");
      if (!Array.isArray(payload.items) || !payload.summary || typeof payload.summary !== "object") {
        throw new Error("O servidor retornou um diretório de locais incompleto");
      }
      if (!payload.items.every((item) => item && typeof item === "object" && typeof (item as StockLocationDirectoryItem).id === "string" && typeof (item as StockLocationDirectoryItem).nome === "string")) {
        throw new Error("O servidor retornou locais de estoque inválidos");
      }
      const summary = payload.summary as Record<string, unknown>;
      return {
        items: payload.items as StockLocationDirectoryItem[],
        total: requiredNonNegativeNumber(payload.total, "o total"),
        page: requiredNonNegativeNumber(payload.page, "a página"),
        pageSize: requiredNonNegativeNumber(payload.pageSize, "o tamanho da página"),
        summary: {
          activeCount: requiredNonNegativeNumber(summary.activeCount, "a quantidade de locais ativos"),
          archivedCount: requiredNonNegativeNumber(summary.archivedCount, "a quantidade de locais arquivados"),
          withBalanceCount: requiredNonNegativeNumber(summary.withBalanceCount, "a quantidade de locais com saldo"),
          totalQuantity: requiredNonNegativeNumber(summary.totalQuantity, "a quantidade total"),
        },
      };
    },
  });
}

export function useStockLocationBalanceDirectory({
  locationId,
  page,
  pageSize,
  search,
  status,
}: UseStockLocationBalanceDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: [
      "stock-location-balance-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      locationId,
      page,
      pageSize,
      search,
      status,
    ],
    enabled: Boolean(session?.user.id && activeTenant?.id && locationId),
    retry: false,
    queryFn: async (): Promise<StockLocationBalancePage> => {
      if (!session?.user.id || !activeTenant?.id || !locationId) {
        throw new Error("Uma sessão autenticada, empresa ativa e local são obrigatórios para listar saldos");
      }
      const { data, error } = await supabase.rpc("consultar_saldos_local_estoque", {
        _estoque_local_id: locationId,
        _busca: search || null,
        _situacao: status,
        _pagina: page,
        _tamanho: pageSize,
      });
      if (error) throw error;
      const payload = requirePayload(data, "os saldos do local");
      if (!Array.isArray(payload.items) || !payload.summary || typeof payload.summary !== "object" || !payload.location || typeof payload.location !== "object") {
        throw new Error("O servidor retornou saldos por local incompletos");
      }
      if (!payload.items.every((item) => item && typeof item === "object" && typeof (item as StockLocationBalanceItem).estoque_produto_id === "string" && typeof (item as StockLocationBalanceItem).produto_nome === "string")) {
        throw new Error("O servidor retornou saldos de estoque inválidos");
      }
      const summary = payload.summary as Record<string, unknown>;
      const location = payload.location as Record<string, unknown>;
      return {
        location: {
          id: requiredText(location.id, "o identificador do local"),
          codigo: requiredText(location.codigo, "o código do local"),
          nome: requiredText(location.nome, "o nome do local"),
          ativo: Boolean(location.ativo),
        },
        items: payload.items as StockLocationBalanceItem[],
        total: requiredNonNegativeNumber(payload.total, "o total de saldos"),
        page: requiredNonNegativeNumber(payload.page, "a página de saldos"),
        pageSize: requiredNonNegativeNumber(payload.pageSize, "o tamanho da página de saldos"),
        summary: {
          activeProductCount: requiredNonNegativeNumber(summary.activeProductCount, "a quantidade de insumos ativos"),
          withBalanceCount: requiredNonNegativeNumber(summary.withBalanceCount, "a quantidade de insumos com saldo"),
          totalQuantity: requiredNonNegativeNumber(summary.totalQuantity, "a quantidade do local"),
        },
      };
    },
  });
}
