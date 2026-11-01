import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const callStockRpc = supabase.rpc as unknown as (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

export function useMovimentacoesEstoque() {
  const queryClient = useQueryClient();

  const registrarMovimentacao = useMutation({
    mutationFn: async (dados: {
      estoque_produto_id: string;
      tipo: "entrada" | "saida";
      quantidade: number;
      motivo?: string;
      fornecedor_id?: string;
      custo_unitario?: number;
      estoque_local_id: string;
      idempotency_key: string;
    }) => {
      const { data, error } = await callStockRpc("registrar_movimentacao_estoque_local", {
        _estoque_produto_id: dados.estoque_produto_id,
        _tipo: dados.tipo,
        _quantidade: dados.quantidade,
        _motivo: dados.motivo ?? null,
        _fornecedor_id: dados.fornecedor_id ?? null,
        _custo_unitario: dados.custo_unitario ?? null,
        _estoque_local_id: dados.estoque_local_id,
        _idempotency_key: dados.idempotency_key,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
      queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movement-directory"] });
      toast.success("Movimentação registrada!");
    },
    onError: (err: Error) => toast.error("Erro: " + err.message),
  });

  return { registrarMovimentacao };
}
