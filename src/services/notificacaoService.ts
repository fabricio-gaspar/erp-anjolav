import { supabase } from "@/integrations/supabase/client";

interface NotificacaoDados {
  cliente: string;
  telefone: string;
  numero: string;
  valor?: string;
  previsao?: string;
  totalPecas?: string;
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
 * Limpa o telefone e abre WhatsApp Web com a mensagem
 */
export function enviarWhatsApp(telefone: string, mensagem: string): void {
  // Limpar telefone: remover tudo que não é dígito
  const telLimpo = telefone.replace(/\D/g, "");

  // Adicionar código do país se não tiver
  const telCompleto = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;

  const url = `https://wa.me/${telCompleto}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
}

/**
 * Função principal: verifica config, monta mensagem e dispara WhatsApp
 * Retorna true se a notificação foi disparada, false se não (evento inativo ou sem template)
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

    // Disparar WhatsApp
    enviarWhatsApp(dados.telefone, mensagem);

    return true;
  } catch (error) {
    console.error(`Erro ao disparar notificação "${evento}":`, error);
    return false;
  }
}
