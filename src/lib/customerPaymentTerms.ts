export const PAYMENT_CONDITION_LABELS = {
  entrada: "Pagamento na entrada",
  retirada: "Pagamento na retirada",
  faturado: "Faturado",
} as const;

export const PAYMENT_METHOD_LABELS = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  transferencia: "Transferência",
} as const;

export const BILLING_FREQUENCY_LABELS = {
  avulso: "Avulso",
  mensal: "Mensal",
  quinzenal: "Quinzenal",
} as const;

export type PaymentCondition = keyof typeof PAYMENT_CONDITION_LABELS;
export type PreferredPaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;
export type BillingFrequency = keyof typeof BILLING_FREQUENCY_LABELS;
export type ImmediatePaymentMethod = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO";

/** Validate new saves separately from parsing legacy configurations. */
export function customerPaymentMethodError(
  condition: PaymentCondition | null,
  method: PreferredPaymentMethod | null,
): string | null {
  return condition !== "faturado" && (method === "boleto" || method === "transferencia")
    ? "Boleto/transferência exigem condição Faturado"
    : null;
}

export interface CustomerPaymentConfig {
  condicao_pagamento?: string | null;
  tipo_faturamento?: string | null;
  forma_pagamento?: string | null;
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
}

export interface CustomerPaymentTerms {
  condition: PaymentCondition;
  conditionConfigured: boolean;
  preferredMethod: PreferredPaymentMethod | null;
  frequency: BillingFrequency;
  closingDay: number | null;
  dueDay: number | null;
}

function member<T extends string>(value: unknown, labels: Record<T, string>): value is T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(labels, value);
}

function day(value: number | null | undefined): number | null {
  return Number.isInteger(value) && value >= 1 && value <= 31 ? value : null;
}

/** Only an explicit condition authorizes billing, regardless of legacy frequency or client classification. */
export function parseCustomerPaymentTerms(config?: CustomerPaymentConfig | null): CustomerPaymentTerms {
  const conditionConfigured = member(config?.condicao_pagamento, PAYMENT_CONDITION_LABELS);
  const condition = conditionConfigured ? config.condicao_pagamento as PaymentCondition : "retirada";
  const billed = condition === "faturado";
  const frequency = billed && member(config?.tipo_faturamento, BILLING_FREQUENCY_LABELS) ? config.tipo_faturamento : "avulso";
  return {
    condition,
    conditionConfigured,
    preferredMethod: member(config?.forma_pagamento, PAYMENT_METHOD_LABELS) ? config.forma_pagamento : null,
    frequency,
    closingDay: billed && frequency !== "avulso" ? day(config?.dia_fechamento) : null,
    dueDay: billed ? day(config?.dia_vencimento) : null,
  };
}

export function customerPaymentTermsLabels(terms: CustomerPaymentTerms) {
  return {
    condition: terms.conditionConfigured ? PAYMENT_CONDITION_LABELS[terms.condition] : "Não configurada — pagamento na retirada",
    preferredMethod: terms.preferredMethod ? PAYMENT_METHOD_LABELS[terms.preferredMethod] : "Não definido",
    frequency: terms.condition === "faturado" ? BILLING_FREQUENCY_LABELS[terms.frequency] : null,
  };
}

/** Preference selects a supported flow; it never constitutes payment confirmation. */
export function initialCustomerPayment(terms: CustomerPaymentTerms) {
  const supported: Partial<Record<PreferredPaymentMethod, ImmediatePaymentMethod>> = {
    dinheiro: "DINHEIRO", pix: "PIX", cartao_credito: "CARTAO_CREDITO", cartao_debito: "CARTAO_DEBITO",
  };
  const method = terms.preferredMethod ? supported[terms.preferredMethod] ?? null : null;
  return {
    pagoAgora: terms.condition === "entrada",
    formaPagamento: terms.condition === "entrada" ? method : null,
    unsupportedPreference: terms.preferredMethod !== null && method === null,
  };
}

export function isCustomerPaymentAllowed(
  terms: CustomerPaymentTerms,
  payment: { pagoAgora: boolean; formaPagamento: string | null; canReceivePayments?: boolean },
): boolean {
  if (terms.condition === "faturado") return !payment.pagoAgora && payment.formaPagamento === null;
  if (!payment.pagoAgora) return terms.condition === "retirada" && payment.formaPagamento === null;
  if (payment.canReceivePayments === false) return false;
  const methods: string[] = ["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO"];
  if (terms.condition === "retirada") methods.push("FIDELIDADE");
  return methods.includes(payment.formaPagamento ?? "");
}

export function customerPaymentTermsToConfig(terms: CustomerPaymentTerms): Required<CustomerPaymentConfig> {
  const billed = terms.condition === "faturado";
  return {
    condicao_pagamento: terms.condition,
    forma_pagamento: terms.preferredMethod,
    tipo_faturamento: billed ? terms.frequency : "avulso",
    dia_fechamento: billed && terms.frequency !== "avulso" ? day(terms.closingDay) : null,
    dia_vencimento: billed ? day(terms.dueDay) : null,
  };
}
