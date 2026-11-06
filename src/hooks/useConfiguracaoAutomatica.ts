import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { gerarAgendamentosDoCliente, Frequencia } from "@/lib/agendamentoUtils";
import { useAuth } from "@/contexts/AuthContext";
import { createIdempotencyKey } from "@/lib/idempotency";
import type { Json } from "@/integrations/supabase/types";

export interface ConfiguracaoPadrao {
  frequencia: Frequencia;
  dias_retirada: string[];
  dias_entrega: string[];
  horario_retirada?: string;
  horario_entrega?: string;
}

// Retorna configuração padrão baseada na classificação do cliente
export function getConfigPadraoPorClassificacao(classificacao: string): ConfiguracaoPadrao {
  if (classificacao === "industrial") {
    return {
      frequencia: "semanal",
      dias_retirada: ["ter", "qui"],
      dias_entrega: ["ter", "qui"],
      horario_retirada: "08:00",
      horario_entrega: "08:00",
    };
  } else {
    // residencial
    return {
      frequencia: "quinzenal",
      dias_retirada: ["qua"],
      dias_entrega: ["sex"],
      horario_retirada: "09:00",
      horario_entrega: "09:00",
    };
  }
}

export function useConfiguracaoAutomatica() {
  const { activeTenant, session } = useAuth();
  
  // Cria configuração padrão e gera agendamentos automaticamente
  const criarConfiguracaoComAgendamentos = async (
    clienteId: string,
    classificacao: string
  ): Promise<boolean> => {
    try {
      if (!session?.user.id || !activeTenant?.id) {
        throw new Error("Uma sessão autenticada e uma empresa ativa são obrigatórias para criar a configuração");
      }
      // Verificar se já existe configuração para este cliente
      const { data: configExistente } = await supabase
        .from("configuracoes_cliente")
        .select("id")
        .eq("cliente_id", clienteId)
        .filter("tenant_id", "eq", activeTenant.id)
        .maybeSingle();

      if (configExistente) {
        // Configuração já existe, não sobrescrever
        return true;
      }

      // Obter configuração padrão baseada na classificação
      const configPadrao = getConfigPadraoPorClassificacao(classificacao);

      // Criar configuração do cliente
      const { error: configError } = await supabase
        .from("configuracoes_cliente")
        .insert({
          tenant_id: activeTenant.id,
          cliente_id: clienteId,
          frequencia: configPadrao.frequencia,
          dias_retirada: configPadrao.dias_retirada,
          dias_entrega: configPadrao.dias_entrega,
          horario_retirada: configPadrao.horario_retirada,
          horario_entrega: configPadrao.horario_entrega,
          tipo_relatorio: "detalhado",
        });

      if (configError) {
        console.error("Erro ao criar configuração:", configError);
        throw configError;
      }

      // Gerar agendamentos para os próximos 60 dias
      const agendamentos = gerarAgendamentosDoCliente(clienteId, {
        frequencia: configPadrao.frequencia,
        dias_retirada: configPadrao.dias_retirada,
        dias_entrega: configPadrao.dias_entrega,
        horario_retirada: configPadrao.horario_retirada || null,
        horario_entrega: configPadrao.horario_entrega || null,
      }, 60);

      if (agendamentos.length > 0) {
        const payload = agendamentos.map(({ tipo, data, horario, frequencia }) => ({
          tipo,
          data,
          horario,
          frequencia,
        }));
        const { error: agendError } = await supabase.rpc("regenerar_agendamentos_recorrentes", {
          _cliente_id: clienteId,
          _agendamentos: payload as unknown as Json,
          _idempotency_key: createIdempotencyKey("appointment-recurrence"),
        });

        if (agendError) {
          console.error("Erro ao criar agendamentos:", agendError);
          throw agendError;
        }
      }

      return true;
    } catch (error) {
      console.error("Erro ao criar configuração automática:", error);
      return false;
    }
  };

  return {
    criarConfiguracaoComAgendamentos,
    getConfigPadraoPorClassificacao,
  };
}
