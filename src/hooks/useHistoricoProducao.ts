import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfDay, subDays } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateDashboardQueriesAfterProductionAdvance } from "@/lib/queryDefaults";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";
import type { Json } from "@/integrations/supabase/types";
import { createIdempotencyKey } from "@/lib/idempotency";

export interface HistoricoProducao {
  id: string;
  ordem_servico_id: string;
  etapa_anterior: string | null;
  etapa_nova: string;
  funcionario_id: string | null;
  observacoes: string | null;
  dados_formulario: Record<string, unknown>;
  tempo_na_etapa_anterior: string | null;
  created_at: string;
  funcionario?: {
    nome: string;
  };
}

export interface DadosFormularioSeparacao {
  quantidade_pecas: number;
  peso_total_kg: number;
  itens_danificados?: string;
  observacoes?: string;
}

export interface DadosFormularioLavagem {
  maquina_utilizada: string;
  temperatura: number;
  produtos_utilizados: string;
  funcionario_responsavel?: string;
}

export interface DadosFormularioPassadoria {
  tipo_acabamento: string;
  quantidade_passada: number;
  observacoes_qualidade?: string;
}

export interface DadosFormularioEmbalagem {
  tipo_embalagem: string;
  quantidade_volumes: number;
  peso_final_kg: number;
  pronto_para_entrega: boolean;
}

export interface DadosFormularioEntrega {
  motorista_id?: string;
  veiculo_id?: string;
  assinatura_recebedor?: string;
  data_hora_entrega: string;
  observacoes?: string;
}

export function useHistoricoProducao(ordemServicoId: string | null) {
  const queryClient = useQueryClient();
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["historico_producao", session?.user.id, activeTenant?.id, ordemServicoId, activeArea],
    queryFn: async () => {
      if (!ordemServicoId || !session?.user.id || !activeTenant?.id) return [];
      let query = supabase
        .from("historico_producao")
        .select(`
          *,
          funcionario:funcionarios(nome),
          ordem:ordens_servico!historico_producao_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .eq("ordem_servico_id", ordemServicoId)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: true });
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data as HistoricoProducao[];
    },
    enabled: Boolean(ordemServicoId && session?.user.id && activeTenant?.id),
  });

  const avancarEtapa = useMutation({
    mutationFn: async ({
      ordem_servico_id,
      etapa_esperada,
      proxima_etapa,
      funcionario_id,
      observacoes,
      dados_formulario,
      itens,
      idempotency_key,
    }: {
      ordem_servico_id: string;
      etapa_esperada: string;
      proxima_etapa: string;
      funcionario_id?: string;
      observacoes?: string;
      dados_formulario?: Record<string, unknown>;
      itens?: Array<{ produto_id: string; quantidade: number }>;
      idempotency_key?: string;
    }) => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para avançar a produção");
      }
      const { data, error } = await supabase.rpc("processar_fila_producao", {
        _ordens: [{
          id: ordem_servico_id,
          dados_formulario: dados_formulario || {},
          itens: itens || [],
        }] as unknown as Json,
        _etapa_esperada: etapa_esperada,
        _proxima_etapa: proxima_etapa,
        _funcionario_id: funcionario_id || null,
        _recurso: String(dados_formulario?.maquina_utilizada || dados_formulario?.recurso || "") || null,
        _ocorrencia: observacoes || null,
        _nova_previsao: null,
        _idempotency_key: idempotency_key || createIdempotencyKey("production"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico_producao"] });
      queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
      queryClient.invalidateQueries({ queryKey: ["order-directory"] });
      queryClient.invalidateQueries({ queryKey: ["itens_ordem_servico"] });
      void invalidateDashboardQueriesAfterProductionAdvance(queryClient);
    },
    onError: (error) => {
      toast.error("Não foi possível avançar a etapa: " + error.message);
    },
  });

  return { historico, isLoading, avancarEtapa };
}

// Hook para métricas do Dashboard
export function useMetricasProducao(enabled = true) {
  const { activeArea } = useWorkspace();
  const { activeTenant, session } = useAuth();
  const { data: metricas, isLoading, error } = useQuery({
    queryKey: ["metricas_producao", session?.user.id, activeTenant?.id, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir a produção");
      }
      const agora = new Date();
      const inicioHoje = startOfDay(agora).toISOString();
      const trintaDiasAtras = subDays(agora, 30).toISOString();
      const { data, error: metricsError } = await supabase.rpc("consultar_metricas_producao", {
        _setor: activeArea,
        _inicio_hoje: inicioHoje,
        _trinta_dias_atras: trintaDiasAtras,
      });
      if (metricsError) throw metricsError;
      const result = data as {
        osEmAberto?: number;
        entregasAtrasadas?: number;
        clientesAtivos?: number;
        pecasProcessadasHoje?: number;
        gargalos?: Record<string, number>;
      } | null;

      return {
        osEmAberto: Number(result?.osEmAberto ?? 0),
        entregasAtrasadas: Number(result?.entregasAtrasadas ?? 0),
        clientesAtivos: Number(result?.clientesAtivos ?? 0),
        pecasProcessadasHoje: Number(result?.pecasProcessadasHoje ?? 0),
        gargalos: result?.gargalos ?? {},
      };
    },
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
  });

  return { metricas, isLoading, error };
}

// Hook para agenda do dia
export function useAgendaDia(enabled = true) {
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const { activeTenant, session } = useAuth();
  const hoje = format(new Date(), "yyyy-MM-dd");

  const {
    data: retiradas = [],
    isLoading: isLoadingRetiradas,
    error: retiradasError,
    refetch: refetchRetiradas,
  } = useQuery({
    queryKey: ["agenda_retiradas", session?.user.id, activeTenant?.id, hoje, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir a agenda");
      }
      let query = supabase
        .from("agendamentos")
        .select(`
          id, cliente_id, horario, status,
          cliente:clientes!fk_agendamentos_cliente!inner(razao_social, classificacao, tenant_id)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("tipo", "retirada")
        .eq("data", hoje)
        .order("horario");
      if (activeArea !== "central") query = query.eq("cliente.classificacao", activeArea);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
  });

  const {
    data: entregas = [],
    isLoading: isLoadingEntregas,
    error: entregasError,
    refetch: refetchEntregas,
  } = useQuery({
    queryKey: ["agenda_entregas", session?.user.id, activeTenant?.id, hoje, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir a agenda");
      }
      // 1. Buscar agendamentos de entrega do dia
      let agendamentosQuery = supabase
        .from("agendamentos")
        .select(`
          id, cliente_id, horario, status,
          cliente:clientes!fk_agendamentos_cliente!inner(razao_social, classificacao, tenant_id)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("tipo", "entrega")
        .eq("data", hoje)
        .neq("status", "realizado")
        .order("horario");
      if (activeArea !== "central") agendamentosQuery = agendamentosQuery.eq("cliente.classificacao", activeArea);

      // 2. Buscar OS prontas para entrega (status: expedicao)
      let osProntasQuery = supabase
        .from("ordens_servico")
        .select(`
          id, cliente_id, numero, data_previsao_entrega, entrega_modalidade,
          cliente:clientes!ordens_servico_cliente_id_fkey(razao_social)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .eq("status", "expedicao")
        .eq("entrega_modalidade", "entrega")
        .order("created_at");
      if (allowedOrigins) osProntasQuery = osProntasQuery.in("origem", [...allowedOrigins]);
      const [
        { data: agendamentosEntrega, error: errAgend },
        { data: osProntasEntrega, error: errOS },
      ] = await Promise.all([agendamentosQuery, osProntasQuery]);
      if (errAgend) throw errAgend;
      if (errOS) throw errOS;

      // 3. Formatar agendamentos
      const entregasAgendadas = (agendamentosEntrega || []).map(a => ({
        ...a,
        origem: 'agendamento' as const,
        pronto_entrega: false,
        os_numero: null,
      }));

      // 4. Formatar OS prontas para entrega
      const entregasProntas = (osProntasEntrega || []).map(os => ({
        id: os.id,
        cliente: os.cliente,
        cliente_id: os.cliente_id,
        horario: null,
        data: hoje,
        tipo: 'entrega',
        status: 'agendado',
        origem: 'producao' as const,
        pronto_entrega: true,
        os_numero: os.numero,
        data_previsao: os.data_previsao_entrega,
      }));

      return [...entregasProntas, ...entregasAgendadas];
    },
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
  });

  // Every ROL keeps its promised date and its selected return modality.  The
  // daily list reads that operational record directly, so a ROL does not have
  // to depend on a second manual appointment to appear on the correct day.
  const {
    data: rolsProgramados = [],
    isLoading: isLoadingRolsProgramados,
    error: rolsProgramadosError,
    refetch: refetchRolsProgramados,
  } = useQuery({
    queryKey: ["agenda-rols-programados", session?.user.id, activeTenant?.id, hoje, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir a agenda");
      }
      let query = supabase
        .from("ordens_servico")
        .select(`
          id, cliente_id, numero, data_previsao_entrega, entrega_modalidade, status,
          cliente:clientes!ordens_servico_cliente_id_fkey!inner(razao_social, classificacao, tenant_id)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("cliente.tenant_id", "eq", activeTenant.id)
        .eq("data_previsao_entrega", hoje)
        .neq("status", "cancelada")
        .neq("status", "entregue")
        .neq("status", "retirada")
        .order("created_at");
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      if (activeArea !== "central") query = query.eq("cliente.classificacao", activeArea);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
  });

  const ordemProntaIds = new Set(
    entregas
      .filter((item) => item.origem === "producao")
      .map((item) => item.id),
  );
  const retiradasProgramadas = rolsProgramados
    .filter((rol) => rol.entrega_modalidade !== "entrega")
    .map((rol) => ({
      id: `rol-${rol.id}`,
      cliente: rol.cliente,
      cliente_id: rol.cliente_id,
      horario: null,
      status: rol.status === "expedicao" ? "agendado" : "programada",
      origem: "rol_programado" as const,
      pronto_entrega: rol.status === "expedicao",
      os_numero: rol.numero,
      entrega_modalidade: "balcao",
    }));
  const entregasProgramadas = rolsProgramados
    .filter((rol) => rol.entrega_modalidade === "entrega" && !ordemProntaIds.has(rol.id))
    .map((rol) => ({
      id: `rol-${rol.id}`,
      cliente: rol.cliente,
      cliente_id: rol.cliente_id,
      horario: null,
      status: rol.status === "expedicao" ? "agendado" : "programada",
      origem: "rol_programado" as const,
      pronto_entrega: rol.status === "expedicao",
      os_numero: rol.numero,
      entrega_modalidade: "entrega",
    }));

  return {
    retiradas: [...retiradas, ...retiradasProgramadas],
    entregas: [...entregas, ...entregasProgramadas],
    isLoading: isLoadingRetiradas || isLoadingEntregas || isLoadingRolsProgramados,
    error: retiradasError || entregasError || rolsProgramadosError,
    refetch: async () => {
      await Promise.all([refetchRetiradas(), refetchEntregas(), refetchRolsProgramados()]);
    },
  };
}

// Hook para resumo de processamento
export function useResumoProcessamento(enabled = true) {
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const { activeTenant, session } = useAuth();
  const { data: osEmProcessamento = [], isLoading, error } = useQuery({
    queryKey: ["resumo_processamento", session?.user.id, activeTenant?.id, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir o processamento");
      }
      let query = supabase
        .from("ordens_servico")
        .select(`
          numero, status, data_previsao_entrega, data_retirada, created_at,
          cliente:clientes!ordens_servico_cliente_id_fkey(razao_social),
          historico:historico_producao!historico_producao_ordem_servico_id_fkey(created_at, etapa_nova, dados_formulario),
          itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey(
            quantidade,
            produto:produtos!itens_ordem_servico_produto_id_fkey(
              nome,
              tempo_processo_min,
              peso_medio_kg
            )
          )
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .not("status", "in", '("entregue","cancelada")')
        .order("created_at", { ascending: false })
        .limit(10);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id),
  });

  return { osEmProcessamento, isLoading, error };
}
