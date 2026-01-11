import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  unidade: string | null;
  unidade_negocio: string | null;
  categoria: string | null;
  status: string;
  codigo: string | null;
  peso_medio_kg: number | null;
  tempo_processo_min: number | null;
  processo_lavagem: string | null;
  temperatura_maxima: number | null;
  requer_secadora: boolean | null;
  cor: string | null;
  composicao: string | null;
  instrucoes_especiais: string | null;
  created_at: string;
  updated_at: string;
}

export type ProdutoInsert = Partial<Omit<Produto, "id" | "created_at" | "updated_at">> & { nome: string };
export type ProdutoUpdate = Partial<ProdutoInsert>;

export function useProdutos() {
  const queryClient = useQueryClient();

  const { data: produtos = [], isLoading, error } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  const createProduto = useMutation({
    mutationFn: async (produto: ProdutoInsert) => {
      const { data, error } = await supabase
        .from("produtos")
        .insert(produto)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar produto: " + error.message);
    },
  });

  const updateProduto = useMutation({
    mutationFn: async ({ id, ...updates }: ProdutoUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("produtos")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar produto: " + error.message);
    },
  });

  const deleteProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast.success("Produto excluído com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir produto: " + error.message);
    },
  });

  return {
    produtos,
    isLoading,
    error,
    createProduto,
    updateProduto,
    deleteProduto,
  };
}

// Preços Especiais
export interface PrecoEspecial {
  id: string;
  cliente_id: string;
  produto_id: string;
  preco_especial: number;
  tipo: "acrescido" | "desconto" | "normal";
  created_at: string;
  updated_at: string;
}

export function usePrecosEspeciais(clienteId: string | null) {
  const queryClient = useQueryClient();

  const { data: precos = [], isLoading } = useQuery({
    queryKey: ["precos_especiais", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { data, error } = await supabase
        .from("precos_especiais")
        .select(`
          *,
          produto:produtos(*)
        `)
        .eq("cliente_id", clienteId);
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  const upsertPrecoEspecial = useMutation({
    mutationFn: async (preco: Omit<PrecoEspecial, "id" | "created_at" | "updated_at">) => {
      const { data: existing } = await supabase
        .from("precos_especiais")
        .select("id")
        .eq("cliente_id", preco.cliente_id)
        .eq("produto_id", preco.produto_id)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("precos_especiais")
          .update(preco)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("precos_especiais")
          .insert(preco)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["precos_especiais"] });
      toast.success("Preço especial salvo!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar preço: " + error.message);
    },
  });

  const deletePrecoEspecial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("precos_especiais")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["precos_especiais"] });
      toast.success("Preço especial removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover preço: " + error.message);
    },
  });

  return { precos, isLoading, upsertPrecoEspecial, deletePrecoEspecial };
}
