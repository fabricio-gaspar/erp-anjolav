import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FINANCIAL_ACCOUNT_PAGE_SIZE,
  sanitizeFinancialAccountSearch,
  type ReceivableOriginFilter,
  type ReceivableStatusFilter,
} from "@/lib/financialAccountDirectory";

export type OrigemReceita = Exclude<ReceivableOriginFilter, "todos">;

export interface ContaReceberUnificada {
  id: string;
  origem: OrigemReceita;
  cliente_id: string | null;
  cliente_nome: string | null;
  descricao: string;
  valor: number;
  valor_recebido: number;
  data_vencimento: string | null;
  data_recebimento: string | null;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  created_at: string;
}

export interface UseContasReceberOptions {
  page: number;
  pageSize?: number;
  search: string;
  dataInicio?: string;
  dataFim?: string;
  origem: ReceivableOriginFilter;
  status: ReceivableStatusFilter;
  enabled?: boolean;
}

export interface ContasReceberDirectorySummary {
  quantidade: number;
  quantidade_aberta: number;
  quantidade_recebida: number;
  valor_aberto: number;
  valor_recebido: number;
}

export interface ContasReceberDirectoryPage {
  items: ContaReceberUnificada[];
  total: number;
  page: number;
  pageSize: number;
  summary: ContasReceberDirectorySummary;
}

const EMPTY_SUMMARY: ContasReceberDirectorySummary = {
  quantidade: 0,
  quantidade_aberta: 0,
  quantidade_recebida: 0,
  valor_aberto: 0,
  valor_recebido: 0,
};

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readReceivableDirectoryResult(
  value: unknown,
  page: number,
  pageSize: number,
): ContasReceberDirectoryPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O diretório de contas a receber retornou um resultado inválido");
  }
  const result = value as Record<string, unknown>;
  const summary = result.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
    ? result.summary as Record<string, unknown>
    : EMPTY_SUMMARY;
  return {
    items: Array.isArray(result.items) ? result.items as ContaReceberUnificada[] : [],
    total: readNumber(result.total),
    page,
    pageSize,
    summary: {
      quantidade: readNumber(summary.quantidade),
      quantidade_aberta: readNumber(summary.quantidade_aberta),
      quantidade_recebida: readNumber(summary.quantidade_recebida),
      valor_aberto: readNumber(summary.valor_aberto),
      valor_recebido: readNumber(summary.valor_recebido),
    },
  };
}

export function useContasReceberUnificado({
  page,
  pageSize = FINANCIAL_ACCOUNT_PAGE_SIZE,
  search,
  dataInicio,
  dataFim,
  origem,
  status,
  enabled = true,
}: UseContasReceberOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 100);
  const safeSearch = sanitizeFinancialAccountSearch(search);

  return useQuery({
    queryKey: [
      "accounts-receivable-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      safePage,
      safePageSize,
      safeSearch,
      origem,
      status,
      dataInicio ?? null,
      dataFim ?? null,
    ],
    enabled: Boolean(enabled && session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<ContasReceberDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar contas a receber");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_contas_receber", {
        _busca: safeSearch || null,
        _data_fim: dataFim ?? null,
        _data_inicio: dataInicio ?? null,
        _origem: origem,
        _pagina: safePage,
        _situacao: status,
        _tamanho_pagina: safePageSize,
      });
      if (error) throw error;
      return readReceivableDirectoryResult(data, safePage, safePageSize);
    },
    placeholderData: previous => previous,
  });
}
