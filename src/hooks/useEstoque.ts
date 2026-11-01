import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface EstoqueProduto {
  id: string;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  quantidade_atual: number;
  quantidade_minima: number;
  preco_custo: number;
  fornecedor_id: string | null;
  localizacao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  fornecedores?: { id: string; nome: string } | null;
}

interface UseEstoqueOptions {
  enabled?: boolean;
}

export function useEstoque(options: UseEstoqueOptions = {}) {
  const queryClient = useQueryClient();
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();

  const invalidateStockQueries = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-directory"] }),
    queryClient.invalidateQueries({ queryKey: ["estoque_saldos"] }),
  ]);

  const { data: produtos = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["estoque_produtos", session?.user.id, activeTenant?.id, activeArea],
    enabled: options.enabled !== false && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar insumos");
      }
      const { data, error } = await supabase
        .from("estoque_produtos")
        .select("*, fornecedores(id, nome)")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("nome");
      if (error) throw error;
      return data as EstoqueProduto[];
    },
  });

  const criarProduto = useMutation({
    mutationFn: async (dados: Partial<EstoqueProduto>) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar insumos");
      }
      if (!dados.nome?.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        tenant_id: activeTenant.id,
        nome: dados.nome.trim(),
        categoria: dados.categoria ?? "outros",
        unidade: dados.unidade ?? "unidade",
        quantidade_minima: dados.quantidade_minima ?? 0,
        fornecedor_id: dados.fornecedor_id || null,
        localizacao: dados.localizacao?.trim() || null,
        ativo: dados.ativo ?? true,
      };
      const { data, error } = await supabase.from("estoque_produtos").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateStockQueries();
      toast.success("Produto cadastrado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const atualizarProduto = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<EstoqueProduto> & { id: string }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para atualizar insumos");
      }
      const payload = {
        ...(dados.nome !== undefined && { nome: dados.nome.trim() }),
        ...(dados.categoria !== undefined && { categoria: dados.categoria }),
        ...(dados.unidade !== undefined && { unidade: dados.unidade }),
        ...(dados.quantidade_minima !== undefined && { quantidade_minima: dados.quantidade_minima }),
        ...(dados.fornecedor_id !== undefined && { fornecedor_id: dados.fornecedor_id || null }),
        ...(dados.localizacao !== undefined && { localizacao: dados.localizacao?.trim() || null }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
      };
      const { data, error } = await supabase
        .from("estoque_produtos")
        .update(payload)
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void invalidateStockQueries();
      toast.success("Produto atualizado!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const arquivarProduto = useMutation({
    mutationFn: async (id: string) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para arquivar insumos");
      }
      const { error } = await supabase
        .from("estoque_produtos")
        .update({ ativo: false })
        .eq("id", id)
        .filter("tenant_id", "eq", activeTenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidateStockQueries();
      toast.success("Insumo arquivado. O histórico foi preservado.");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  const totalItens = produtos.filter((p) => p.ativo).length;
  const itensBaixos = produtos.filter((p) => p.ativo && p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0);
  const valorTotal = produtos.filter((p) => p.ativo).reduce((acc, p) => acc + p.quantidade_atual * p.preco_custo, 0);

  return {
    produtos,
    isLoading,
    isError,
    error,
    refetch,
    criarProduto,
    atualizarProduto,
    arquivarProduto,
    totalItens,
    itensBaixos,
    valorTotal,
  };
}
