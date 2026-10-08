import { supabase } from "@/integrations/supabase/client";

interface NotificacaoDados {
  cliente: string;
  telefone: string;
  numero: string;
  valor?: string;
  previsao?: string;
  totalPecas?: string;
  ordem_servico_id?: string;
  cliente_id?: string;
}

/**
 * Busca o template de notificação ativo para um evento específico
 */
export async function getNotificacaoTemplate(evento: string) {
  const { data, error } = await supabase
    .from("notificacoes_config")
    .select("*")
    .eq("evento", evento)
    .eq("canal", "whatsapp")
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar template de notificação:", error);
    return null;
  }

  return data;
}

/**
 * Substitui variáveis no template ({cliente}, {numero}, etc.)
 */
export function montarMensagem(
  template: string,
  variaveis: Record<string, string>
): string {
  let mensagem = template;
  for (const [chave, valor] of Object.entries(variaveis)) {
    mensagem = mensagem.split(`{${chave}}`).join(valor);
  }
  return mensagem;
}

/**
 * Envia mensagem via Evolution API (Edge Function)
 */
async function enviarViaEvolution(
  telefone: string,
  mensagem: string,
  ordem_servico_id?: string,
  cliente_id?: string,
  evento?: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
      body: {
        action: "send",
        telefone,
        mensagem,
        ordem_servico_id,
        cliente_id,
        evento,
      },
    });
    if (error) throw error;
    return data?.success === true;
  } catch (error) {
    console.error("Erro ao enviar via Evolution:", error);
    return false;
  }
}

/**
 * Função principal: verifica config, monta mensagem e dispara WhatsApp
 * Retorna true somente quando a Evolution API confirma que aceitou o envio.
 */
export async function dispararNotificacao(
  evento: string,
  dados: NotificacaoDados
): Promise<boolean> {
  try {
    // Verificar se o evento está ativo
    const config = await getNotificacaoTemplate(evento);

    if (!config) {
      return false;
    }

    // Montar a mensagem com as variáveis
    const variaveis: Record<string, string> = {
      cliente: dados.cliente,
      numero: dados.numero,
    };

    if (dados.valor) variaveis.valor = dados.valor;
    if (dados.previsao) variaveis.previsao = dados.previsao;
    if (dados.totalPecas) variaveis.total_pecas = dados.totalPecas;

    const mensagem = montarMensagem(config.template, variaveis);

    return await enviarViaEvolution(
      dados.telefone,
      mensagem,
      dados.ordem_servico_id,
      dados.cliente_id,
      evento
    );
  } catch (error) {
    console.error(`Erro ao disparar notificação "${evento}":`, error);
    return false;
  }
}
