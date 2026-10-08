import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedProductUnits } from "@/lib/workspaceScope";

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
  const { activeArea } = useWorkspace();
  const allowedBusinessUnits = getAllowedProductUnits(activeArea);

  const { data: produtos = [], isLoading, error } = useQuery({
    queryKey: ["produtos", activeArea],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("*")
        .order("nome");
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { data, error } = await query;
      if (error) throw error;
      return data as Produto[];
    },
  });

  const createProduto = useMutation({
    mutationFn: async (produto: ProdutoInsert) => {
      if (
        allowedBusinessUnits &&
        produto.unidade_negocio &&
        !allowedBusinessUnits.includes(produto.unidade_negocio)
      ) {
        throw new Error("Produto fora do escopo deste painel");
      }
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
      if (
        allowedBusinessUnits &&
        updates.unidade_negocio &&
        !allowedBusinessUnits.includes(updates.unidade_negocio)
      ) {
        throw new Error("Produto fora do escopo deste painel");
      }
      let query = supabase
        .from("produtos")
        .update(updates)
        .eq("id", id);
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { data, error } = await query.select().single();
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
      let query = supabase.from("produtos").delete().eq("id", id);
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { error } = await query;
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

export interface PrecoEspecialComProduto extends PrecoEspecial {
  produto: {
    nome: string;
    unidade: string | null;
  } | null;
}

const EMPTY_PRECOS_ESPECIAIS: PrecoEspecialComProduto[] = [];

export function usePrecosEspeciais(clienteId: string | null) {
  const queryClient = useQueryClient();

  const { data: precos = EMPTY_PRECOS_ESPECIAIS, isLoading } = useQuery({
    queryKey: ["precos_especiais", clienteId],
    queryFn: async () => {
      if (!clienteId) return EMPTY_PRECOS_ESPECIAIS;
      const { data, error } = await supabase
        .from("precos_especiais")
        .select(`
          *,
          produto:produtos(nome, unidade)
        `)
        .eq("cliente_id", clienteId);
      if (error) throw error;
      return (data ?? []) as PrecoEspecialComProduto[];
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

  const copyPrecosEspeciais = useMutation({
    mutationFn: async ({ sourceClientId, targetClientId }: {
      sourceClientId: string;
      targetClientId: string;
    }) => {
      if (!sourceClientId || !targetClientId || sourceClientId === targetClientId) {
        throw new Error("Selecione clientes diferentes para copiar os preços");
      }

      const { data: sourcePrices, error: sourceError } = await supabase
        .from("precos_especiais")
        .select("produto_id, preco_especial, tipo")
        .eq("cliente_id", sourceClientId);
      if (sourceError) throw sourceError;
      if (!sourcePrices?.length) {
        throw new Error("O cliente selecionado não possui preços especiais");
      }

      const rows = sourcePrices.map((price) => ({
        cliente_id: targetClientId,
        produto_id: price.produto_id,
        preco_especial: price.preco_especial,
        tipo:
          price.tipo === "acrescido" || price.tipo === "desconto" || price.tipo === "normal"
            ? price.tipo
            : "normal",
      }));
      const { error: copyError } = await supabase
        .from("precos_especiais")
        .upsert(rows, { onConflict: "cliente_id,produto_id" });
      if (copyError) throw copyError;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["precos_especiais"] });
      toast.success(`${count} preço(s) copiado(s) com sucesso!`);
    },
    onError: (error) => {
      toast.error("Erro ao copiar preços: " + error.message);
    },
  });

  return {
    precos,
    isLoading,
    upsertPrecoEspecial,
    deletePrecoEspecial,
    copyPrecosEspeciais,
  };
}
