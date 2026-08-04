import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MovimentoFluxoCaixa {
  id: string;
  origem: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  data: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  cliente_id: string | null;
  fornecedor_id: string | null;
}

export interface UseFluxoCaixaOptions {
  dataInicio: string;
  dataFim: string;
  centroCustoId?: string | "todos";
}

export function useFluxoCaixa(opts: UseFluxoCaixaOptions) {
  const { dataInicio, dataFim, centroCustoId = "todos" } = opts;

  return useQuery({
    queryKey: ["fluxo_caixa", dataInicio, dataFim, centroCustoId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("v_fluxo_caixa")
        .select("*")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });

      if (centroCustoId && centroCustoId !== "todos") {
        q = q.eq("centro_custo_id", centroCustoId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as MovimentoFluxoCaixa[];
    },
  });
}
