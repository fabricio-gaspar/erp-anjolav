import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { HistoricoProducao } from "./useHistoricoProducao";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { getAllowedOrderOrigins } from "@/lib/workspaceScope";

export interface DadosResumoOS {
  quantidadePecas: number;
  pesoTotal: number;
  tempoTotalProducao: string;
  ultimoFuncionario: string | null;
  historicoCompleto: HistoricoProducao[];
}

export function useHistoricoProducaoResumo(ordemServicoId: string | null) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  return useQuery({
    queryKey: ["historico_producao_resumo", session?.user.id, activeTenant?.id, activeArea, ordemServicoId],
    queryFn: async (): Promise<DadosResumoOS | null> => {
      if (!ordemServicoId || !session?.user.id || !activeTenant?.id) return null;

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
      if (!data || data.length === 0) return null;

      const historico = data as HistoricoProducao[];
      
      let quantidadePecas = 0;
      let pesoTotal = 0;
      let ultimoFuncionario: string | null = null;

      historico.forEach((registro) => {
        const dados = registro.dados_formulario as Record<string, unknown> || {};
        
        if (dados.quantidade_pecas) {
          quantidadePecas = dados.quantidade_pecas as number;
        }
        if (dados.peso_total_kg) {
          pesoTotal = dados.peso_total_kg as number;
        }
        if (dados.peso_final_kg) {
          pesoTotal = dados.peso_final_kg as number;
        }
        if (registro.funcionario?.nome) {
          ultimoFuncionario = registro.funcionario.nome;
        }
      });

      // Calcular tempo total de produção
      const primeiroRegistro = historico[0];
      const ultimoRegistro = historico[historico.length - 1];
      const tempoMs = new Date(ultimoRegistro.created_at).getTime() - new Date(primeiroRegistro.created_at).getTime();
      const horas = Math.floor(tempoMs / (1000 * 60 * 60));
      const minutos = Math.floor((tempoMs % (1000 * 60 * 60)) / (1000 * 60));
      const tempoTotalProducao = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;

      return {
        quantidadePecas,
        pesoTotal,
        tempoTotalProducao,
        ultimoFuncionario,
        historicoCompleto: historico,
      };
    },
    enabled: Boolean(ordemServicoId && session?.user.id && activeTenant?.id),
  });
}

// Hook para buscar histórico de múltiplas OS de uma vez
export function useHistoricoMultiplasOS(ordemServicoIds: string[]) {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);
  const stableOrderIds = [...new Set(ordemServicoIds)].sort();

  return useQuery({
    queryKey: ["historico_producao_multiplas", session?.user.id, activeTenant?.id, activeArea, stableOrderIds],
    queryFn: async () => {
      if (stableOrderIds.length === 0 || !session?.user.id || !activeTenant?.id) return {};

      let query = supabase
        .from("historico_producao")
        .select(`
          *,
          funcionario:funcionarios(nome),
          ordem:ordens_servico!historico_producao_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .in("ordem_servico_id", stableOrderIds)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id)
        .order("created_at", { ascending: true });
      if (allowedOrigins) query = query.in("ordem.origem", [...allowedOrigins]);

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por ordem_servico_id
      const grouped: Record<string, HistoricoProducao[]> = {};
      (data as HistoricoProducao[]).forEach((registro) => {
        if (!grouped[registro.ordem_servico_id]) {
          grouped[registro.ordem_servico_id] = [];
        }
        grouped[registro.ordem_servico_id].push(registro);
      });

      return grouped;
    },
    enabled: Boolean(stableOrderIds.length > 0 && session?.user.id && activeTenant?.id),
  });
}

// Hook para métricas avançadas de produção
export function useMetricasProducaoAvancadas() {
  const { activeTenant, session } = useAuth();
  const { activeArea } = useWorkspace();
  const allowedOrigins = getAllowedOrderOrigins(activeArea);

  return useQuery({
    queryKey: ["metricas_producao_avancadas", session?.user.id, activeTenant?.id, activeArea],
    queryFn: async () => {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para resumir a produção");
      }
      const agora = new Date();
      const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();

      // Buscar todo histórico de hoje
      let historicoHojeQuery = supabase
        .from("historico_producao")
        .select(`
          *,
          funcionario:funcionarios(nome),
          ordem:ordens_servico!historico_producao_ordem_servico_id_fkey!inner(origem, tenant_id)
        `)
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id)
        .gte("created_at", inicioHoje);
      if (allowedOrigins) historicoHojeQuery = historicoHojeQuery.in("ordem.origem", [...allowedOrigins]);

      const { data: historicoHoje, error } = await historicoHojeQuery;

      if (error) throw error;

      // Calcular peso total processado hoje
      let pesoTotalHoje = 0;
      let pecasTotaisHoje = 0;
      const funcionarioProducao: Record<string, number> = {};

      (historicoHoje as HistoricoProducao[]).forEach((registro) => {
        const dados = registro.dados_formulario as Record<string, unknown> || {};
        
        if (dados.peso_total_kg) {
          pesoTotalHoje += dados.peso_total_kg as number;
        }
        if (dados.peso_final_kg) {
          pesoTotalHoje += dados.peso_final_kg as number;
        }
        if (dados.quantidade_pecas) {
          pecasTotaisHoje += dados.quantidade_pecas as number;
        }

        // Contar produtividade por funcionário
        if (registro.funcionario?.nome) {
          funcionarioProducao[registro.funcionario.nome] = 
            (funcionarioProducao[registro.funcionario.nome] || 0) + 1;
        }
      });

      // Encontrar funcionário mais produtivo
      let funcionarioMaisProdutivo: { nome: string; etapas: number } | null = null;
      Object.entries(funcionarioProducao).forEach(([nome, etapas]) => {
        if (!funcionarioMaisProdutivo || etapas > funcionarioMaisProdutivo.etapas) {
          funcionarioMaisProdutivo = { nome, etapas };
        }
      });

      // Calcular média de tempo por etapa (últimos 7 dias)
      const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let historicoSemanaQuery = supabase
        .from("historico_producao")
        .select("etapa_nova, tempo_na_etapa_anterior, ordem:ordens_servico!historico_producao_ordem_servico_id_fkey!inner(origem, tenant_id)")
        .filter("tenant_id", "eq", activeTenant.id)
        .filter("ordem.tenant_id", "eq", activeTenant.id)
        .gte("created_at", seteDiasAtras)
        .not("tempo_na_etapa_anterior", "is", null);
      if (allowedOrigins) historicoSemanaQuery = historicoSemanaQuery.in("ordem.origem", [...allowedOrigins]);
      const { data: historicoSemana, error: historicoSemanaError } = await historicoSemanaQuery;
      if (historicoSemanaError) throw historicoSemanaError;

      const temposPorEtapa: Record<string, number[]> = {};
      (historicoSemana || []).forEach((registro: { etapa_nova: string; tempo_na_etapa_anterior: string | null }) => {
        if (registro.tempo_na_etapa_anterior) {
          // Parse interval format (e.g., "01:30:00" or "1 day 02:00:00")
          const match = registro.tempo_na_etapa_anterior.match(/(\d+):(\d+):(\d+)/);
          if (match) {
            const horas = parseInt(match[1]);
            const minutos = parseInt(match[2]);
            const totalMinutos = horas * 60 + minutos;
            
            if (!temposPorEtapa[registro.etapa_nova]) {
              temposPorEtapa[registro.etapa_nova] = [];
            }
            temposPorEtapa[registro.etapa_nova].push(totalMinutos);
          }
        }
      });

      const mediaTempoPorEtapa: Record<string, string> = {};
      Object.entries(temposPorEtapa).forEach(([etapa, tempos]) => {
        const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
        const horas = Math.floor(media / 60);
        const minutos = Math.round(media % 60);
        mediaTempoPorEtapa[etapa] = horas > 0 ? `${horas}h ${minutos}min` : `${minutos}min`;
      });

      return {
        pesoTotalHoje,
        pecasTotaisHoje,
        funcionarioMaisProdutivo,
        mediaTempoPorEtapa,
        totalEtapasHoje: historicoHoje?.length || 0,
      };
    },
    enabled: Boolean(session?.user.id && activeTenant?.id),
    refetchInterval: 60000, // Atualiza a cada minuto
  });
}
