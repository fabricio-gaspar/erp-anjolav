import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  ROL_DIRECTORY_PAGE_SIZE,
  sanitizeRolDirectorySearch,
  type RolDirectoryStatus,
} from "@/lib/rolDirectory";

export interface RolDirectoryItem {
  id: string;
  data_lancamento: string;
  data_entrega: string | null;
  observacao: string | null;
  status: string;
  valor_total: number;
  numero_rol: string | null;
  created_at: string;
  cliente: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    classificacao: string;
  };
}

export interface RolDirectorySummary {
  quantidade: number;
  quantidade_pendente: number;
  quantidade_faturada: number;
  quantidade_cancelada: number;
  valor_total: number;
}

export interface RolDirectoryPage {
  items: RolDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: RolDirectorySummary;
}

interface UseRolDirectoryOptions {
  page: number;
  search?: string;
  status?: RolDirectoryStatus;
  clientId?: string | null;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  enabled?: boolean;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readRolDirectoryResult(value: unknown, page: number, pageSize: number): RolDirectoryPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O diretório de ROLs retornou um resultado inválido");
  }
  const result = value as Record<string, unknown>;
  const summary = result.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
    ? result.summary as Record<string, unknown>
    : {};
  return {
    items: Array.isArray(result.items) ? result.items as RolDirectoryItem[] : [],
    total: readNumber(result.total),
    page,
    pageSize,
    summary: {
      quantidade: readNumber(summary.quantidade),
      quantidade_pendente: readNumber(summary.quantidade_pendente),
      quantidade_faturada: readNumber(summary.quantidade_faturada),
      quantidade_cancelada: readNumber(summary.quantidade_cancelada),
      valor_total: readNumber(summary.valor_total),
    },
  };
}

export function useRolDirectory({
  page,
  search = "",
  status = "todos",
  clientId = null,
  startDate,
  endDate,
  pageSize = ROL_DIRECTORY_PAGE_SIZE,
  enabled = true,
}: UseRolDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 100);
  const safeSearch = sanitizeRolDirectorySearch(search);
  const validArea = activeArea === "industrial" || activeArea === "residencial";

  return useQuery({
    queryKey: [
      "rol-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      safePage,
      safePageSize,
      safeSearch,
      status,
      clientId,
      startDate ?? null,
      endDate ?? null,
    ],
    enabled: Boolean(enabled && validArea && session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<RolDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id || !validArea) {
        throw new Error("Uma sessão, uma empresa e uma área operacional são obrigatórias para listar ROLs");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_lancamentos", {
        _area: activeArea,
        _busca: safeSearch || null,
        _cliente_id: clientId || null,
        _data_fim: endDate ?? null,
        _data_inicio: startDate ?? null,
        _pagina: safePage,
        _situacao: status,
        _tamanho_pagina: safePageSize,
      });
      if (error) throw error;
      return readRolDirectoryResult(data, safePage, safePageSize);
    },
    placeholderData: previous => previous,
  });
}
