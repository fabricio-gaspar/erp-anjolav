import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfDay, subDays } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

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
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["historico_producao", ordemServicoId, activeArea],
    queryFn: async () => {
      if (!ordemServicoId) return [];
      let query = supabase
        .from("historico_producao")
        .select(`
          *,
          funcionario:funcionarios(nome),
          ordem:ordens_servico!inner(origem)
        `)
        .eq("ordem_servico_id", ordemServicoId)
        .order("created_at", { ascending: true });
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data as HistoricoProducao[];
    },
    enabled: !!ordemServicoId,
  });

  const registrarMudancaEtapa = useMutation({
    mutationFn: async ({
      ordem_servico_id,
      etapa_anterior,
      etapa_nova,
      funcionario_id,
      observacoes,
      dados_formulario,
    }: {
      ordem_servico_id: string;
      etapa_anterior?: string;
      etapa_nova: string;
      funcionario_id?: string;
      observacoes?: string;
      dados_formulario?: Record<string, unknown>;
    }) => {
      if (allowedOrigins) {
        const { data: scopedOrder, error: scopeError } = await supabase
          .from("ordens_servico")
          .select("id")
          .eq("id", ordem_servico_id)
          .in("origem", [...allowedOrigins])
          .maybeSingle();
        if (scopeError) throw scopeError;
        if (!scopedOrder) throw new Error("OS não encontrada neste painel");
      }
      const { data, error } = await supabase
        .from("historico_producao")
        .insert([{
          ordem_servico_id,
          etapa_anterior: etapa_anterior || null,
          etapa_nova,
          funcionario_id: funcionario_id || null,
          observacoes: observacoes || null,
          dados_formulario: (dados_formulario || {}) as unknown as Record<string, never>,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historico_producao"] });
    },
    onError: (error) => {
      toast.error("Erro ao registrar histórico: " + error.message);
    },
  });

  return { historico, isLoading, registrarMudancaEtapa };
}

// Hook para métricas do Dashboard
export function useMetricasProducao(enabled = true) {
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const { data: metricas, isLoading, error } = useQuery({
    queryKey: ["metricas_producao", activeArea],
    queryFn: async () => {
      const agora = new Date();
      const hoje = format(agora, "yyyy-MM-dd");
      const inicioHoje = startOfDay(agora).toISOString();
      const trintaDiasAtras = subDays(agora, 30).toISOString();

      // OS em aberto
      let osEmAbertoQuery = supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .not("status", "in", '("entregue","cancelada")');
      if (allowedOrigins) osEmAbertoQuery = osEmAbertoQuery.in("origem", [...allowedOrigins]);
      const { count: osEmAberto, error: osEmAbertoError } = await osEmAbertoQuery;
      if (osEmAbertoError) throw osEmAbertoError;

      // Entregas atrasadas
      let entregasAtrasadasQuery = supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .lt("data_previsao_entrega", hoje)
        .not("status", "eq", "entregue")
        .not("status", "eq", "cancelada");
      if (allowedOrigins) entregasAtrasadasQuery = entregasAtrasadasQuery.in("origem", [...allowedOrigins]);
      const { count: entregasAtrasadas, error: entregasAtrasadasError } = await entregasAtrasadasQuery;
      if (entregasAtrasadasError) throw entregasAtrasadasError;

      // Clientes ativos (últimos 30 dias)
      let clientesAtivosQuery = supabase
        .from("ordens_servico")
        .select("cliente_id")
        .gte("created_at", trintaDiasAtras);
      if (allowedOrigins) clientesAtivosQuery = clientesAtivosQuery.in("origem", [...allowedOrigins]);
      const { data: clientesAtivosData, error: clientesAtivosError } = await clientesAtivosQuery;
      if (clientesAtivosError) throw clientesAtivosError;
      const clientesAtivos = new Set(clientesAtivosData?.map(o => o.cliente_id)).size;

      // Peças registradas hoje
      let itensHojeQuery = supabase
        .from("itens_ordem_servico")
        .select("quantidade, ordem:ordens_servico!inner(origem)")
        .gte("created_at", inicioHoje);
      if (allowedOrigins) itensHojeQuery = itensHojeQuery.in("ordem.origem", [...allowedOrigins]);
      const { data: itensHoje, error: itensHojeError } = await itensHojeQuery;
      if (itensHojeError) throw itensHojeError;
      const pecasProcessadasHoje = itensHoje?.reduce((acc, item) => acc + Number(item.quantidade), 0) || 0;

      // OS por etapa (para gargalos)
      let osPorEtapaQuery = supabase
        .from("ordens_servico")
        .select("status")
        .not("status", "in", '("entregue","cancelada")');
      if (allowedOrigins) osPorEtapaQuery = osPorEtapaQuery.in("origem", [...allowedOrigins]);
      const { data: osPorEtapa, error: osPorEtapaError } = await osPorEtapaQuery;
      if (osPorEtapaError) throw osPorEtapaError;
      
      const gargalos = osPorEtapa?.reduce((acc, os) => {
        acc[os.status] = (acc[os.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        osEmAberto: osEmAberto || 0,
        entregasAtrasadas: entregasAtrasadas || 0,
        clientesAtivos,
        pecasProcessadasHoje,
        gargalos,
      };
    },
    enabled,
    refetchInterval: enabled ? 30000 : false,
  });

  return { metricas, isLoading, error };
}

// Hook para agenda do dia
export function useAgendaDia(enabled = true) {
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const hoje = format(new Date(), "yyyy-MM-dd");

  const { data: retiradas = [], isLoading: isLoadingRetiradas, error: retiradasError } = useQuery({
    queryKey: ["agenda_retiradas", hoje, activeArea],
    queryFn: async () => {
      let query = supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes!inner(razao_social, classificacao)
        `)
        .eq("tipo", "retirada")
        .eq("data", hoje)
        .order("horario");
      if (activeArea !== "central") query = query.eq("cliente.classificacao", activeArea);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: entregas = [], isLoading: isLoadingEntregas, error: entregasError } = useQuery({
    queryKey: ["agenda_entregas", hoje, activeArea],
    queryFn: async () => {
      // 1. Buscar agendamentos de entrega do dia
      let agendamentosQuery = supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes!inner(razao_social, classificacao)
        `)
        .eq("tipo", "entrega")
        .eq("data", hoje)
        .neq("status", "realizado")
        .order("horario");
      if (activeArea !== "central") agendamentosQuery = agendamentosQuery.eq("cliente.classificacao", activeArea);
      const { data: agendamentosEntrega, error: errAgend } = await agendamentosQuery;
      if (errAgend) throw errAgend;

      // 2. Buscar OS prontas para entrega (status: expedicao)
      let osProntasQuery = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social)
        `)
        .eq("status", "expedicao")
        .order("created_at");
      if (allowedOrigins) osProntasQuery = osProntasQuery.in("origem", [...allowedOrigins]);
      const { data: osProntasEntrega, error: errOS } = await osProntasQuery;
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
    enabled,
  });

  return {
    retiradas,
    entregas,
    isLoading: isLoadingRetiradas || isLoadingEntregas,
    error: retiradasError || entregasError,
  };
}

// Hook para resumo de processamento
export function useResumoProcessamento(enabled = true) {
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const { data: osEmProcessamento = [], isLoading, error } = useQuery({
    queryKey: ["resumo_processamento", activeArea],
    queryFn: async () => {
      let query = supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social),
          historico:historico_producao(created_at, etapa_nova, dados_formulario),
          itens:itens_ordem_servico(
            quantidade,
            produto:produtos(
              nome,
              tempo_processo_min,
              peso_medio_kg
            )
          )
        `)
        .not("status", "in", '("entregue","cancelada")')
        .order("created_at", { ascending: false })
        .limit(10);
      if (allowedOrigins) query = query.in("origem", [...allowedOrigins]);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  return { osEmProcessamento, isLoading, error };
}
