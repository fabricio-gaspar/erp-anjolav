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
 * Limpa o telefone e abre WhatsApp Web com a mensagem (modo wa.me)
 */
export function enviarWhatsApp(telefone: string, mensagem: string): void {
  const telLimpo = telefone.replace(/\D/g, "");
  const telCompleto = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;
  const url = `https://wa.me/${telCompleto}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

/**
 * Verifica se a Evolution API está conectada
 */
async function getEvolutionStatus(): Promise<{ conectado: boolean }> {
  try {
    const { data } = await supabase
      .from("whatsapp_instancias")
      .select("status")
      .limit(1)
      .maybeSingle();
    return { conectado: data?.status === "conectado" };
  } catch {
    return { conectado: false };
  }
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
 * Registra mensagem enviada via wa.me no log
 */
async function registrarLogWaMe(
  telefone: string,
  mensagem: string,
  evento: string,
  ordem_servico_id?: string,
  cliente_id?: string
) {
  try {
    await supabase.from("mensagens_log").insert({
      telefone: telefone.replace(/\D/g, ""),
      mensagem,
      evento,
      status: "enviado",
      canal: "wa.me",
      ordem_servico_id: ordem_servico_id || null,
      cliente_id: cliente_id || null,
    });
  } catch (e) {
    console.error("Erro ao registrar log:", e);
  }
}

/**
 * Função principal: verifica config, monta mensagem e dispara WhatsApp
 * Usa Evolution API se conectada, senão fallback para wa.me
 * Retorna true se a notificação foi disparada
 */
export async function dispararNotificacao(
  evento: string,
  dados: NotificacaoDados
): Promise<boolean> {
  try {
    // Verificar se o evento está ativo
    const config = await getNotificacaoTemplate(evento);

    if (!config) {
      console.log(`Notificação "${evento}" não está ativa ou não encontrada.`);
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

    // Tentar enviar via Evolution API primeiro
    const { conectado } = await getEvolutionStatus();

    if (conectado) {
      const enviado = await enviarViaEvolution(
        dados.telefone,
        mensagem,
        dados.ordem_servico_id,
        dados.cliente_id,
        evento
      );
      if (enviado) return true;
      // Fallback para wa.me se Evolution falhar
    }

    // Fallback: abrir wa.me manualmente
    enviarWhatsApp(dados.telefone, mensagem);
    await registrarLogWaMe(dados.telefone, mensagem, evento, dados.ordem_servico_id, dados.cliente_id);

    return true;
  } catch (error) {
    console.error(`Erro ao disparar notificação "${evento}":`, error);
    return false;
  }
}
