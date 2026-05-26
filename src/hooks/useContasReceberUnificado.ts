import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrigemReceita = "fatura" | "pdv_loja" | "asaas" | "contrato" | "manual";

export interface ContaReceberUnificada {
  id: string;
  origem: OrigemReceita;
  cliente_id: string | null;
  cliente_nome: string | null;
  descricao: string;
  valor: number;
  valor_recebido: number;
  data_vencimento: string | null;
  data_recebimento: string | null;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  created_at: string;
}

export interface UseContasReceberOptions {
  dataInicio?: string;
  dataFim?: string;
  origem?: OrigemReceita | "todos";
}

export function useContasReceberUnificado(opts: UseContasReceberOptions = {}) {
  const { dataInicio, dataFim, origem = "todos" } = opts;

  return useQuery({
    queryKey: ["contas_receber_unificado", dataInicio, dataFim, origem],
    queryFn: async () => {
      let q = (supabase as any)
        .from("v_contas_receber")
        .select("*")
        .order("data_vencimento", { ascending: false });

      if (dataInicio) q = q.gte("data_vencimento", dataInicio);
      if (dataFim) q = q.lte("data_vencimento", dataFim);
      if (origem && origem !== "todos") q = q.eq("origem", origem);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ContaReceberUnificada[];
    },
  });
}
