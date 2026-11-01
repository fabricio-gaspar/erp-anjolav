import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type StatusConta = "pendente" | "parcial" | "pago" | "cancelado";

export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedor: string | null;
  fornecedor_id: string | null;
  valor: number;
  valor_pago: number;
  vencimento: string;
  data_pagamento: string | null;
  status: StatusConta;
  categoria: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
  observacoes: string | null;
  versao: number;
  criado_por: string | null;
  atualizado_por: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  cancelamento_motivo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContaPagarInsert {
  descricao: string;
  fornecedor?: string | null;
  fornecedor_id?: string | null;
  valor: number;
  vencimento: string;
  categoria?: string | null;
  categoria_id?: string | null;
  centro_custo_id?: string | null;
  observacoes?: string | null;
  idempotencyKey?: string;
}

export interface ContaPagarUpdate extends ContaPagarInsert {
  id: string;
  versao: number;
}

export interface RegistrarPagamentoContaInput {
  id: string;
  valor: number;
  dataPagamento: string;
  formaPagamento: "PIX" | "TRANSFERENCIA" | "BOLETO" | "CARTAO" | "DINHEIRO" | "OUTRO";
  referencia?: string | null;
  observacoes?: string | null;
  versao: number;
  idempotencyKey?: string;
}

export interface CancelarContaInput {
  id: string;
  motivo: string;
  versao: number;
  idempotencyKey?: string;
}

export interface ContaPagarCommandResult {
  id: string;
  status: StatusConta;
  valor: number;
  valorPago: number;
  saldo: number;
  versao: number;
  pagamentoId?: string;
  idempotent: boolean;
}

export function criarChaveOperacaoFinanceira(prefixo: string) {
  return `${prefixo}:${crypto.randomUUID()}`;
}

function readCommandResult(data: unknown): ContaPagarCommandResult {
  if (!data || typeof data !== "object" || !("id" in data)) {
    throw new Error("A operação financeira não retornou um resultado válido");
  }
  return data as ContaPagarCommandResult;
}

export function useContasPagar(enabled = true) {
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading, error, refetch } = useQuery({
    queryKey: ["contas_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_pagar")
        .select("*")
        .order("vencimento");
      if (error) throw error;
      return (data || []) as unknown as ContaPagar[];
    },
    enabled,
  });

  const invalidateFinancialQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contas_pagar"] }),
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-directory"] }),
      queryClient.invalidateQueries({ queryKey: ["fluxo_caixa"] }),
      queryClient.invalidateQueries({ queryKey: ["financeiro-agregado"] }),
      queryClient.invalidateQueries({ queryKey: ["relatorio-financeiro"] }),
    ]);
  };

  const saveAccount = async (account: ContaPagarInsert | ContaPagarUpdate) => {
    const isUpdate = "id" in account;
    const { data, error } = await supabase.rpc("salvar_conta_pagar", {
      _conta_id: isUpdate ? account.id : null,
      _descricao: account.descricao,
      _fornecedor: account.fornecedor ?? null,
      _fornecedor_id: account.fornecedor_id ?? null,
      _valor: account.valor,
      _vencimento: account.vencimento,
      _categoria: account.categoria ?? null,
      _categoria_id: account.categoria_id ?? null,
      _centro_custo_id: account.centro_custo_id ?? null,
      _observacoes: account.observacoes ?? null,
      _versao_esperada: isUpdate ? account.versao : null,
      _idempotency_key: account.idempotencyKey
        ?? criarChaveOperacaoFinanceira(isUpdate ? "payable-update" : "payable-create"),
    });
    if (error) throw error;
    return readCommandResult(data);
  };

  const createConta = useMutation({
    mutationFn: (conta: ContaPagarInsert) => saveAccount(conta),
    onSuccess: async () => {
      await invalidateFinancialQueries();
      toast.success("Despesa criada com sucesso");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Erro ao criar despesa"),
  });

  const updateConta = useMutation({
    mutationFn: (conta: ContaPagarUpdate) => saveAccount(conta),
    onSuccess: async () => {
      await invalidateFinancialQueries();
      toast.success("Despesa atualizada com sucesso");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Erro ao atualizar despesa"),
  });

  const registrarPagamento = useMutation({
    mutationFn: async (input: RegistrarPagamentoContaInput) => {
      const { data, error } = await supabase.rpc("registrar_pagamento_conta_pagar", {
        _conta_id: input.id,
        _valor: input.valor,
        _data_pagamento: input.dataPagamento,
        _forma_pagamento: input.formaPagamento,
        _referencia: input.referencia ?? null,
        _observacoes: input.observacoes ?? null,
        _versao_esperada: input.versao,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoFinanceira("payable-payment"),
      });
      if (error) throw error;
      return readCommandResult(data);
    },
    onSuccess: async (result) => {
      await invalidateFinancialQueries();
      toast.success(result.status === "pago" ? "Despesa quitada" : "Pagamento parcial registrado");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Erro ao registrar pagamento"),
  });

  const cancelarConta = useMutation({
    mutationFn: async (input: CancelarContaInput) => {
      const { data, error } = await supabase.rpc("cancelar_conta_pagar", {
        _conta_id: input.id,
        _motivo: input.motivo,
        _versao_esperada: input.versao,
        _idempotency_key: input.idempotencyKey
          ?? criarChaveOperacaoFinanceira("payable-cancel"),
      });
      if (error) throw error;
      return readCommandResult(data);
    },
    onSuccess: async () => {
      await invalidateFinancialQueries();
      toast.success("Despesa cancelada com histórico preservado");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Erro ao cancelar despesa"),
  });

  const hoje = new Date().toISOString().split("T")[0];
  const isAtrasado = (account: ContaPagar) => (
    (account.status === "pendente" || account.status === "parcial")
    && account.vencimento < hoje
  );

  const totalPendente = contas
    .filter((account) => (
      (account.status === "pendente" || account.status === "parcial")
      && !isAtrasado(account)
    ))
    .reduce((total, account) => total + Number(account.valor) - Number(account.valor_pago || 0), 0);

  const totalPago = contas
    .reduce((total, account) => total + Number(account.valor_pago || 0), 0);

  const totalVencido = contas
    .filter(isAtrasado)
    .reduce((total, account) => total + Number(account.valor) - Number(account.valor_pago || 0), 0);

  return {
    contas,
    isLoading,
    error,
    refetch,
    createConta,
    updateConta,
    registrarPagamento,
    cancelarConta,
    totalPendente,
    totalPago,
    totalVencido,
    isAtrasado,
  };
}
