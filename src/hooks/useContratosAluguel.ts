import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export type PeriodicidadeContrato = "avulso" | "mensal" | "quinzenal";
export type FormaPagamentoContrato =
  | "dinheiro"
  | "pix"
  | "cartao_credito"
  | "cartao_debito"
  | "boleto"
  | "transferencia";

export interface ContratoAluguel {
  id: string;
  cliente_id: string;
  descricao: string;
  valor_servico: number;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  versao: number;
  periodicidade_fechamento: PeriodicidadeContrato;
  dia_fechamento: number | null;
  dia_vencimento: number;
  forma_pagamento: FormaPagamentoContrato | null;
  autoriza_faturamento: boolean;
  regras_comerciais: string | null;
  encerrado_em: string | null;
  encerrado_por: string | null;
  encerramento_motivo: string | null;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemContratoAluguel {
  id: string;
  contrato_id: string;
  produto_id: string | null;
  descricao_item: string | null;
  quantidade: number;
  valor_unitario: number;
  unidade: string;
  created_at: string;
  updated_at: string;
  produto?: {
    id: string;
    nome: string;
    preco: number;
    unidade: string | null;
  } | null;
}

export interface ContratoItemDraft {
  produtoId: string;
  quantidade: number;
  valorUnitario: number;
}

export interface SalvarContratoIndustrialInput {
  id?: string | null;
  clienteId: string;
  descricao: string;
  valorServico: number;
  dataInicio: string;
  dataFim?: string | null;
  periodicidade: PeriodicidadeContrato;
  diaFechamento?: number | null;
  diaVencimento: number;
  formaPagamento?: FormaPagamentoContrato | null;
  autorizaFaturamento: boolean;
  regrasComerciais?: string | null;
  observacoes?: string | null;
  itens: ContratoItemDraft[];
  versao?: number | null;
  idempotencyKey?: string;
}

export interface EncerrarContratoIndustrialInput {
  id: string;
  motivo: string;
  versao: number;
  idempotencyKey?: string;
}

export interface ContratoCommandResult {
  id: string;
  clienteId: string;
  ativo: boolean;
  versao: number;
  valorFixo?: number;
  valorServicos?: number;
  valorReferencia?: number;
  quantidadeServicos?: number;
  autorizaFaturamento?: boolean;
  encerradoEm?: string;
  motivo?: string;
  idempotent: boolean;
}

export interface ContratoOperacao {
  id: string;
  contrato_id: string;
  tipo: "CRIAR" | "ATUALIZAR" | "ENCERRAR" | "MIGRACAO";
  versao_anterior: number | null;
  versao_nova: number;
  dados: unknown;
  resultado: unknown;
  criado_por: string | null;
  created_at: string;
}

export function criarChaveOperacaoContrato(prefixo: string) {
  return `${prefixo}:${crypto.randomUUID()}`;
}

function readContratoCommandResult(data: unknown): ContratoCommandResult {
  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("A operação do contrato não retornou um resultado válido");
  }
  return data as ContratoCommandResult;
}

export function useContratoCliente(clienteId: string | null) {
  return useQuery({
    queryKey: ["contrato-cliente", clienteId],
    queryFn: async () => {
      if (!clienteId) return null;
      const { data, error } = await supabase
        .from("contratos_aluguel")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("ativo", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ContratoAluguel | null;
    },
    enabled: !!clienteId,
  });
}

export function useContratosAtivos() {
  return useQuery({
    queryKey: ["contratos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos_aluguel")
        .select(`
          *,
          clientes:cliente_id (
            id,
            razao_social,
            nome_fantasia
          )
        `)
        .eq("ativo", true)
        .order("data_fim", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as (ContratoAluguel & {
        clientes: { id: string; razao_social: string; nome_fantasia: string | null } | null;
      })[];
    },
  });
}

export function useItensContrato(contratoId: string | null) {
  return useQuery({
    queryKey: ["itens-contrato", contratoId],
    queryFn: async () => {
      if (!contratoId) return [];
      const { data, error } = await supabase
        .from("itens_contrato_aluguel")
        .select(`
          *,
          produto:produto_id (
            id,
            nome,
            preco,
            unidade
          )
        `)
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ItemContratoAluguel[];
    },
    enabled: !!contratoId,
  });
}

export function useContratoOperacoes(contratoId: string | null) {
  return useQuery({
    queryKey: ["contrato-operacoes", contratoId],
    queryFn: async () => {
      if (!contratoId) return [];
      const { data, error } = await supabase
        .from("contrato_operacoes")
        .select("id, contrato_id, tipo, versao_anterior, versao_nova, dados, resultado, criado_por, created_at")
        .eq("contrato_id", contratoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ContratoOperacao[];
    },
    enabled: !!contratoId,
  });
}

export function useContratosAluguel() {
  const queryClient = useQueryClient();

  const invalidateContractQueries = async (clienteId?: string, contratoId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contrato-cliente", clienteId] }),
      queryClient.invalidateQueries({ queryKey: ["itens-contrato", contratoId] }),
      queryClient.invalidateQueries({ queryKey: ["contrato-operacoes", contratoId] }),
      queryClient.invalidateQueries({ queryKey: ["contratos-ativos"] }),
      queryClient.invalidateQueries({ queryKey: ["configuracao_pagamento_cliente", clienteId] }),
      queryClient.invalidateQueries({ queryKey: ["fechamentos_proximos"] }),
      queryClient.invalidateQueries({ queryKey: ["contas_receber"] }),
      queryClient.invalidateQueries({ queryKey: ["financeiro-agregado"] }),
      queryClient.invalidateQueries({ queryKey: ["client-profile"] }),
    ]);
  };

  const saveContrato = useMutation({
    mutationFn: async (input: SalvarContratoIndustrialInput) => {
      const { data, error } = await supabase.rpc("salvar_contrato_industrial", {
        _contrato_id: input.id ?? null,
        _cliente_id: input.clienteId,
        _descricao: input.descricao,
        _valor_servico: input.valorServico,
        _data_inicio: input.dataInicio,
        _data_fim: input.dataFim ?? null,
        _periodicidade_fechamento: input.periodicidade,
        _dia_fechamento: input.periodicidade === "avulso" ? null : input.diaFechamento ?? null,
        _dia_vencimento: input.diaVencimento,
        _forma_pagamento: input.formaPagamento ?? null,
        _autoriza_faturamento: input.autorizaFaturamento,
        _regras_comerciais: input.regrasComerciais ?? null,
        _observacoes: input.observacoes ?? null,
        _itens: input.itens as unknown as Json,
        _versao_esperada: input.id ? input.versao ?? null : null,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoContrato(input.id ? "contract-update" : "contract-create"),
      });
      if (error) throw error;
      return readContratoCommandResult(data);
    },
    onSuccess: async (result) => {
      await invalidateContractQueries(result.clienteId, result.id);
      toast.success(result.versao === 0 ? "Contrato industrial criado" : "Contrato industrial atualizado");
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao salvar contrato industrial"),
  });

  const endContrato = useMutation({
    mutationFn: async (input: EncerrarContratoIndustrialInput) => {
      const { data, error } = await supabase.rpc("encerrar_contrato_industrial", {
        _contrato_id: input.id,
        _motivo: input.motivo,
        _versao_esperada: input.versao,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoContrato("contract-end"),
      });
      if (error) throw error;
      return readContratoCommandResult(data);
    },
    onSuccess: async (result) => {
      await invalidateContractQueries(result.clienteId, result.id);
      toast.success("Contrato encerrado com histórico preservado");
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao encerrar contrato"),
  });

  return { saveContrato, endContrato };
}

export function useCalculoContrato(
  contrato: ContratoAluguel | null,
  itens: Pick<ItemContratoAluguel, "quantidade" | "valor_unitario">[],
) {
  const valorServico = Number(contrato?.valor_servico || 0);
  const valorItens = itens.reduce(
    (total, item) => total + Number(item.quantidade) * Number(item.valor_unitario),
    0,
  );
  const quantidadeReferencia = itens.reduce(
    (total, item) => total + Number(item.quantidade),
    0,
  );

  return {
    valorServico,
    valorItens,
    quantidadeReferencia,
    totalMensal: valorServico + valorItens,
  };
}
