import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { gerarAgendamentosDoCliente, Frequencia } from "@/lib/agendamentoUtils";

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
  
  // Cria configuração padrão e gera agendamentos automaticamente
  const criarConfiguracaoComAgendamentos = async (
    clienteId: string,
    classificacao: string
  ): Promise<boolean> => {
    try {
      // Verificar se já existe configuração para este cliente
      const { data: configExistente } = await supabase
        .from("configuracoes_cliente")
        .select("id")
        .eq("cliente_id", clienteId)
        .maybeSingle();

      if (configExistente) {
        // Configuração já existe, não sobrescrever
        console.log("Configuração já existe para o cliente:", clienteId);
        return true;
      }

      // Obter configuração padrão baseada na classificação
      const configPadrao = getConfigPadraoPorClassificacao(classificacao);

      // Criar configuração do cliente
      const { error: configError } = await supabase
        .from("configuracoes_cliente")
        .insert({
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
        const { error: agendError } = await supabase
          .from("agendamentos")
          .insert(agendamentos);

        if (agendError) {
          console.error("Erro ao criar agendamentos:", agendError);
          // Não lançar erro aqui, a configuração foi criada com sucesso
          toast.warning("Configuração criada, mas houve erro ao gerar agendamentos");
          return true;
        }
      }

      console.log(`Cliente ${clienteId}: Configuração e ${agendamentos.length} agendamentos criados`);
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
