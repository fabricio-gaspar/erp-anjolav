import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Lancamento {
  id: string;
  cliente_id: string;
  data_lancamento: string;
  data_entrega: string | null;
  observacao: string | null;
  status: string;
  etapa: string;
  valor_total: number;
  numero_rol: string | null;
  fatura_id: string | null;
  ordem_servico_id?: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
    classificacao: string;
    tabela_preco_tipo?: string;
  };
  itens?: ItemLancamento[];
}

export interface ItemLancamento {
  id: string;
  lancamento_id: string;
  produto_id?: string | null;
  produto_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
  created_at: string;
}

export interface LancamentoInsert {
  cliente_id: string;
  data_lancamento?: string;
  data_entrega?: string | null;
  observacao?: string | null;
  status?: string;
  valor_total: number;
}

export interface ItemLancamentoInsert {
  lancamento_id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
}

export function useLancamentos(status?: string) {
  const { data: lancamentos = [], isLoading, error } = useQuery({
    queryKey: ["lancamentos", status],
    queryFn: async () => {
      let query = supabase
        .from("lancamentos")
        .select(`
          *,
          cliente:clientes(id, razao_social, nome_fantasia, cpf_cnpj, email, telefone, classificacao)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lancamento[];
    },
  });

  return {
    lancamentos,
    isLoading,
    error,
  };
}

export function useLancamentosPendentes() {
  return useLancamentos("pendente");
}

export function useItensLancamento(lancamentoId: string | null) {
  return useQuery({
    queryKey: ["itens_lancamento", lancamentoId],
    queryFn: async () => {
      if (!lancamentoId) return [];
      const { data, error } = await supabase
        .from("itens_lancamento")
        .select("*")
        .eq("lancamento_id", lancamentoId);
      if (error) throw error;
      return data as ItemLancamento[];
    },
    enabled: !!lancamentoId,
  });
}

export function useLancamentosComItens(lancamentoIds: string[]) {
  return useQuery({
    queryKey: ["lancamentos_com_itens", lancamentoIds],
    queryFn: async () => {
      if (lancamentoIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("lancamentos")
        .select(`
          *,
          cliente:clientes(id, razao_social, nome_fantasia, cpf_cnpj, email, telefone, classificacao),
          itens:itens_lancamento(*)
        `)
        .in("id", lancamentoIds);
      
      if (error) throw error;
      return data as (Lancamento & { itens: ItemLancamento[] })[];
    },
    enabled: lancamentoIds.length > 0,
  });
}

export function useLinkLancamentosToFatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lancamentoIds, faturaId }: { lancamentoIds: string[]; faturaId: string }) => {
      const uniqueLancamentoIds = [...new Set(lancamentoIds)];
      const { data, error } = await supabase.rpc("vincular_lancamentos_fatura", {
        _fatura_id: faturaId,
        _lancamento_ids: uniqueLancamentoIds,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
    },
  });
}
