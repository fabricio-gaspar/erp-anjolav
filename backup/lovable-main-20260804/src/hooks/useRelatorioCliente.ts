import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LancamentoComItens {
  id: string;
  cliente_id: string;
  data_lancamento: string;
  data_entrega: string | null;
  valor_total: number;
  status: string;
  observacao: string | null;
  itens: ItemLancamento[];
}

export interface ItemLancamento {
  id: string;
  lancamento_id: string;
  produto_nome: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  subtotal: number;
}

export function useRelatorioCliente(
  clienteId: string | null,
  periodoInicio: string | null,
  periodoFim: string | null
) {
  return useQuery({
    queryKey: ["relatorio_cliente", clienteId, periodoInicio, periodoFim],
    queryFn: async () => {
      if (!clienteId || !periodoInicio || !periodoFim) return [];

      // Buscar lançamentos do cliente no período
      const { data: lancamentos, error: lancError } = await supabase
        .from("lancamentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .gte("data_lancamento", periodoInicio)
        .lte("data_lancamento", periodoFim)
        .order("data_lancamento", { ascending: true });

      if (lancError) throw lancError;
      if (!lancamentos || lancamentos.length === 0) return [];

      // Para cada lançamento, buscar os itens
      const lancamentosComItens: LancamentoComItens[] = await Promise.all(
        lancamentos.map(async (lanc) => {
          const { data: itens, error: itensError } = await supabase
            .from("itens_lancamento")
            .select("*")
            .eq("lancamento_id", lanc.id);

          if (itensError) throw itensError;

          return {
            ...lanc,
            itens: (itens || []) as ItemLancamento[],
          };
        })
      );

      return lancamentosComItens;
    },
    enabled: !!clienteId && !!periodoInicio && !!periodoFim,
  });
}
