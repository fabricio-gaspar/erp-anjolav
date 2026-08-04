// Utilitários para o fluxo de faturamento

import type { Json } from "@/integrations/supabase/types";
import type { DadosFaturamento } from "@/components/faturamento/FaturamentoModal";

// Templates de mensagem com variáveis
export interface TemplateVariables {
  cliente: string;
  valor: string;
  vencimento: string;
  link_nota?: string;
  link_boleto?: string;
  numero_nf?: string;
  periodo?: string;
  link_portal?: string;
  codigo_portal?: string;
}

// Template padrão para WhatsApp
export const TEMPLATE_WHATSAPP_DEFAULT = `Olá {{cliente}}!

Segue o resumo do seu faturamento:

💰 Valor Total: {{valor}}
📅 Vencimento: {{vencimento}}
{{#numero_nf}}📋 Nota Fiscal: {{numero_nf}}{{/numero_nf}}
{{#link_boleto}}🔗 Boleto: {{link_boleto}}{{/link_boleto}}

Obrigado pela preferência!`;

// Template padrão para E-mail
export const TEMPLATE_EMAIL_DEFAULT = `Prezado(a) {{cliente}},

Segue o resumo do seu faturamento referente ao período {{periodo}}:

Valor Total: {{valor}}
Vencimento: {{vencimento}}
{{#numero_nf}}Nota Fiscal: {{numero_nf}}{{/numero_nf}}

{{#link_boleto}}Para acessar o boleto, clique no link: {{link_boleto}}{{/link_boleto}}

Atenciosamente,
Equipe`;

// Substitui variáveis no template
export function substituirVariaveis(template: string, vars: TemplateVariables): string {
  let resultado = template;
  
  // Substituições simples
  resultado = resultado.replace(/\{\{cliente\}\}/g, vars.cliente);
  resultado = resultado.replace(/\{\{valor\}\}/g, vars.valor);
  resultado = resultado.replace(/\{\{vencimento\}\}/g, vars.vencimento);
  resultado = resultado.replace(/\{\{periodo\}\}/g, vars.periodo || "");
  resultado = resultado.replace(/\{\{link_portal\}\}/g, vars.link_portal || "");
  resultado = resultado.replace(/\{\{codigo_portal\}\}/g, vars.codigo_portal || "");
  
  // Substituições condicionais
  if (vars.numero_nf) {
    resultado = resultado.replace(/\{\{#numero_nf\}\}(.*?)\{\{\/numero_nf\}\}/gs, `$1`);
    resultado = resultado.replace(/\{\{numero_nf\}\}/g, vars.numero_nf);
  } else {
    resultado = resultado.replace(/\{\{#numero_nf\}\}.*?\{\{\/numero_nf\}\}/gs, "");
  }
  
  if (vars.link_nota) {
    resultado = resultado.replace(/\{\{#link_nota\}\}(.*?)\{\{\/link_nota\}\}/gs, `$1`);
    resultado = resultado.replace(/\{\{link_nota\}\}/g, vars.link_nota);
  } else {
    resultado = resultado.replace(/\{\{#link_nota\}\}.*?\{\{\/link_nota\}\}/gs, "");
  }
  
  if (vars.link_boleto) {
    resultado = resultado.replace(/\{\{#link_boleto\}\}(.*?)\{\{\/link_boleto\}\}/gs, `$1`);
    resultado = resultado.replace(/\{\{link_boleto\}\}/g, vars.link_boleto);
  } else {
    resultado = resultado.replace(/\{\{#link_boleto\}\}.*?\{\{\/link_boleto\}\}/gs, "");
  }
  
  // Substituições condicionais para portal
  if (vars.link_portal) {
    resultado = resultado.replace(/\{\{#link_portal\}\}(.*?)\{\{\/link_portal\}\}/gs, `$1`);
  } else {
    resultado = resultado.replace(/\{\{#link_portal\}\}.*?\{\{\/link_portal\}\}/gs, "");
  }
  
  if (vars.codigo_portal) {
    resultado = resultado.replace(/\{\{#codigo_portal\}\}(.*?)\{\{\/codigo_portal\}\}/gs, `$1`);
  } else {
    resultado = resultado.replace(/\{\{#codigo_portal\}\}.*?\{\{\/codigo_portal\}\}/gs, "");
  }
  
  // Remove linhas vazias extras
  resultado = resultado.replace(/\n\s*\n\s*\n/g, "\n\n");
  
  return resultado.trim();
}

// Formata valor como moeda
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

// Formata data para exibição
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
}

// Gera snapshot do cliente para a fatura
export function gerarSnapshotCliente(cliente: {
  razao_social: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  inscricao_municipal?: string | null;
}, endereco?: {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
} | null): Json {
  return {
    razao_social: cliente.razao_social,
    cpf_cnpj: cliente.cpf_cnpj,
    email: cliente.email,
    telefone: cliente.telefone,
    inscricao_municipal: cliente.inscricao_municipal ?? null,
    endereco: endereco ? {
      logradouro: endereco.logradouro,
      numero: endereco.numero,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      uf: endereco.uf,
      cep: endereco.cep,
    } : null,
    data_snapshot: new Date().toISOString(),
  };
}

// Gera snapshot do emitente para a fatura
export function gerarSnapshotEmitente(config: {
  razao_social: string | null;
  cnpj: string | null;
  inscricao_municipal: string | null;
  inscricao_estadual: string | null;
  endereco: Record<string, string> | null;
  codigo_servico: string | null;
  aliquota_iss: number | null;
}): Json {
  return {
    razao_social: config.razao_social,
    cnpj: config.cnpj,
    inscricao_municipal: config.inscricao_municipal,
    inscricao_estadual: config.inscricao_estadual,
    endereco: config.endereco as Json,
    codigo_servico: config.codigo_servico,
    aliquota_iss: config.aliquota_iss,
    data_snapshot: new Date().toISOString(),
  };
}

// Gera chave de acesso simulada (44 dígitos)
export function gerarChaveAcesso(): string {
  const uf = "35"; // SP
  const anoMes = new Date().toISOString().slice(2, 4) + new Date().toISOString().slice(5, 7);
  const cnpj = "00000000000000";
  const mod = "55"; // NF-e
  const serie = "001";
  const numero = Math.floor(Math.random() * 1000000000).toString().padStart(9, "0");
  const tipoEmissao = "1";
  const codigoNumerico = Math.floor(Math.random() * 100000000).toString().padStart(8, "0");
  
  const semDV = uf + anoMes + cnpj + mod + serie + numero + tipoEmissao + codigoNumerico;
  
  // DV simplificado (em produção seria calculado corretamente)
  const dv = "0";
  
  return semDV + dv;
}

// Valida dados fiscais do cliente
export function validarDadosFiscaisCliente(cliente: {
  cpf_cnpj: string | null;
}, endereco?: {
  logradouro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
} | null): { valid: boolean; erros: string[] } {
  const erros: string[] = [];
  
  if (!cliente.cpf_cnpj) {
    erros.push("CPF/CNPJ não informado");
  }
  
  if (!endereco?.logradouro) {
    erros.push("Endereço não informado");
  }
  
  if (!endereco?.cidade) {
    erros.push("Cidade não informada");
  }
  
  if (!endereco?.uf) {
    erros.push("UF não informada");
  }
  
  if (!endereco?.cep) {
    erros.push("CEP não informado");
  }
  
  return {
    valid: erros.length === 0,
    erros,
  };
}

// Gera snapshot dos itens faturados
export function gerarSnapshotItens(dados: DadosFaturamento): Json {
  return dados.itens.map((item) => ({
    id: item.id,
    produto: item.produto,
    quantidade: item.quantidade,
    unidade: item.unidade,
    valor_unitario: item.valorUnitario,
    valor_total: item.valorTotal,
    data_snapshot: new Date().toISOString(),
  })) as Json;
}
