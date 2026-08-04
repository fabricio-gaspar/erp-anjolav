import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Agendamento } from "./useAgendamentos";

export const useFilteredAgendamentos = (filtroData?: { inicio: string; fim: string }) => {
  const { activeArea } = useWorkspace();

  return useQuery({
    queryKey: ["agendamentos", activeArea, filtroData],
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes(razao_social, classificacao),
          motorista:motoristas(nome)
        `)
        .order("data")
        .order("horario");

      if (filtroData) {
        query = query
          .gte("data", filtroData.inicio)
          .lte("data", filtroData.fim);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by client classification based on workspace
      return (data as any[]).filter(a => {
        if (!a.cliente) return true;
        if (activeArea === "industrial") return a.cliente.classificacao === "industrial";
        if (activeArea === "residencial") return a.cliente.classificacao === "residencial";
        return true;
      }) as Agendamento[];
    },
  });
};
