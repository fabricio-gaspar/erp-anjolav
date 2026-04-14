import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  };
  itens?: ItemLancamento[];
}

export interface ItemLancamento {
  id: string;
  lancamento_id: string;
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
  const queryClient = useQueryClient();

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

  const createLancamento = useMutation({
    mutationFn: async (lancamento: LancamentoInsert) => {
      const { data, error } = await supabase
        .from("lancamentos")
        .insert(lancamento)
        .select()
        .single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (error) => {
      toast.error("Erro ao criar lançamento: " + error.message);
    },
  });

  const updateLancamento = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<LancamentoInsert>) => {
      const { data, error } = await supabase
        .from("lancamentos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success("Lançamento atualizado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar lançamento: " + error.message);
    },
  });

  const deleteLancamento = useMutation({
    mutationFn: async (id: string) => {
      // First delete items
      const { error: itemsError } = await supabase
        .from("itens_lancamento")
        .delete()
        .eq("lancamento_id", id);
      if (itemsError) throw itemsError;

      // Then delete lancamento
      const { error } = await supabase
        .from("lancamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      toast.success("Lançamento excluído com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir lançamento: " + error.message);
    },
  });

  return {
    lancamentos,
    isLoading,
    error,
    createLancamento,
    updateLancamento,
    deleteLancamento,
  };
}

export function useUpdateItemLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: ItemLancamento) => {
      const { data, error } = await supabase
        .from("itens_lancamento")
        .update({
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
        })
        .eq("id", item.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lancamento"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    },
  });
}

export function useDeleteItemLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("itens_lancamento")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lancamento"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    },
  });
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

export function useCreateItemLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: ItemLancamentoInsert) => {
      const { data, error } = await supabase
        .from("itens_lancamento")
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as ItemLancamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens_lancamento"] });
    },
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
      // Insert links
      const links = lancamentoIds.map((lancamento_id) => ({
        lancamento_id,
        fatura_id: faturaId,
      }));

      const { error: linkError } = await supabase
        .from("lancamentos_fatura")
        .insert(links);
      if (linkError) throw linkError;

      // Update lancamentos status to "faturado"
      const { error: updateError } = await supabase
        .from("lancamentos")
        .update({ status: "faturado" })
        .in("id", lancamentoIds);
      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
    },
  });
}
