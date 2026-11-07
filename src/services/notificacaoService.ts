import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";

interface NotificacaoDados {
  cliente: string;
  telefone: string;
  numero: string;
  valor?: string;
  previsao?: string;
  totalPecas?: string;
  itens?: string;
  modalidade?: string;
  ordem_servico_id?: string;
  cliente_id?: string;
  idempotencyKey?: string;
}

export type EventoNotificacaoRol =
  | "rol_entrada"
  | "rol_pronto_retirada"
  | "rol_pronto_delivery";

export interface ResultadoNotificacaoAutomatica {
  success: boolean;
  skipped: boolean;
  idempotent: boolean;
  reason?: string;
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
  evento?: string,
  idempotencyKey?: string,
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
        idempotency_key: idempotencyKey || createIdempotencyKey("whatsapp"),
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
    if (dados.itens) variaveis.itens = dados.itens;
    if (dados.modalidade) variaveis.modalidade = dados.modalidade;

    const mensagem = montarMensagem(config.template, variaveis);

    return await enviarViaEvolution(
      dados.telefone,
      mensagem,
      dados.ordem_servico_id,
      dados.cliente_id,
      evento,
      dados.idempotencyKey,
    );
  } catch (error) {
    console.error(`Erro ao disparar notificação "${evento}":`, error);
    return false;
  }
}

/**
 * Dispara os marcos automáticos do ROL no servidor.
 *
 * A Edge Function lê o ROL persistido, monta a mensagem a partir do template
 * do tenant e reserva a chave de idempotência antes de chamar o WhatsApp.
 * Assim, uma repetição de clique não duplica a mensagem do cliente.
 */
export async function dispararNotificacaoAutomatica(
  evento: EventoNotificacaoRol,
  ordemServicoId: string,
  idempotencyKey: string,
): Promise<ResultadoNotificacaoAutomatica> {
  try {
    const { data, error } = await supabase.functions.invoke("rol-notifications", {
      body: {
        evento,
        ordem_servico_id: ordemServicoId,
        idempotency_key: idempotencyKey,
      },
    });

    if (error) throw error;

    return {
      success: data?.success === true,
      skipped: data?.skipped === true,
      idempotent: data?.idempotent === true,
      reason: typeof data?.reason === "string" ? data.reason : undefined,
    };
  } catch (error) {
    console.error(`Erro ao disparar notificação automática "${evento}":`, error);
    return {
      success: false,
      skipped: false,
      idempotent: false,
      reason: "provider_error",
    };
  }
}
