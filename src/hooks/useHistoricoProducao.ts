import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const { data: historico = [], isLoading } = useQuery({
    queryKey: ["historico_producao", ordemServicoId],
    queryFn: async () => {
      if (!ordemServicoId) return [];
      const { data, error } = await supabase
        .from("historico_producao")
        .select(`
          *,
          funcionario:funcionarios(nome)
        `)
        .eq("ordem_servico_id", ordemServicoId)
        .order("created_at", { ascending: true });
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
export function useMetricasProducao() {
  const { data: metricas, isLoading } = useQuery({
    queryKey: ["metricas_producao"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // OS em aberto
      const { count: osEmAberto } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .not("status", "in", '("entregue","cancelada")');

      // Entregas atrasadas
      const { count: entregasAtrasadas } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .lt("data_previsao_entrega", hoje)
        .not("status", "eq", "entregue")
        .not("status", "eq", "cancelada");

      // Clientes ativos (últimos 30 dias)
      const { data: clientesAtivosData } = await supabase
        .from("ordens_servico")
        .select("cliente_id")
        .gte("created_at", trintaDiasAtras);
      const clientesAtivos = new Set(clientesAtivosData?.map(o => o.cliente_id)).size;

      // Peças processadas hoje
      const { data: itensHoje } = await supabase
        .from("itens_ordem_servico")
        .select("quantidade, ordem_servico_id")
        .gte("created_at", hoje);
      const pecasProcessadasHoje = itensHoje?.reduce((acc, item) => acc + Number(item.quantidade), 0) || 0;

      // OS por etapa (para gargalos)
      const { data: osPorEtapa } = await supabase
        .from("ordens_servico")
        .select("status")
        .not("status", "in", '("entregue","cancelada")');
      
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
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  return { metricas, isLoading };
}

// Hook para agenda do dia
export function useAgendaDia() {
  const hoje = new Date().toISOString().split("T")[0];

  const { data: retiradas = [], isLoading: isLoadingRetiradas } = useQuery({
    queryKey: ["agenda_retiradas", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select(`
          *,
          cliente:clientes(razao_social)
        `)
        .eq("tipo", "retirada")
        .eq("data", hoje)
        .order("horario");
      if (error) throw error;
      return data;
    },
  });

  const { data: entregas = [], isLoading: isLoadingEntregas } = useQuery({
    queryKey: ["agenda_entregas", hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(`
          *,
          cliente:clientes(razao_social)
        `)
        .eq("data_previsao_entrega", hoje)
        .eq("status", "expedicao")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  return {
    retiradas,
    entregas,
    isLoading: isLoadingRetiradas || isLoadingEntregas,
  };
}

// Hook para resumo de processamento
export function useResumoProcessamento() {
  const { data: osEmProcessamento = [], isLoading } = useQuery({
    queryKey: ["resumo_processamento"],
    queryFn: async () => {
      const { data, error } = await supabase
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
      if (error) throw error;
      return data;
    },
  });

  return { osEmProcessamento, isLoading };
}
