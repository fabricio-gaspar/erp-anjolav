import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { OrdemServico } from "./useOrdensServico";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

export const useFilteredOrdensServico = (enabled = true) => {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: ["ordens_servico", session?.user.id, activeTenant?.id, activeArea],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar pedidos");
      }
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes!ordens_servico_cliente_id_fkey(razao_social, classificacao),
          motorista:motoristas!ordens_servico_motorista_id_fkey(nome),
          veiculo:veiculos!ordens_servico_veiculo_id_fkey(placa, modelo)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: false });

      const allowedOrigins = getAllowedOrderOrigins(activeArea);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);

      const { data, error } = await query;
      if (error) throw error;
      
      return data as OrdemServico[];
    },
  });
};
