import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Cliente } from "./useClientes";

export const useFilteredClientes = () => {
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["clientes", activeArea],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("*")
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
