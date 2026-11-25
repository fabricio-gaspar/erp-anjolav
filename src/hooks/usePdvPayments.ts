import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PdvManualPayment,
  PdvPaymentMoment,
  PdvPixPayment,
  PdvSaleResult,
} from "@/lib/pdvPayment";
import type { PdvPaymentMethod } from "@/lib/pdvPayment";
import type { PdvSaleRequest } from "@/lib/pdvSale";
import type { PdvArea } from "@/lib/authorization";

export type CreatePdvSaleInput = PdvSaleRequest;

export interface PdvCapacitySnapshot {
  configured: boolean;
  limit: number | null;
  reserved: number;
  available: number | null;
  date: string;
  area: "industrial" | "residencial";
}

export interface CreatePdvPixInput {
  orderId: string;
  cashRegisterId: string;
  moment: PdvPaymentMoment;
  idempotencyKey: string;
  /** Valor desta cobrança; quando omitido, o backend usa o saldo pendente. */
  amount?: number;
}

export interface RecordPdvPaymentInput extends CreatePdvPixInput {
  payment: PdvManualPayment & { amount: number };
}

export interface RedeemPdvLoyaltyInput extends CreatePdvPixInput {
  points: number;
}

export interface PdvCustomerCreditTransaction {
  id: string;
  tipo: "CREDITO" | "USO" | "ESTORNO" | "AJUSTE_SAIDA";
  valor: number;
  saldoApos: number;
  formaPagamento: string | null;
  descricao: string;
  rolId: string | null;
  criadoEm: string;
}

export interface PdvCustomerCreditSummary {
  saldo: number;
  lancamentos: PdvCustomerCreditTransaction[];
}

export interface TopUpPdvCustomerCreditInput {
  clientId: string;
  cashRegisterId: string;
  amount: number;
  amountReceived: number;
  method: Exclude<PdvPaymentMethod, "PIX" | "CREDITO_CLIENTE">;
  brand?: string;
  nsu?: string;
  authorizationCode?: string;
  idempotencyKey: string;
}

export interface ApplyPdvCustomerCreditInput {
  orderId: string;
  cashRegisterId: string;
  moment: PdvPaymentMoment;
  amount: number;
  idempotencyKey: string;
}

export interface SubtractPdvCustomerCreditInput {
  clientId: string;
  cashRegisterId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

export interface PdvLoyaltySummary {
  programaAtivo: boolean;
  saldoPontos: number;
  valorSaldo: number;
  pontosGanhosNestaOrdem: number;
  pontosMinimosResgate: number;
  valorPorPonto: number;
}

export interface PdvPaymentSummary {
  id: string;
  metodo: string;
  provedor: string;
  momento: string;
  status: string;
  status_provedor: string | null;
  valor: number;
  valor_alocado: number;
  valor_nao_alocado: number;
  valor_recebido: number | null;
  troco: number;
  parcelas: number;
  bandeira: string | null;
  nsu: string | null;
  codigo_autorizacao: string | null;
  confirmado_em: string | null;
  cancelado_em: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  canReverse: boolean;
  canEdit: boolean;
  reversalUnavailableReason?: string;
}

export class PdvServiceError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "PdvServiceError";
  }
}

async function edgeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsFetchError) {
    return new PdvServiceError("Não foi possível comunicar com o serviço do PDV", 503);
  }
  if (error instanceof FunctionsHttpError) {
    const status = Number.isFinite(error.context.status) ? error.context.status : null;
    try {
      const body = await error.context.json() as { error?: string };
      if (body.error) return new PdvServiceError(body.error, status);
    } catch {
      // Mantém a mensagem original quando o corpo não é JSON.
    }
    return new PdvServiceError(error.message, status);
  }
  return error instanceof Error
    ? new PdvServiceError(error.message, null)
    : new PdvServiceError("Não foi possível processar o pagamento", null);
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pdv-payment", { body });
  if (error) throw await edgeError(error);
  if (data?.error) throw new Error(data.error);
  if (!data?.success) throw new Error("O serviço de pagamento retornou uma resposta inválida");
  return data as T;
}

export function createPdvSaleRequest(input: CreatePdvSaleInput): Promise<PdvSaleResult> {
  return invoke<PdvSaleResult>({ action: "create_sale", ...input });
}

function useInvalidatePdv() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
    queryClient.invalidateQueries({ queryKey: ["caixa-movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-rols-in-progress"] });
    queryClient.invalidateQueries({ queryKey: ["order-directory"] });
    queryClient.invalidateQueries({ queryKey: ["consulta-os"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-customer-loyalty"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-customer-credit"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-payments"] });
    queryClient.invalidateQueries({ queryKey: ["vendas-do-dia"] });
    queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    queryClient.invalidateQueries({ queryKey: ["faturas"] });
    queryClient.invalidateQueries({ queryKey: ["pdv-capacity"] });
  };
}

/**
 * Capacity stays server-derived so the browser never becomes the authority
 * for booked production load. The Edge Function scopes the client to the
 * active tenant and operation before consulting the protected RPC.
 */
export function usePdvCapacity(
  area: PdvArea,
  clientId: string | null,
  deliveryDate: string | null,
  enabled = true,
) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["pdv-capacity", session?.user.id, activeTenant?.id, area, clientId, deliveryDate],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id && area && deliveryDate),
    queryFn: async () => {
      if (!deliveryDate) throw new Error("Data de entrega é obrigatória para consultar capacidade");
      const result = await invoke<{ success: true; capacity: PdvCapacitySnapshot }>({
        action: "get_capacity",
        area,
        clientId,
        deliveryDate,
      });
      return result.capacity;
    },
    staleTime: 0,
  });
}

export function useCreatePdvSale() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: createPdvSaleRequest,
    onSuccess: invalidate,
  });
}

export function useCreatePdvPix() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: CreatePdvPixInput) => {
      const result = await invoke<{ success: true; pix: PdvPixPayment }>({ action: "create_pix", ...input });
      return result.pix;
    },
    onSuccess: invalidate,
  });
}

export function usePdvPixStatus() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "get_pix_status",
        paymentId,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function useRecordPdvPayment() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: RecordPdvPaymentInput) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "record_payment",
        ...input,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function useCancelPdvPix() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "cancel_pix",
        paymentId,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function usePdvPaymentsForOrder(orderId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pdv-payments", orderId],
    enabled: Boolean(orderId) && enabled,
    queryFn: async () => {
      if (!orderId) return [] as PdvPaymentSummary[];
      const result = await invoke<{ success: true; payments: PdvPaymentSummary[] }>({
        action: "list_payments",
        orderId,
      });
      return result.payments;
    },
  });
}

export function useReversePdvPayment() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "reverse_payment",
        paymentId,
        reason,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function useEditPdvPayment() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async ({
      paymentId,
      newValue,
      newMethod,
      reason,
    }: {
      paymentId: string;
      newValue: number;
      newMethod: string;
      reason: string;
    }) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "edit_payment",
        paymentId,
        newValue,
        newMethod,
        reason,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function usePdvLoyaltySummary(orderId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pdv-loyalty", orderId],
    enabled: Boolean(orderId) && enabled,
    queryFn: async () => {
      const result = await invoke<{ success: true; loyalty: PdvLoyaltySummary }>({
        action: "loyalty_summary",
        orderId,
      });
      return result.loyalty;
    },
  });
}

export function usePdvCustomerLoyaltySummary(clientId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pdv-customer-loyalty", clientId],
    enabled: Boolean(clientId) && enabled,
    queryFn: async () => {
      const result = await invoke<{ success: true; loyalty: PdvLoyaltySummary }>({
        action: "loyalty_customer_summary",
        clientId,
      });
      return result.loyalty;
    },
  });
}

export function usePdvCustomerCreditSummary(clientId: string | null, enabled = true) {
  const { activeTenant, session } = useAuth();
  return useQuery({
    queryKey: ["pdv-customer-credit", session?.user.id, activeTenant?.id, clientId],
    enabled: enabled && Boolean(session?.user.id && activeTenant?.id && clientId),
    queryFn: async () => {
      if (!clientId) throw new Error("Selecione um cliente para consultar o crédito");
      const result = await invoke<{ success: true; credit: PdvCustomerCreditSummary }>({
        action: "customer_credit_summary",
        clientId,
      });
      return result.credit;
    },
    staleTime: 10_000,
  });
}

export function useTopUpPdvCustomerCredit() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: TopUpPdvCustomerCreditInput) => {
      const result = await invoke<{ success: true; credit: { saldo: number; idempotente: boolean } }>({
        action: "top_up_customer_credit",
        ...input,
      });
      return result.credit;
    },
    onSuccess: invalidate,
  });
}

export function useSubtractPdvCustomerCredit() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: SubtractPdvCustomerCreditInput) => {
      const result = await invoke<{ success: true; credit: { saldo: number; idempotente: boolean } }>({
        action: "subtract_customer_credit",
        ...input,
      });
      return result.credit;
    },
    onSuccess: invalidate,
  });
}

export function useApplyPdvCustomerCredit() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: ApplyPdvCustomerCreditInput) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "apply_customer_credit",
        ...input,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}

export function useRedeemPdvLoyalty() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: async (input: RedeemPdvLoyaltyInput) => {
      const result = await invoke<{ success: true; payment: Record<string, unknown> }>({
        action: "redeem_loyalty",
        ...input,
      });
      return result.payment;
    },
    onSuccess: invalidate,
  });
}
