import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { OrdemServico } from "./useOrdensServico";

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

      // Filter based on workspace area and client classification
      if (activeArea === "industrial") {
        // Only industrial orders
        query = query.eq("origem", "industrial");
      } else if (activeArea === "residencial") {
        // Only residential orders
        query = query.eq("origem", "residencial");
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data as any[];
    },
  });
};
