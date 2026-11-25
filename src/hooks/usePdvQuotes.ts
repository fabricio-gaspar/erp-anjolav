import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PdvQuoteArea = "residencial" | "industrial";
export type PdvQuoteStatusFilter = "all" | "open" | "expired";

export interface PdvQuote {
  id: string;
  codigo: string;
  cliente_id: string;
  area_operacao: string | null;
  criado_por: string | null;
  created_at: string;
  validade: string | null;
  observacoes: string | null;
  status: string;
  valor_total: number;
  itens_snapshot: Json;
  cliente: {
    razao_social: string;
    nome_fantasia: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
  } | null;
}

interface SavePdvQuoteInput {
  clientId: string;
  items: Json[];
  notes?: string | null;
  total: number;
  validUntil: string;
  area: PdvQuoteArea;
  createdBy: string;
}

interface PdvQuoteSearch {
  area: PdvQuoteArea;
  open: boolean;
  search: string;
  status: PdvQuoteStatusFilter;
  dateFrom: string;
  dateTo: string;
  page: number;
}

const QUOTE_SELECT = "id, codigo, cliente_id, area_operacao, criado_por, created_at, validade, observacoes, status, valor_total, itens_snapshot, cliente:clientes!orcamentos_cliente_id_fkey(razao_social, nome_fantasia, telefone, cpf_cnpj)";

const getLocalDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const escapeSearchTerm = (value: string) => value
  .trim()
  .split("").filter((character) => character.charCodeAt(0) > 31).join("")
  .replace(/[%_*]/g, " ")
  .replace(/\s+/g, " ")
  .slice(0, 120)
  .trim();

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function usePdvQuotes(filters: PdvQuoteSearch) {
  const { activeTenant } = useAuth();
  const normalizedSearch = escapeSearchTerm(filters.search);
  const hasSearch = normalizedSearch.length >= 2;
  const searchIsIncomplete = Boolean(filters.search.trim()) && !hasSearch;

  return useQuery({
    queryKey: ["orcamentos", "pdv-consulta", activeTenant?.id, filters.area, normalizedSearch, filters.status, filters.dateFrom, filters.dateTo, filters.page],
    enabled: filters.open && Boolean(activeTenant?.id) && hasSearch,
    queryFn: async () => {
      if (!activeTenant?.id) return { quotes: [] as PdvQuote[], total: 0 };

      const createQuoteQuery = () => {
        let query = supabase
          .from("orcamentos")
          .select(QUOTE_SELECT, { count: "exact" })
          .or(`area_operacao.eq.${filters.area},area_operacao.is.null`);

        if (filters.status === "open") {
          query = query.eq("status", "aberto").or(`validade.gte.${getLocalDate()},validade.is.null`);
        } else if (filters.status === "expired") {
          query = query.eq("status", "aberto").lt("validade", getLocalDate());
        }

        if (filters.dateFrom) {
          query = query.gte("created_at", new Date(`${filters.dateFrom}T00:00:00`).toISOString());
        }
        if (filters.dateTo) {
          const endExclusive = new Date(`${filters.dateTo}T00:00:00`);
          endExclusive.setDate(endExclusive.getDate() + 1);
          query = query.lt("created_at", endExclusive.toISOString());
        }

        const firstRow = filters.page * 50;
        return query.order("created_at", { ascending: false }).range(firstRow, firstRow + 49);
      };

      if (!hasSearch) {
        const { data, error, count } = await createQuoteQuery();
        if (error) throw error;
        return { quotes: (data ?? []) as unknown as PdvQuote[], total: count ?? data?.length ?? 0 };
      }

      const pattern = `%${normalizedSearch}%`;
      const clientSearches = await Promise.all([
        supabase.from("clientes").select("id").ilike("razao_social", pattern).limit(500),
        supabase.from("clientes").select("id").ilike("nome_fantasia", pattern).limit(500),
        supabase.from("clientes").select("id").ilike("telefone", pattern).limit(500),
        supabase.from("clientes").select("id").ilike("cpf_cnpj", pattern).limit(500),
      ]);
      const clientError = clientSearches.find((result) => result.error)?.error;
      if (clientError) throw clientError;
      const clientIds = [...new Set(clientSearches.flatMap((result) => (result.data ?? []).map((client) => client.id)))];

      const quoteSearches: Array<PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>> = [];
      if (clientIds.length > 0) {
        quoteSearches.push(
          supabase.from("orcamentos").select("id")
            .or(`area_operacao.eq.${filters.area},area_operacao.is.null`)
            .in("cliente_id", clientIds)
            .order("created_at", { ascending: false })
            .limit(500),
        );
      }
      quoteSearches.push(
        supabase.from("orcamentos").select("id")
          .or(`area_operacao.eq.${filters.area},area_operacao.is.null`)
          .ilike("codigo", pattern)
          .limit(100),
      );
      if (isUuid(normalizedSearch)) {
        quoteSearches.push(
          supabase.from("orcamentos").select("id")
            .or(`area_operacao.eq.${filters.area},area_operacao.is.null`)
            .eq("id", normalizedSearch)
            .limit(1),
        );
      }

      const idSearches = await Promise.all(quoteSearches);
      const idError = idSearches.find((result) => result.error)?.error;
      if (idError) throw new Error(idError.message);
      const quoteIds = [...new Set(idSearches.flatMap((result) => (result.data ?? []).map((quote) => quote.id)))];
      if (quoteIds.length === 0) return { quotes: [] as PdvQuote[], total: 0 };

      const { data, error, count } = await createQuoteQuery().in("id", quoteIds);
      if (error) throw error;
      return { quotes: (data ?? []) as unknown as PdvQuote[], total: count ?? data?.length ?? 0 };
    },
    staleTime: 15_000,
  });
}

export function useSavePdvQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, items, notes, total, validUntil, area, createdBy }: SavePdvQuoteInput) => {
      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          cliente_id: clientId,
          itens_snapshot: items,
          observacoes: notes?.trim() || null,
          status: "aberto",
          validade: validUntil,
          valor_total: total,
          area_operacao: area,
          criado_por: createdBy,
        })
        .select("id, codigo, status, valor_total, validade")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
    },
  });
}
