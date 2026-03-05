import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MovimentacaoEstoque {
  id: string;
  estoque_produto_id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  fornecedor_id: string | null;
  custo_unitario: number;
  funcionario_id: string | null;
  created_at: string;
  estoque_produtos?: { nome: string } | null;
  fornecedores?: { nome: string } | null;
}

export function useMovimentacoesEstoque(produtoId?: string) {
  const queryClient = useQueryClient();

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ["movimentacoes_estoque", produtoId],
    queryFn: async () => {
      let query = supabase
        .from("movimentacoes_estoque")
        .select("*, estoque_produtos(nome), fornecedores(nome)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (produtoId) query = query.eq("estoque_produto_id", produtoId);
      const { data, error } = await query;
      if (error) throw error;
      return data as MovimentacaoEstoque[];
    },
  });

  const registrarMovimentacao = useMutation({
    mutationFn: async (dados: {
      estoque_produto_id: string;
      tipo: string;
      quantidade: number;
      motivo?: string;
      fornecedor_id?: string;
      custo_unitario?: number;
    }) => {
      // Insert movimentação
      const { error: movError } = await supabase.from("movimentacoes_estoque").insert(dados as any);
      if (movError) throw movError;

      // Update quantidade_atual
      const { data: produto, error: getError } = await supabase
        .from("estoque_produtos")
        .select("quantidade_atual, preco_custo")
        .eq("id", dados.estoque_produto_id)
        .single();
      if (getError) throw getError;

      const delta = dados.tipo === "entrada" ? dados.quantidade : -dados.quantidade;
      const novaQtd = Math.max(0, (produto.quantidade_atual || 0) + delta);

      const updateData: any = { quantidade_atual: novaQtd };
      if (dados.tipo === "entrada" && dados.custo_unitario) {
        updateData.preco_custo = dados.custo_unitario;
      }

      const { error: updError } = await supabase
        .from("estoque_produtos")
        .update(updateData)
        .eq("id", dados.estoque_produto_id);
      if (updError) throw updError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      toast.success("Movimentação registrada!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return { movimentacoes, isLoading, registrarMovimentacao };
}
