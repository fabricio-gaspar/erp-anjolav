import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import type { ContaPagar } from "@/hooks/useContasPagar";
import {
  FINANCIAL_ACCOUNT_PAGE_SIZE,
  sanitizeFinancialAccountSearch,
  type PayableStatusFilter,
} from "@/lib/financialAccountDirectory";

export interface ContaPagarDirectoryItem extends ContaPagar {
  status_exibicao: Exclude<PayableStatusFilter, "todos">;
}

export interface ContaPagarDirectorySummary {
  quantidade: number;
  quantidade_aberta: number;
  quantidade_vencida: number;
  valor_aberto: number;
  valor_pago: number;
  valor_vencido: number;
}

export interface ContaPagarDirectoryPage {
  items: ContaPagarDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: ContaPagarDirectorySummary;
}

interface UseContasPagarDirectoryOptions {
  page: number;
  search: string;
  status: PayableStatusFilter;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  enabled?: boolean;
}

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readPayableDirectoryResult(
  value: unknown,
  page: number,
  pageSize: number,
): ContaPagarDirectoryPage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("O diretório de contas a pagar retornou um resultado inválido");
  }
  const result = value as Record<string, unknown>;
  const summary = result.summary && typeof result.summary === "object" && !Array.isArray(result.summary)
    ? result.summary as Record<string, unknown>
    : {};
  return {
    items: Array.isArray(result.items) ? result.items as ContaPagarDirectoryItem[] : [],
    total: readNumber(result.total),
    page,
    pageSize,
    summary: {
      quantidade: readNumber(summary.quantidade),
      quantidade_aberta: readNumber(summary.quantidade_aberta),
      quantidade_vencida: readNumber(summary.quantidade_vencida),
      valor_aberto: readNumber(summary.valor_aberto),
      valor_pago: readNumber(summary.valor_pago),
      valor_vencido: readNumber(summary.valor_vencido),
    },
  };
}

export function useContasPagarDirectory({
  page,
  search,
  status,
  startDate,
  endDate,
  pageSize = FINANCIAL_ACCOUNT_PAGE_SIZE,
  enabled = true,
}: UseContasPagarDirectoryOptions) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const safePageSize = Math.min(Math.max(Math.trunc(pageSize), 1), 100);
  const safeSearch = sanitizeFinancialAccountSearch(search);

  return useQuery({
    queryKey: [
      "accounts-payable-directory",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      safePage,
      safePageSize,
      safeSearch,
      status,
      startDate ?? null,
      endDate ?? null,
    ],
    enabled: Boolean(enabled && session?.user.id && activeTenant?.id),
    queryFn: async (): Promise<ContaPagarDirectoryPage> => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar contas a pagar");
      }
      const { data, error } = await supabase.rpc("consultar_diretorio_contas_pagar", {
        _busca: safeSearch || null,
        _data_fim: endDate ?? null,
        _data_inicio: startDate ?? null,
        _pagina: safePage,
        _situacao: status,
        _tamanho_pagina: safePageSize,
      });
      if (error) throw error;
      return readPayableDirectoryResult(data, safePage, safePageSize);
    },
    placeholderData: previous => previous,
  });
}
