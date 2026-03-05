import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useEstoque() {
  const queryClient = useQueryClient();

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["estoque_produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_produtos")
        .select("*, fornecedores(id, nome)")
        .order("nome");
      if (error) throw error;
      return data as EstoqueProduto[];
    },
  });

  const criarProduto = useMutation({
    mutationFn: async (dados: Partial<EstoqueProduto>) => {
      const { fornecedores, ...rest } = dados as any;
      const { data, error } = await supabase.from("estoque_produtos").insert(rest).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
      toast.success("Produto cadastrado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const atualizarProduto = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<EstoqueProduto> & { id: string }) => {
      const { fornecedores, ...rest } = dados as any;
      const { data, error } = await supabase.from("estoque_produtos").update(rest).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
      toast.success("Produto atualizado!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const excluirProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque_produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
      toast.success("Produto excluído!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const totalItens = produtos.filter((p) => p.ativo).length;
  const itensBaixos = produtos.filter((p) => p.ativo && p.quantidade_atual <= p.quantidade_minima && p.quantidade_minima > 0);
  const valorTotal = produtos.reduce((acc, p) => acc + p.quantidade_atual * p.preco_custo, 0);

  return { produtos, isLoading, criarProduto, atualizarProduto, excluirProduto, totalItens, itensBaixos, valorTotal };
}
