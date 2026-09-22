export type PdvPaymentMethod = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO";
export type PdvPaymentMoment = "ENTRADA" | "RETIRADA";

export interface PdvManualPayment {
  method: Exclude<PdvPaymentMethod, "PIX">;
  amount?: number;
  amountReceived?: number;
  installments: number;
  brand?: string;
  nsu?: string;
  authorizationCode?: string;
}

export interface PdvPixPayment {
  paymentId: string;
  paymentStatus: string;
  providerStatus: string | null;
  amount: number;
  qrCode: string | null;
  copyPaste: string | null;
  expiresAt: string | null;
}

export interface PdvOrderResult {
  id: string;
  number: string;
  total: number;
  paymentStatus: string;
  deliveryDate: string;
}

export interface PdvSaleResult {
  order: PdvOrderResult;
  payment: Record<string, unknown> | null;
  pix: PdvPixPayment | null;
  pixError: string | null;
  idempotent: boolean;
}

export const CARD_BRANDS = [
  { value: "VISA", label: "Visa" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "ELO", label: "Elo" },
  { value: "AMEX", label: "American Express" },
  { value: "HIPERCARD", label: "Hipercard" },
  { value: "OUTRA", label: "Outra" },
] as const;

export function createPdvIdempotencyKey(prefix: "sale" | "receipt" | "pix"): string {
  return `pdv:${prefix}:${crypto.randomUUID()}`;
}

export function calculateChange(amount: number, amountReceived: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(amountReceived) || amount < 0 || amountReceived < amount) {
    return 0;
  }
  return Math.round((amountReceived - amount) * 100) / 100;
}

export function isPixConfirmed(status: string | null | undefined): boolean {
  return status === "CONFIRMADO";
}

export function isPixTerminal(status: string | null | undefined): boolean {
  return ["CONFIRMADO", "CANCELADO", "ESTORNADO", "FALHOU"].includes(status ?? "");
}
