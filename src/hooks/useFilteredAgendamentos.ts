import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Agendamento } from "./useAgendamentos";
import { useAuth } from "@/contexts/AuthContext";
import { calcularProximasDatas, type Frequencia } from "@/lib/agendamentoUtils";
import { format } from "date-fns";

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
      const persisted = ((data ?? []) as Agendamento[]).map((item) => ({
        ...item,
        isConfiguredSchedule: item.gerado_por_configuracao_cliente === true,
      }));
      const { data: configs, error: configError } = await supabase
        .from("configuracoes_cliente")
        .select("cliente_id,frequencia,retirada_ativa,entrega_ativa,dias_retirada,dias_entrega,horario_retirada,horario_entrega")
        .eq("tenant_id", activeTenant.id);

      // A agenda principal continua disponível mesmo que a leitura complementar
      // das configurações esteja bloqueada por uma política específica.
      if (configError || !configs?.length) return persisted;

      const configRows = configs.filter((config) =>
        (config.retirada_ativa && Array.isArray(config.dias_retirada) && config.dias_retirada.length > 0)
        || (config.entrega_ativa && Array.isArray(config.dias_entrega) && config.dias_entrega.length > 0),
      );
      if (!configRows.length) return persisted;

      const clientIds = [...new Set(configRows.map((config) => config.cliente_id))];
      let clientsQuery = supabase
        .from("clientes")
        .select("id,razao_social,classificacao,tenant_id")
        .eq("tenant_id", activeTenant.id)
        .eq("ativo", true)
        .in("id", clientIds);
      if (activeArea !== "central") clientsQuery = clientsQuery.eq("classificacao", activeArea);
      const { data: clients, error: clientsError } = await clientsQuery;
      if (clientsError || !clients?.length) return persisted;

      const clientsById = new Map(clients.map((client) => [client.id, client]));
      const persistedKeys = new Set(persisted.map((item) => `${item.cliente_id}|${item.tipo}|${item.data}`));
      const generated = configRows.flatMap((config): Agendamento[] => {
        const client = clientsById.get(config.cliente_id);
        if (!client) return [];
        const frequencia = (config.frequencia || "semanal") as Frequencia;
        const configuredTypes: Array<{
          type: "retirada" | "entrega";
          enabled: boolean;
          days: string[] | null;
          time: string | null;
        }> = [
          { type: "retirada", enabled: config.retirada_ativa, days: config.dias_retirada, time: config.horario_retirada },
          { type: "entrega", enabled: config.entrega_ativa, days: config.dias_entrega, time: config.horario_entrega },
        ];
        return configuredTypes.flatMap(({ type, enabled, days, time }) => {
          if (!enabled || !Array.isArray(days) || days.length === 0) return [];
          return calcularProximasDatas(days, frequencia, 120)
            .map((date) => format(date, "yyyy-MM-dd"))
            .filter((date) => !filtroData || (date >= filtroData.inicio && date <= filtroData.fim))
            .filter((date) => !persistedKeys.has(`${config.cliente_id}|${type}|${date}`))
            .map((date) => ({
              id: `config-${type}-${config.cliente_id}-${date}`,
              cliente_id: config.cliente_id,
              tipo: type,
              data: date,
              horario: time,
              frequencia,
              recorrente: true,
              motorista_id: null,
              observacoes: `${type === "retirada" ? "Retirada" : "Entrega"} configurada no cadastro do cliente.`,
              status: "agendado" as const,
              created_at: "",
              updated_at: "",
              isConfiguredSchedule: true,
              cliente: { razao_social: client.razao_social },
            }));
        });
      });

      return [...persisted, ...generated].sort((left, right) => `${left.data} ${left.horario || ""}`.localeCompare(`${right.data} ${right.horario || ""}`));
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
  });
};
