import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  PdvManualPayment,
  PdvPaymentMoment,
  PdvPixPayment,
  PdvSaleResult,
} from "@/lib/pdvPayment";

interface SaleItem {
  produto_id: string;
  quantidade: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}
export interface CreatePdvSaleInput {
  clientId: string;
  cashRegisterId: string;
  deliveryDate: string;
  urgent: boolean;
  urgencyPercentage: number;
  discountAmount: number;
  driverId?: string;
  vehicleId?: string;
  items: SaleItem[];
  payment: PdvManualPayment | { method: "PIX" } | null;
  idempotencyKey: string;
}

export interface CreatePdvPixInput {
  orderId: string;
  cashRegisterId: string;
  moment: PdvPaymentMoment;
  idempotencyKey: string;
}

export interface RecordPdvPaymentInput extends CreatePdvPixInput {
  payment: PdvManualPayment & { amount: number };
}

export interface RedeemPdvLoyaltyInput extends CreatePdvPixInput {
  points: number;
}

export interface PdvLoyaltySummary {
  programaAtivo: boolean;
  saldoPontos: number;
  valorSaldo: number;
  pontosGanhosNestaOrdem: number;
  pontosMinimosResgate: number;
  valorPorPonto: number;
}

async function edgeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json() as { error?: string };
      if (body.error) return new Error(body.error);
    } catch {
      // Mantém a mensagem original quando o corpo não é JSON.
    }
  }
  return error instanceof Error ? error : new Error("Não foi possível processar o pagamento");
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("pdv-payment", { body });
  if (error) throw await edgeError(error);
  if (data?.error) throw new Error(data.error);
  if (!data?.success) throw new Error("O serviço de pagamento retornou uma resposta inválida");
  return data as T;
}

function useInvalidatePdv() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["caixa-aberto"] });
    queryClient.invalidateQueries({ queryKey: ["caixa-movimentacoes"] });
    queryClient.invalidateQueries({ queryKey: ["ordens_servico"] });
    queryClient.invalidateQueries({ queryKey: ["consulta-os"] });
  };
}

export function useCreatePdvSale() {
  const invalidate = useInvalidatePdv();
  return useMutation({
    mutationFn: (input: CreatePdvSaleInput) => invoke<PdvSaleResult>({ action: "create_sale", ...input }),
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
