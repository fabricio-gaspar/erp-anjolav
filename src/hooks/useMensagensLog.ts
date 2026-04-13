import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMensagensLog(filtros?: { cliente_id?: string; ordem_servico_id?: string }) {
  return useQuery({
    queryKey: ["mensagens_log", filtros],
    queryFn: async () => {
      let query = supabase
        .from("mensagens_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (filtros?.cliente_id) {
        query = query.eq("cliente_id", filtros.cliente_id);
      }
      if (filtros?.ordem_servico_id) {
        query = query.eq("ordem_servico_id", filtros.ordem_servico_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
