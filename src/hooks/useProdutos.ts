import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { getAllowedProductUnits } from "@/lib/workspaceScope";

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  unidade: string | null;
  unidade_negocio: string | null;
  categoria: string | null;
  porte: "pequeno" | "medio" | "grande" | null;
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

interface UseProdutosOptions {
  enabled?: boolean;
}

export function useProdutos(options: UseProdutosOptions = {}) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedBusinessUnits = getAllowedProductUnits(activeArea);

  const invalidateProductQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["produtos"] }),
    queryClient.invalidateQueries({ queryKey: ["product-directory"] }),
  ]);

  const { data: produtos = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["produtos", session?.user.id, activeTenant?.id, activeArea],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar produtos");
      }
      let query = supabase
        .from("produtos")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome");
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { data, error } = await query;
      if (error) throw error;
      return data as Produto[];
    },
  });

  const createProduto = useMutation({
    mutationFn: async (produto: ProdutoInsert) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar produtos");
      }
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
      void invalidateProductQueries();
      toast.success("Produto criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar produto: " + error.message);
    },
  });

  const updateProduto = useMutation({
    mutationFn: async ({ id, ...updates }: ProdutoUpdate & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar produtos");
      }
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
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateProductQueries();
      toast.success("Produto atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar produto: " + error.message);
    },
  });

  const setProdutoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "ativo" | "inativo" }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para alterar produtos");
      }
      let query = supabase
        .from("produtos")
        .update({ status })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (allowedBusinessUnits) query = query.in("unidade_negocio", [...allowedBusinessUnits]);
      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      void invalidateProductQueries();
      toast.success(variables.status === "inativo"
        ? "Produto arquivado. O histórico foi preservado."
        : "Produto reativado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao alterar a situação do produto: " + error.message);
    },
  });

  return {
    produtos,
    isLoading,
    isError,
    error,
    refetch,
    createProduto,
    updateProduto,
    setProdutoStatus,
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
    preco: number;
  } | null;
}

const EMPTY_PRECOS_ESPECIAIS: PrecoEspecialComProduto[] = [];

export function usePrecosEspeciais(clienteId: string | null) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();

  const {
    data: precos = EMPTY_PRECOS_ESPECIAIS,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["precos_especiais", session?.user.id, activeTenant?.id, clienteId],
    queryFn: async () => {
      if (!clienteId || !session?.user.id || !activeTenant?.id) return EMPTY_PRECOS_ESPECIAIS;
      const { data, error } = await supabase
        .from("precos_especiais")
        .select(`
          *,
          produto:produtos!fk_precos_especiais_produto(nome, unidade, preco)
        `)
        .eq("cliente_id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id);
      if (error) throw error;
      return (data ?? []) as PrecoEspecialComProduto[];
    },
    enabled: Boolean(clienteId && session?.user.id && activeTenant?.id),
  });

  const upsertPrecoEspecial = useMutation({
    mutationFn: async (preco: Omit<PrecoEspecial, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("precos_especiais")
        .upsert(preco, { onConflict: "cliente_id,produto_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["precos_especiais"] });
      toast.success("Preço especial salvo!");
    },
    onError: (error) => {
      const message = error.message.toLowerCase();
      if (message.includes("row-level security") || message.includes("permission")) {
        toast.error("Você não tem autorização para alterar os preços deste cliente.");
        return;
      }
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
    isError,
    error,
    refetch,
    upsertPrecoEspecial,
    deletePrecoEspecial,
    copyPrecosEspeciais,
  };
}
