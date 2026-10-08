import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { OrdemServico } from "./useOrdensServico";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

export const useFilteredOrdensServico = () => {
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["ordens_servico", activeArea],
    queryFn: async () => {
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social, classificacao),
          motorista:motoristas(nome),
          veiculo:veiculos(placa, modelo)
        `)
        .order("created_at", { ascending: false });

      const allowedOrigins = getAllowedOrderOrigins(activeArea);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);

      const { data, error } = await query;
      if (error) throw error;
      
      return data as OrdemServico[];
    },
  });
};
