import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Cliente } from "./useClientes";

export const useFilteredClientes = () => {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: ["clientes", session?.user.id, activeTenant?.id, activeArea],
    enabled: Boolean(session?.user.id && activeTenant?.id),
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para listar clientes");
      }
      let query = supabase
        .from("clientes")
        .select("*")
        .filter("tenant_id", "eq", activeTenant.id)
        .order("razao_social");

      // Filter by classification based on current workspace
      if (activeArea === "industrial") {
        query = query.eq("classificacao", "industrial");
      } else if (activeArea === "residencial") {
        query = query.eq("classificacao", "residencial");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Cliente[];
    },
  });
};
