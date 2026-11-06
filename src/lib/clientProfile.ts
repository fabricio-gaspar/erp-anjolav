import type { ClientPriceMode } from "./clientPricing.ts";

export type ClientProfileTab = "dados" | "endereco" | "pagamento" | "configuracao" | "contrato" | "precos";

export interface ClientProfileAddress {
  id: string;
  type: "principal" | "coleta" | "entrega" | "faturamento" | "outro";
  name: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  instructions: string | null;
}

export interface ClientProfileOrder {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  qualityStatus: string;
  logisticsStatus: string;
  fiscalStatus: string;
  promisedDate: string | null;
  totalValue: number;
  paidValue: number;
  openBalance: number;
  createdAt: string;
}

export interface ClientProfileInvoice {
  id: string;
  status: string;
  paymentStatus: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  totalValue: number;
  paidValue: number;
  openBalance: number;
  createdAt: string;
}

export interface ClientProfilePayment {
  id: string;
  invoiceId: string;
  value: number;
  paymentDate: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface ClientProfileOccurrence {
  id: string;
  orderId: string;
  orderNumber: string;
  stage: string;
  description: string;
  newPromisedDate: string | null;
  employeeName: string | null;
  createdAt: string;
}

export interface ClientProfileAppointment {
  id: string;
  type: "retirada" | "entrega";
  date: string;
  time: string | null;
  status: string;
  notes: string | null;
}

export interface ClientProfile {
  customer: {
    id: string;
    personType: "cpf" | "cnpj";
    classification: "residencial" | "industrial";
    document: string | null;
    legalName: string;
    tradeName: string | null;
    email: string | null;
    phone: string | null;
    secondaryPhone: string | null;
    contactName: string | null;
    notes: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
  addresses: {
    activeCount: number;
    primary: ClientProfileAddress | null;
  };
  commercialTerms: {
    configured: boolean;
    condition: string | null;
    preferredMethod: string | null;
    frequency: string | null;
    closingDay: number | null;
    dueDay: number | null;
    priceTable: ClientPriceMode;
  };
  contract: {
    id: string;
    description: string;
    startDate: string;
    endDate: string | null;
    billingAuthorized: boolean;
    frequency: string;
    closingDay: number | null;
    dueDay: number;
    paymentMethod: string | null;
    version: number;
  } | null;
  orders: {
    allowed: boolean;
    summary: {
      total: number;
      open: number;
      late: number;
      pendingPayment: number;
      openBalance: number;
    } | null;
    recent: ClientProfileOrder[];
  };
  finance: {
    allowed: boolean;
    summary: {
      invoiceCount: number;
      openInvoiceCount: number;
      overdueInvoiceCount: number;
      openBalance: number;
      receivedTotal: number;
    } | null;
    recentInvoices: ClientProfileInvoice[];
    recentPayments: ClientProfilePayment[];
  };
  occurrences: {
    allowed: boolean;
    recent: ClientProfileOccurrence[];
  };
  appointments: {
    allowed: boolean;
    recent: ClientProfileAppointment[];
  };
}

export interface ClientProfileNextAction {
  title: string;
  description: string;
  tone: "default" | "warning" | "danger" | "success";
  tab?: ClientProfileTab;
  openOrders?: boolean;
}

export const CLIENT_ORDER_STATUS_LABELS: Record<string, string> = {
  retirada: "Recebido",
  separacao: "Separação",
  lavagem: "Lavagem",
  secagem: "Secagem",
  passadoria: "Passadoria",
  embalagem: "Embalagem",
  expedicao: "Pronto para entrega",
  entregue: "Entregue",
  cancelada: "Cancelado",
};

export const CLIENT_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const CLIENT_PAYMENT_CONDITION_LABELS: Record<string, string> = {
  entrada: "Pagamento na entrada",
  retirada: "Pagamento na retirada",
  faturado: "Faturamento autorizado",
  a_vista: "À vista",
};

export const CLIENT_PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export function deriveClientProfileNextAction(profile: ClientProfile): ClientProfileNextAction {
  if (!profile.customer.active) {
    return {
      title: "Cliente arquivado",
      description: "Reative o cadastro antes de iniciar um novo atendimento.",
      tone: "default",
      tab: "dados",
    };
  }

  const finance = profile.finance.summary;
  if (profile.finance.allowed && finance && finance.overdueInvoiceCount > 0) {
    return {
      title: "Revisar faturas vencidas",
      description: `${finance.overdueInvoiceCount} ${finance.overdueInvoiceCount === 1 ? "fatura exige" : "faturas exigem"} conciliação ou cobrança.`,
      tone: "danger",
    };
  }

  const orders = profile.orders.summary;
  if (profile.orders.allowed && orders && orders.late > 0) {
    return {
      title: "Tratar pedidos atrasados",
      description: `${orders.late} ${orders.late === 1 ? "pedido está" : "pedidos estão"} além da previsão de entrega.`,
      tone: "danger",
      openOrders: true,
    };
  }

  if (profile.addresses.activeCount === 0) {
    return {
      title: "Cadastrar endereço operacional",
      description: "Inclua ao menos um endereço para coleta, entrega ou faturamento.",
      tone: "warning",
      tab: "endereco",
    };
  }

  if (!profile.commercialTerms.configured) {
    return {
      title: "Definir condição comercial",
      description: "Registre quando e como o cliente deve pagar antes do próximo pedido.",
      tone: "warning",
      tab: "pagamento",
    };
  }

  if (profile.orders.allowed && orders && orders.open > 0) {
    return {
      title: "Acompanhar pedidos em aberto",
      description: `${orders.open} ${orders.open === 1 ? "pedido segue" : "pedidos seguem"} em operação.`,
      tone: "default",
      openOrders: true,
    };
  }

  if (profile.appointments.allowed && profile.appointments.recent.length > 0) {
    return {
      title: "Próximo atendimento agendado",
      description: "Confira data, janela e instruções antes da coleta ou entrega.",
      tone: "default",
      tab: "configuracao",
    };
  }

  return {
    title: "Cadastro pronto para atendimento",
    description: "Não há pendência prioritária identificada nesta ficha.",
    tone: "success",
  };
}
