import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Agendamento } from "./useAgendamentos";
import { useAuth } from "@/contexts/AuthContext";

export const useFilteredAgendamentos = (filtroData?: { inicio: string; fim: string }) => {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();

  return useQuery({
    queryKey: [
      "agendamentos",
      session?.user.id,
      activeTenant?.id,
      activeArea,
      filtroData?.inicio,
      filtroData?.fim,
    ],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para consultar a agenda");
      }
      let query = supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes!fk_agendamentos_cliente!inner(razao_social, classificacao, tenant_id),
          motorista:motoristas(nome)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .order("data")
        .order("horario");

      if (activeArea !== "central") {
        query = query.eq("cliente.classificacao", activeArea);
      }

      if (filtroData) {
        query = query
          .gte("data", filtroData.inicio)
          .lte("data", filtroData.fim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Agendamento[];
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
  });
};
