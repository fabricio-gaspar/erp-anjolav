import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export interface Fatura {
  id: string;
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status: "pendente" | "nota_emitida" | "pago" | "enviado";
  numero_nf: string | null;
  asaas_charge_id: string | null;
  created_at: string;
  updated_at: string;
  // Etapa 1 - Relatório
  relatorio_gerado: boolean;
  relatorio_data: string | null;
  tipo_relatorio: string | null;
  itens_snapshot: Json | null;
  observacao_fatura: string | null;
  // Etapa 2 - Nota Fiscal
  chave_acesso: string | null;
  link_pdf_nf: string | null;
  data_emissao_nf: string | null;
  snapshot_cliente: Json | null;
  snapshot_emitente: Json | null;
  descricao_servico: string | null;
  imposto_calculado: Json | null;
  // Campos NFS-e real
  protocolo_nfse: string | null;
  xml_nfse: string | null;
  status_sefaz: string | null;
  erros_sefaz: Json | null;
  natureza_operacao: string | null;
  // Etapa 3 - Pagamento
  forma_pagamento: string | null;
  data_vencimento: string | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  dados_transferencia: Json | null;
  vencimento_ajustado_por: string | null;
  // Etapa 4 - Envio
  data_envio: string | null;
  canais_envio: string[] | null;
  destinatario_envio: string | null;
  mensagem_enviada: string | null;
  // Join fields
  cliente?: {
    razao_social: string;
    cpf_cnpj: string | null;
    email: string | null;
    telefone: string | null;
    classificacao: string;
  };
}

export interface FaturaInsert {
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status?: string;
  numero_nf?: string | null;
  asaas_charge_id?: string | null;
  // Etapa 1
  relatorio_gerado?: boolean;
  relatorio_data?: string | null;
  tipo_relatorio?: string | null;
  itens_snapshot?: Json | null;
  observacao_fatura?: string | null;
  // Etapa 2
  chave_acesso?: string | null;
  link_pdf_nf?: string | null;
  data_emissao_nf?: string | null;
  snapshot_cliente?: Json | null;
  snapshot_emitente?: Json | null;
  descricao_servico?: string | null;
  imposto_calculado?: Json | null;
  // Campos NFS-e real
  protocolo_nfse?: string | null;
  xml_nfse?: string | null;
  status_sefaz?: string | null;
  erros_sefaz?: Json | null;
  natureza_operacao?: string | null;
  // Etapa 3
  forma_pagamento?: string | null;
  data_vencimento?: string | null;
  boleto_url?: string | null;
  boleto_linha_digitavel?: string | null;
  pix_qr_code?: string | null;
  pix_copia_cola?: string | null;
  dados_transferencia?: Json | null;
  vencimento_ajustado_por?: string | null;
  // Etapa 4
  data_envio?: string | null;
  canais_envio?: string[] | null;
  destinatario_envio?: string | null;
  mensagem_enviada?: string | null;
}

export interface FaturaUpdate {
  status?: string;
  numero_nf?: string | null;
  asaas_charge_id?: string | null;
  valor_total?: number;
  // Etapa 1
  relatorio_gerado?: boolean;
  relatorio_data?: string | null;
  tipo_relatorio?: string | null;
  itens_snapshot?: Json | null;
  observacao_fatura?: string | null;
  // Etapa 2
  chave_acesso?: string | null;
  link_pdf_nf?: string | null;
  data_emissao_nf?: string | null;
  snapshot_cliente?: Json | null;
  snapshot_emitente?: Json | null;
  descricao_servico?: string | null;
  imposto_calculado?: Json | null;
  // Campos NFS-e real
  protocolo_nfse?: string | null;
  xml_nfse?: string | null;
  status_sefaz?: string | null;
  erros_sefaz?: Json | null;
  natureza_operacao?: string | null;
  // Etapa 3
  forma_pagamento?: string | null;
  data_vencimento?: string | null;
  boleto_url?: string | null;
  boleto_linha_digitavel?: string | null;
  pix_qr_code?: string | null;
  pix_copia_cola?: string | null;
  dados_transferencia?: Json | null;
  vencimento_ajustado_por?: string | null;
  // Etapa 4
  data_envio?: string | null;
  canais_envio?: string[] | null;
  destinatario_envio?: string | null;
  mensagem_enviada?: string | null;
}

export function useFaturas(periodoInicio?: string, periodoFim?: string) {
  const queryClient = useQueryClient();

  const { data: faturas = [], isLoading, error } = useQuery({
    queryKey: ["faturas", periodoInicio, periodoFim],
    queryFn: async () => {
      let query = supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone, classificacao)
        `)
        .order("created_at", { ascending: false });

      if (periodoInicio) {
        query = query.gte("periodo_inicio", periodoInicio);
      }
      if (periodoFim) {
        query = query.lte("periodo_fim", periodoFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Fatura[];
    },
  });

  const createFatura = useMutation({
    mutationFn: async (fatura: FaturaInsert) => {
      const { data, error } = await supabase
        .from("faturas")
        .insert(fatura)
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone, classificacao)
        `)
        .single();
      if (error) throw error;
      return data as Fatura;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura criada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar fatura: " + error.message);
    },
  });

  const updateFatura = useMutation({
    mutationFn: async ({ id, ...updates }: FaturaUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("faturas")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone, classificacao)
        `)
        .single();
      if (error) throw error;
      return data as Fatura;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura atualizada!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar fatura: " + error.message);
    },
  });

  const deleteFatura = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("faturas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      toast.success("Fatura excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir fatura: " + error.message);
    },
  });

  // Summary calculations
  const summary = {
    totalPrevisto: faturas.reduce((sum, f) => sum + Number(f.valor_total), 0),
    pendente: faturas
      .filter((f) => f.status === "pendente")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    notaEmitida: faturas
      .filter((f) => f.status === "nota_emitida")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    pago: faturas
      .filter((f) => f.status === "pago")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    enviado: faturas
      .filter((f) => f.status === "enviado")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    totalClientes: new Set(faturas.map((f) => f.cliente_id)).size,
  };

  return {
    faturas,
    summary,
    isLoading,
    error,
    createFatura,
    updateFatura,
    deleteFatura,
  };
}

export function useFaturaById(faturaId: string | null) {
  return useQuery({
    queryKey: ["fatura", faturaId],
    queryFn: async () => {
      if (!faturaId) return null;
      const { data, error } = await supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes(razao_social, cpf_cnpj, email, telefone)
        `)
        .eq("id", faturaId)
        .maybeSingle();
      if (error) throw error;
      return data as Fatura | null;
    },
    enabled: !!faturaId,
  });
}

// Hook para verificar se lançamentos já estão vinculados a outra fatura
export function useValidateLancamentosForFatura() {
  return useMutation({
    mutationFn: async (lancamentoIds: string[]) => {
      const { data, error } = await supabase
        .from("lancamentos_fatura")
        .select("lancamento_id, fatura_id")
        .in("lancamento_id", lancamentoIds);

      if (error) throw error;

      const jaVinculados = data || [];
      if (jaVinculados.length > 0) {
        return {
          valid: false,
          message: `${jaVinculados.length} lançamento(s) já estão vinculados a outra fatura.`,
          conflitos: jaVinculados,
        };
      }

      return { valid: true, message: "", conflitos: [] };
    },
  });
}

// Mapear condição de pagamento para dias de prazo
export function condicaoParaDias(condicao: string | null): number {
  switch (condicao) {
    case "a_vista": return 0;
    case "5_dias": return 5;
    case "7_dias": return 7;
    case "10_dias": return 10;
    case "15_dias": return 15;
    case "20_dias": return 20;
    case "30_dias": return 30;
    // Valores antigos (compatibilidade)
    case "semanal": return 7;
    case "mensal_15": return 15;
    case "mensal_30": return 30;
    default: return 30;
  }
}

// Hook para calcular vencimento inteligente
// Agora aceita dia_fechamento + condicao_pagamento OU um dia fixo (compatibilidade)
export function calcularVencimento(
  diaFechamentoOuVencimento: number | null,
  condicaoPagamento?: string | null
): Date {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Novo cálculo: dia_fechamento + prazo em dias
  if (condicaoPagamento !== undefined) {
    const prazoDias = condicaoParaDias(condicaoPagamento);

    // Avulso (dia_fechamento = null): usar data atual como base
    if (diaFechamentoOuVencimento === null) {
      const vencimento = new Date(hoje);
      vencimento.setDate(vencimento.getDate() + prazoDias);
      return vencimento;
    }

    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // Data do próximo fechamento
    let dataFechamento = new Date(anoAtual, mesAtual, diaFechamentoOuVencimento);
    dataFechamento.setHours(0, 0, 0, 0);

    // Se o dia de fechamento já passou neste mês, usar próximo mês
    if (dataFechamento <= hoje) {
      dataFechamento = new Date(anoAtual, mesAtual + 1, diaFechamentoOuVencimento);
      dataFechamento.setHours(0, 0, 0, 0);
    }

    // Adicionar prazo em dias
    const vencimento = new Date(dataFechamento);
    vencimento.setDate(vencimento.getDate() + prazoDias);
    return vencimento;
  }

  // Fallback: comportamento antigo com dia fixo de vencimento
  const dia = diaFechamentoOuVencimento ?? 1;
  let vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
  if (vencimento <= hoje) {
    vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
  }
  return vencimento;
}
