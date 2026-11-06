import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createIdempotencyKey } from "@/lib/idempotency";
import { toast } from "sonner";

// As tabelas deste pacote nasceram depois do snapshot de tipos legado. O banco
// continua sendo a fonte de verdade e as respostas são normalizadas abaixo.
interface LooseDbResult {
  data: unknown[] | Record<string, unknown> | null;
  error: { message?: string } | null;
}

interface LooseQueryBuilder extends PromiseLike<LooseDbResult> {
  select(columns?: string): LooseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): LooseQueryBuilder;
  eq(column: string, value: unknown): LooseQueryBuilder;
}

interface PurchasingDbClient {
  from(table: string): LooseQueryBuilder;
  rpc(name: string, args: Record<string, unknown>): Promise<LooseDbResult>;
}

const purchasingDb = supabase as unknown as PurchasingDbClient;

export type PedidoCompraStatus = "rascunho" | "aprovado" | "parcial" | "recebido" | "cancelado";

export interface EstoqueLocal {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  versao: number;
}

export interface EstoqueSaldo {
  estoque_produto_id: string;
  estoque_local_id: string;
  quantidade: number;
  versao: number;
}

export interface PedidoCompraItem {
  id: string;
  pedido_compra_id: string;
  estoque_produto_id: string;
  descricao: string;
  unidade: string;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  quantidade_devolvida: number;
  custo_unitario: number;
  valor_total: number;
}

export interface RecebimentoCompraItem {
  id: string;
  recebimento_id: string;
  pedido_item_id: string;
  estoque_produto_id: string;
  quantidade: number;
  quantidade_devolvida: number;
  custo_unitario: number;
  valor_total: number;
}

export interface RecebimentoCompra {
  id: string;
  pedido_compra_id: string;
  estoque_local_id: string;
  conta_pagar_id: string;
  data_recebimento: string;
  documento_fornecedor: string | null;
  valor_total: number;
  created_at: string;
  itens: RecebimentoCompraItem[];
  conta?: {
    id: string;
    status: string;
    valor: number;
    valor_pago: number;
    vencimento: string;
  };
}

export interface DevolucaoCompra {
  id: string;
  pedido_compra_id: string;
  recebimento_id: string;
  estoque_local_id: string;
  data_devolucao: string;
  motivo: string;
  valor_total: number;
  reducao_obrigacao: number;
  credito_fornecedor: number;
  created_at: string;
}

export interface CreditoFornecedor {
  id: string;
  fornecedor_id: string;
  pedido_compra_id: string;
  devolucao_id: string;
  valor_original: number;
  valor_disponivel: number;
  status: string;
  created_at: string;
}

export interface PedidoCompra {
  id: string;
  numero: number;
  fornecedor_id: string;
  fornecedor_nome: string;
  status: PedidoCompraStatus;
  data_pedido: string;
  previsao_entrega: string | null;
  prazo_pagamento_dias: number;
  valor_total: number;
  observacoes: string | null;
  versao: number;
  aprovado_em: string | null;
  cancelado_em: string | null;
  cancelamento_motivo: string | null;
  created_at: string;
  itens: PedidoCompraItem[];
  recebimentos: RecebimentoCompra[];
  devolucoes: DevolucaoCompra[];
  creditos: CreditoFornecedor[];
}

export interface PedidoCompraForm {
  pedidoId?: string;
  fornecedorId: string;
  previsaoEntrega?: string;
  prazoPagamentoDias: number;
  observacoes?: string;
  versaoEsperada?: number;
  itens: Array<{ produtoId: string; quantidade: number; custoUnitario: number }>;
  idempotencyKey?: string;
}

const throwIfError = (error: { message?: string } | null) => {
  if (error) throw new Error(error.message || "Operação não concluída");
};

const invalidatePurchasing = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ["compras"] });
  queryClient.invalidateQueries({ queryKey: ["purchase-directory"] });
  queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
  queryClient.invalidateQueries({ queryKey: ["estoque-locais"] });
  queryClient.invalidateQueries({ queryKey: ["stock-location-directory"] });
  queryClient.invalidateQueries({ queryKey: ["stock-location-balance-directory"] });
  queryClient.invalidateQueries({ queryKey: ["estoque_produtos"] });
  queryClient.invalidateQueries({ queryKey: ["movimentacoes_estoque"] });
  queryClient.invalidateQueries({ queryKey: ["stock-movement-directory"] });
  queryClient.invalidateQueries({ queryKey: ["contas-pagar"] });
};

export function useCompras() {
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async (form: PedidoCompraForm) => {
      const { data, error } = await purchasingDb.rpc("salvar_pedido_compra", {
        _pedido_id: form.pedidoId || null,
        _fornecedor_id: form.fornecedorId,
        _previsao_entrega: form.previsaoEntrega || null,
        _prazo_pagamento_dias: form.prazoPagamentoDias,
        _observacoes: form.observacoes || null,
        _itens: form.itens,
        _versao_esperada: form.versaoEsperada ?? null,
        _idempotency_key: form.idempotencyKey || createIdempotencyKey("purchase-save"),
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Pedido de compra salvo como rascunho.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const approve = useMutation({
    mutationFn: async (order: Pick<PedidoCompra, "id" | "versao">) => {
      const { data, error } = await purchasingDb.rpc("aprovar_pedido_compra", {
        _pedido_id: order.id,
        _versao_esperada: order.versao,
        _idempotency_key: createIdempotencyKey("purchase-approve"),
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Pedido aprovado e liberado para recebimento.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const receive = useMutation({
    mutationFn: async (input: {
      order: PedidoCompra;
      localId: string;
      date: string;
      document?: string;
      items: Array<{ itemId: string; quantidade: number }>;
      idempotencyKey: string;
    }) => {
      const { data, error } = await purchasingDb.rpc("receber_pedido_compra", {
        _pedido_id: input.order.id,
        _estoque_local_id: input.localId,
        _data_recebimento: input.date,
        _documento_fornecedor: input.document || null,
        _itens: input.items,
        _versao_esperada: input.order.versao,
        _idempotency_key: input.idempotencyKey,
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Recebimento conciliado com estoque e contas a pagar.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const returnReceipt = useMutation({
    mutationFn: async (input: {
      order: PedidoCompra;
      receiptId: string;
      localId: string;
      date: string;
      reason: string;
      items: Array<{ recebimentoItemId: string; quantidade: number }>;
      idempotencyKey: string;
    }) => {
      const { data, error } = await purchasingDb.rpc("devolver_recebimento_compra", {
        _recebimento_id: input.receiptId,
        _estoque_local_id: input.localId,
        _data_devolucao: input.date,
        _motivo: input.reason,
        _itens: input.items,
        _versao_esperada: input.order.versao,
        _idempotency_key: input.idempotencyKey,
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Devolução registrada com estorno e crédito conciliados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: async (input: { order: PedidoCompra; reason: string; idempotencyKey: string }) => {
      const { data, error } = await purchasingDb.rpc("cancelar_pedido_compra", {
        _pedido_id: input.order.id,
        _motivo: input.reason,
        _versao_esperada: input.order.versao,
        _idempotency_key: input.idempotencyKey,
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Saldo pendente cancelado; recebimentos anteriores foram preservados.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    save,
    approve,
    receive,
    returnReceipt,
    cancel,
  };
}

interface UseEstoqueLocaisOptions {
  enabled?: boolean;
  includeBalances?: boolean;
}

export function useEstoqueLocais(options: UseEstoqueLocaisOptions = {}) {
  const queryClient = useQueryClient();
  const query = useQuery<{ locais: EstoqueLocal[]; saldos: EstoqueSaldo[] }>({
    queryKey: ["estoque-locais", options.includeBalances !== false],
    enabled: options.enabled !== false,
    queryFn: async () => {
      const locationsResult = await purchasingDb.from("estoque_locais").select("*").order("nome");
      throwIfError(locationsResult.error);
      const balancesResult = options.includeBalances === false
        ? { data: [], error: null }
        : await purchasingDb.from("estoque_saldos").select("*").order("updated_at", { ascending: false });
      throwIfError(balancesResult.error);
      return {
        locais: (locationsResult.data || []) as EstoqueLocal[],
        saldos: (balancesResult.data || []) as EstoqueSaldo[],
      };
    },
  });

  const saveLocation = useMutation({
    mutationFn: async (input: { local?: EstoqueLocal; code: string; name: string; description?: string; active?: boolean }) => {
      const { data, error } = await purchasingDb.rpc("salvar_estoque_local", {
        _local_id: input.local?.id || null,
        _codigo: input.code,
        _nome: input.name,
        _descricao: input.description || null,
        _ativo: input.active ?? true,
        _versao_esperada: input.local?.versao ?? null,
        _idempotency_key: createIdempotencyKey("stock-location"),
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Local de estoque salvo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transfer = useMutation({
    mutationFn: async (input: { productId: string; sourceId: string; destinationId: string; quantity: number; reason: string; idempotencyKey: string }) => {
      const { data, error } = await purchasingDb.rpc("transferir_estoque", {
        _estoque_produto_id: input.productId,
        _local_origem_id: input.sourceId,
        _local_destino_id: input.destinationId,
        _quantidade: input.quantity,
        _motivo: input.reason,
        _idempotency_key: input.idempotencyKey,
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Transferência concluída sem alterar o saldo total.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const adjust = useMutation({
    mutationFn: async (input: { productId: string; locationId: string; counted: number; reason: string; version: number; idempotencyKey: string }) => {
      const { data, error } = await purchasingDb.rpc("ajustar_estoque_contagem", {
        _estoque_produto_id: input.productId,
        _estoque_local_id: input.locationId,
        _quantidade_contada: input.counted,
        _motivo: input.reason,
        _versao_esperada: input.version,
        _idempotency_key: input.idempotencyKey,
      });
      throwIfError(error);
      return data;
    },
    onSuccess: () => {
      invalidatePurchasing(queryClient);
      toast.success("Contagem ajustada com movimentação auditável.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    locais: query.data?.locais || [],
    saldos: query.data?.saldos || [],
    isLoading: query.isLoading,
    isError: query.isError,
    saveLocation,
    transfer,
    adjust,
  };
}
