import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export interface Fatura {
  id: string;
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  status: "pendente" | "relatorio_gerado" | "nota_emitida" | "pagamento_configurado" | "enviada" | "faturado" | "pago" | "cancelado";
  status_pagamento: "pendente" | "parcial" | "pago" | "cancelado";
  valor_pago: number;
  versao_financeira: number;
  data_ultimo_pagamento: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  cancelamento_motivo: string | null;
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

export type FormaRecebimentoFatura = "PIX" | "TRANSFERENCIA" | "BOLETO" | "CARTAO" | "DINHEIRO" | "OUTRO";

export interface RegistrarPagamentoFaturaInput {
  id: string;
  valor: number;
  dataPagamento: string;
  formaPagamento: FormaRecebimentoFatura;
  referencia?: string | null;
  observacoes?: string | null;
  versao: number;
  idempotencyKey?: string;
}

export interface CancelarFaturaInput {
  id: string;
  motivo: string;
  versao: number;
  idempotencyKey?: string;
}

export interface PreviaRefaturamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface PreviaRefaturamentoOrigem {
  id: string;
  numero: string;
  data: string;
  status: string;
  valor: number;
  versao: number;
  faturaAtualId: string | null;
  itens: PreviaRefaturamentoItem[];
}

export interface PreviaRefaturamento {
  elegivel: boolean;
  motivosBloqueio: string[];
  fatura: {
    id: string;
    clienteId: string;
    periodoInicio: string;
    periodoFim: string;
    valorOriginal: number;
    motivoCancelamento: string | null;
    substitutaId: string | null;
  };
  origens: PreviaRefaturamentoOrigem[];
  valorAtual: number;
  podeAjustar: boolean;
}

export interface RefaturarFaturaInput {
  id: string;
  motivo: string;
  ajustes: Array<{
    lancamentoId: string;
    valorAjuste: number;
    motivo: string;
  }>;
  idempotencyKey?: string;
}

export interface RefaturarFaturaResult {
  faturaOrigemId: string;
  faturaSubstitutaId: string;
  valorOriginal: number;
  valorSubstituto: number;
  quantidadeOrigens?: number;
  quantidadeAjustes?: number;
  idempotent: boolean;
}

export interface FaturaCommandResult {
  id: string;
  pagamentoId?: string;
  status: Fatura["status"];
  statusPagamento: Fatura["status_pagamento"];
  valor: number;
  valorPago: number;
  saldo: number;
  versao: number;
  idempotent: boolean;
}

export function criarChaveOperacaoFatura(prefixo: string) {
  return `${prefixo}:${crypto.randomUUID()}`;
}

function readFaturaCommandResult(data: unknown): FaturaCommandResult {
  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("A operação da fatura não retornou um resultado válido");
  }
  return data as FaturaCommandResult;
}

function readPreviaRefaturamento(data: unknown): PreviaRefaturamento {
  if (!data || typeof data !== "object" || !("fatura" in data) || !("origens" in data)) {
    throw new Error("A prévia do refaturamento não retornou dados válidos");
  }
  return data as PreviaRefaturamento;
}

function readRefaturarFaturaResult(data: unknown): RefaturarFaturaResult {
  if (!data || typeof data !== "object" || !("faturaSubstitutaId" in data)) {
    throw new Error("O refaturamento não retornou uma fatura substituta válida");
  }
  return data as RefaturarFaturaResult;
}

export function usePreviaRefaturamentoFatura(faturaId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["fatura", "previa-refaturamento", faturaId],
    queryFn: async () => {
      if (!faturaId) return null;
      const { data, error } = await supabase.rpc("obter_previa_refaturamento_industrial", {
        _fatura_id: faturaId,
      });
      if (error) throw error;
      return readPreviaRefaturamento(data);
    },
    enabled: enabled && !!faturaId,
    retry: false,
  });
}

export interface CriarFaturaComLancamentosInput {
  cliente_id: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_total: number;
  tipo_relatorio: string;
  itens_snapshot: Json;
  observacao_fatura?: string | null;
  lancamento_ids: string[];
  idempotency_key: string;
}

export interface CriarFaturaComLancamentosResult {
  id: string;
  status: string;
  valorTotal: number;
  quantidadeLancamentos?: number;
  idempotent: boolean;
}

export function useCreateFaturaComLancamentos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CriarFaturaComLancamentosInput) => {
      const { data, error } = await supabase.rpc("criar_fatura_com_lancamentos", {
        _cliente_id: input.cliente_id,
        _periodo_inicio: input.periodo_inicio,
        _periodo_fim: input.periodo_fim,
        _valor_total: input.valor_total,
        _tipo_relatorio: input.tipo_relatorio,
        _itens_snapshot: input.itens_snapshot,
        _observacao_fatura: input.observacao_fatura ?? null,
        _lancamento_ids: input.lancamento_ids,
        _idempotency_key: input.idempotency_key,
      });
      if (error) throw error;

      const result = data as unknown as CriarFaturaComLancamentosResult;
      if (!result?.id) throw new Error("A criação da fatura não retornou um identificador");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    },
  });
}

export function useFaturas(
  periodoInicio?: string,
  periodoFim?: string,
  enabled = true,
  incluirPeriodosSobrepostos = false,
  clienteId?: string,
) {
  const queryClient = useQueryClient();
  const { activeArea } = useWorkspace();

  const invalidateInvoiceQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["faturas"] }),
      queryClient.invalidateQueries({ queryKey: ["fatura"] }),
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] }),
      queryClient.invalidateQueries({ queryKey: ["ordens-servico"] }),
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] }),
      queryClient.invalidateQueries({ queryKey: ["financeiro-agregado"] }),
      queryClient.invalidateQueries({ queryKey: ["relatorio-financeiro"] }),
    ]);
  };

  const assertFaturaInScope = async (id: string) => {
    if (activeArea === "central") return;
    const { data, error } = await supabase
      .from("faturas")
      .select("id, cliente:clientes!faturas_cliente_id_fkey!inner(classificacao)")
      .eq("id", id)
      .eq("cliente.classificacao", activeArea)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Fatura não encontrada neste painel");
  };

  const { data: faturas = [], isLoading, error } = useQuery({
    queryKey: ["faturas", activeArea, periodoInicio, periodoFim, incluirPeriodosSobrepostos, clienteId],
    queryFn: async () => {
      let query = supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes!faturas_cliente_id_fkey!inner(razao_social, cpf_cnpj, email, telefone, classificacao)
        `)
        .order("created_at", { ascending: false });

      if (incluirPeriodosSobrepostos && periodoInicio && periodoFim) {
        query = query.lte("periodo_inicio", periodoFim).gte("periodo_fim", periodoInicio);
      } else {
        if (periodoInicio) {
          query = query.gte("periodo_inicio", periodoInicio);
        }
        if (periodoFim) {
          query = query.lte("periodo_fim", periodoFim);
        }
      }
      if (activeArea !== "central") {
        query = query.eq("cliente.classificacao", activeArea);
      }
      if (clienteId) {
        query = query.eq("cliente_id", clienteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Fatura[];
    },
    enabled,
  });

  const updateFatura = useMutation({
    mutationFn: async ({ id, ...updates }: FaturaUpdate & { id: string }) => {
      await assertFaturaInScope(id);
      const { data, error } = await supabase
        .from("faturas")
        .update(updates)
        .eq("id", id)
        .select(`
          *,
          cliente:clientes!faturas_cliente_id_fkey!inner(razao_social, cpf_cnpj, email, telefone, classificacao)
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

  const registrarPagamento = useMutation({
    mutationFn: async (input: RegistrarPagamentoFaturaInput) => {
      await assertFaturaInScope(input.id);
      const { data, error } = await supabase.rpc("registrar_pagamento_fatura", {
        _fatura_id: input.id,
        _valor: input.valor,
        _data_pagamento: input.dataPagamento,
        _forma_pagamento: input.formaPagamento,
        _referencia: input.referencia ?? null,
        _observacoes: input.observacoes ?? null,
        _versao_esperada: input.versao,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoFatura("invoice-payment"),
      });
      if (error) throw error;
      return readFaturaCommandResult(data);
    },
    onSuccess: async (result) => {
      await invalidateInvoiceQueries();
      toast.success(result.statusPagamento === "pago"
        ? "Fatura quitada com rastreabilidade"
        : "Recebimento parcial registrado");
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Erro ao registrar recebimento");
    },
  });

  const cancelarFatura = useMutation({
    mutationFn: async (input: CancelarFaturaInput) => {
      await assertFaturaInScope(input.id);
      const { data, error } = await supabase.rpc("cancelar_fatura", {
        _fatura_id: input.id,
        _motivo: input.motivo,
        _versao_esperada: input.versao,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoFatura("invoice-cancel"),
      });
      if (error) throw error;
      return readFaturaCommandResult(data);
    },
    onSuccess: async () => {
      await invalidateInvoiceQueries();
      toast.success("Fatura cancelada e origens liberadas para revisão");
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Erro ao cancelar fatura");
    },
  });

  const refaturarFatura = useMutation({
    mutationFn: async (input: RefaturarFaturaInput) => {
      await assertFaturaInScope(input.id);
      const { data, error } = await supabase.rpc("refaturar_fatura_industrial", {
        _fatura_cancelada_id: input.id,
        _motivo: input.motivo,
        _ajustes: input.ajustes as unknown as Json,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoFatura("invoice-rebill"),
      });
      if (error) throw error;
      return readRefaturarFaturaResult(data);
    },
    onSuccess: async (result) => {
      await invalidateInvoiceQueries();
      queryClient.invalidateQueries({ queryKey: ["fatura", "previa-refaturamento"] });
      queryClient.invalidateQueries({ queryKey: ["demonstrativo-industrial"] });
      toast.success(
        result.quantidadeAjustes
          ? "Fatura substituta criada com ajuste auditável"
          : "Fatura substituta criada com rastreabilidade",
      );
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message || "Erro ao refaturar");
    },
  });

  // Summary calculations
  const summary = {
    totalPrevisto: faturas.reduce((sum, f) => sum + Number(f.valor_total), 0),
    pendente: faturas
      .filter((f) => f.status_pagamento !== "pago" && f.status_pagamento !== "cancelado")
      .reduce((sum, f) => sum + Math.max(Number(f.valor_total) - Number(f.valor_pago || 0), 0), 0),
    notaEmitida: faturas
      .filter((f) => f.status === "nota_emitida")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    pago: faturas.reduce((sum, f) => sum + Number(f.valor_pago || 0), 0),
    enviado: faturas
      .filter((f) => f.status === "enviada")
      .reduce((sum, f) => sum + Number(f.valor_total), 0),
    totalClientes: new Set(faturas.map((f) => f.cliente_id)).size,
  };

  return {
    faturas,
    summary,
    isLoading,
    error,
    updateFatura,
    registrarPagamento,
    cancelarFatura,
    refaturarFatura,
  };
}

export function useFaturaById(faturaId: string | null) {
  const { activeArea } = useWorkspace();
  return useQuery({
    queryKey: ["fatura", faturaId, activeArea],
    queryFn: async () => {
      if (!faturaId) return null;
      let query = supabase
        .from("faturas")
        .select(`
          *,
          cliente:clientes!faturas_cliente_id_fkey!inner(razao_social, cpf_cnpj, email, telefone, classificacao)
        `)
        .eq("id", faturaId);
      if (activeArea !== "central") query = query.eq("cliente.classificacao", activeArea);
      const { data, error } = await query.maybeSingle();
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
