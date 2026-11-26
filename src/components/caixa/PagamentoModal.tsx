import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { formatNumberToCurrency, parseCurrencyToNumber } from "@/lib/currencyUtils";
import { Label } from "@/components/ui/label";
import { 
  Loader2, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Percent,
  Gift,
  MapPin,
  UserRound,
  Check,
  AlertTriangle,
  Wallet,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PdvCustomerCreditSummary, PdvLoyaltySummary } from "@/hooks/usePdvPayments";
import type { ConfiguracaoPagamentoCliente } from "@/hooks/useClientes";
import type { PdvFulfillmentSettings } from "@/components/caixa/PdvFulfillmentPanel";

import { parseCustomerPaymentTerms, initialCustomerPayment, isCustomerPaymentAllowed } from "@/lib/customerPaymentTerms";

interface CartItem {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
  quantidade: number;
  precoOriginal: number;
  cor_item?: string;
  marca_item?: string;
  avarias?: string;
  posicao_prateleira?: string;
  observacoes?: string;
}

const formatPaymentQuantity = (item: CartItem) => {
  const quantity = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: ["Kg", "Mt"].includes(item.unidade) ? 4 : 0,
  }).format(item.quantidade);
  const unit = item.unidade === "Mt"
    ? "m²"
    : item.unidade === "Kg"
      ? "kg"
      : item.unidade === "Un"
        ? "un."
        : item.quantidade === 1 ? "peça" : "peças";

  return `${quantity} ${unit}`;
};

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
  classificacao?: "industrial" | "domestico" | "residencial";
}

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cliente: Cliente | null;
  totalOriginal: number;
  loyalty: PdvLoyaltySummary | null;
  loyaltyLoading?: boolean;
  customerCredit?: PdvCustomerCreditSummary | null;
  customerCreditLoading?: boolean;
  configuracaoPagamento?: ConfiguracaoPagamentoCliente | null;
  canManageCommercialTerms?: boolean;
  /** The parent must pass false whenever the cash register is unavailable. */
  canReceivePayments?: boolean;
  /** Offline accepts only a ROL without immediate payment or cash movement. */
  offlineMode?: boolean;
  termsLoading?: boolean;
  termsError?: boolean;
  fulfillment: PdvFulfillmentSettings;
  urgencyPercentage?: number;
  fulfillmentAddressSnapshot?: DadosPagamento["addressSnapshot"];
  fulfillmentBlockReason?: string | null;
  /** A escolha rápida é só uma preferência visual; as regras comerciais ainda são validadas neste modal e no servidor. */
  initialSelection?: {
    pagoAgora: boolean;
    formaPagamento: PdvPaymentMethod | null;
  } | null;
  /** When true, this dialog only applies the commercial adjustment; sale finalization stays on the main PDV. */
  adjustmentOnly?: boolean;
  initialDiscountAmount?: number;
  onApplyDiscount?: (discountAmount: number) => Promise<void> | void;
  onConfirm: (dados: DadosPagamento) => Promise<void>;
  isLoading?: boolean;
}

export interface DadosPagamento {
  pagoAgora: boolean;
  formaPagamento: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "FIDELIDADE" | "CREDITO_CLIENTE" | null;
  urgente: boolean;
  percentualUrgencia: number;
  valorDesconto: number;
  valorTotal: number;
  previsaoEntrega: Date;
  receiptMode: "balcao" | "coleta";
  deliveryMode: "balcao" | "entrega";
  addressSnapshot?: {
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    pais?: string | null;
  };
  motoristaId?: string;
  veiculoId?: string;
  // Novos campos de parcelamento e troco
  parcelas?: number;
  valorPagamento?: number;
  valorRecebido?: number;
  troco?: number;
  bandeira?: string;
  nsu?: string;
  codigoAutorizacao?: string;
  pontosResgate?: number;
  valorCreditoAplicar?: number;
  pagamentos?: Array<{ method: Exclude<PdvPaymentMethod, "FIDELIDADE" | "CREDITO_CLIENTE">; amount: number; amountReceived?: number }>;
}

export type PdvPaymentMethod = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "FIDELIDADE" | "CREDITO_CLIENTE";
type FormaPagamento = PdvPaymentMethod;

const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string; icon: React.ReactNode }[] = [
  { value: "DINHEIRO", label: "Dinheiro", icon: <Banknote className="w-5 h-5" /> },
  { value: "PIX", label: "PIX", icon: <Smartphone className="w-5 h-5" /> },
  { value: "CARTAO_CREDITO", label: "Crédito", icon: <CreditCard className="w-5 h-5" /> },
  { value: "CARTAO_DEBITO", label: "Débito", icon: <CreditCard className="w-5 h-5" /> },
  { value: "FIDELIDADE", label: "Pontos", icon: <Gift className="w-5 h-5" /> },
  { value: "CREDITO_CLIENTE", label: "Crédito disponível", icon: <Wallet className="w-5 h-5" /> },
];

export function PagamentoModal(props: PagamentoModalProps) {
  // Reset payment evidence and adjustments whenever the customer or terms change.
  const config = props.configuracaoPagamento;
  const formKey = JSON.stringify([
    props.open, props.cliente?.id, props.termsLoading, props.termsError,
    config?.cliente_id, config?.condicao_pagamento, config?.forma_pagamento,
    config?.tipo_faturamento, config?.dia_fechamento, config?.dia_vencimento,
    props.canReceivePayments, props.canManageCommercialTerms,
    props.offlineMode,
    props.initialSelection?.pagoAgora, props.initialSelection?.formaPagamento,
    props.adjustmentOnly, props.initialDiscountAmount,
  ]);
  return <PagamentoModalForm key={formKey} {...props} />;
}

function PagamentoModalForm({
  open,
  onOpenChange,
  cart,
  cliente,
  totalOriginal,
  loyalty,
  loyaltyLoading = false,
  customerCredit = null,
  customerCreditLoading = false,
  configuracaoPagamento = null,
  canManageCommercialTerms = false,
  canReceivePayments = true,
  offlineMode = false,
  termsLoading = false,
  termsError = false,
  fulfillment,
  urgencyPercentage = 30,
  fulfillmentAddressSnapshot,
  fulfillmentBlockReason = null,
  initialSelection = null,
  adjustmentOnly = false,
  initialDiscountAmount = 0,
  onApplyDiscount,
  onConfirm,
  isLoading = false,
}: PagamentoModalProps) {
  const termsMismatch = !!configuracaoPagamento && configuracaoPagamento.cliente_id !== cliente?.id;
  const terms = parseCustomerPaymentTerms(termsMismatch ? null : configuracaoPagamento);
  const isBilled = terms.condition === "faturado";
  const isEntry = terms.condition === "entrada";
  const customerInitialPayment = initialCustomerPayment(terms);
  const initialPayment = offlineMode
    ? { pagoAgora: false, formaPagamento: null }
    : initialSelection && !isBilled
    ? {
        pagoAgora: initialSelection.pagoAgora,
        formaPagamento: initialSelection.pagoAgora ? initialSelection.formaPagamento : null,
      }
    : customerInitialPayment;
  const [pagoAgora, setPagoAgora] = useState(initialPayment.pagoAgora);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(initialPayment.formaPagamento);
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">(initialDiscountAmount > 0 ? "valor" : "percentual");
  const [descontoInput, setDescontoInput] = useState(initialDiscountAmount > 0 ? formatNumberToCurrency(initialDiscountAmount) : "");
  // Novos estados para parcelamento e troco
  const parcelas = 1;
  const [valorPagamento, setValorPagamento] = useState("");
  const [valorRecebido, setValorRecebido] = useState("");
  const [bandeira, setBandeira] = useState("");
  const [nsu, setNsu] = useState("");
  const [codigoAutorizacao, setCodigoAutorizacao] = useState("");
  const [pontosResgate, setPontosResgate] = useState("");
  const [valorCredito, setValorCredito] = useState("");
  const [formasAdicionais, setFormasAdicionais] = useState<Array<{ id: string; method: Exclude<PdvPaymentMethod, "FIDELIDADE" | "CREDITO_CLIENTE">; amount: string }>>([]);
  const { deliveryDate: previsaoEntrega, urgent: urgente, receiptMode, deliveryMode, deliveryFee, driverId: motoristaId, vehicleId: veiculoId } = fulfillment;

  useEffect(() => {
    if (formaPagamento !== "CARTAO_CREDITO" && formaPagamento !== "CARTAO_DEBITO") {
      setBandeira("");
      setNsu("");
      setCodigoAutorizacao("");
    }
  }, [formaPagamento]);

  // Calculate values
  const calculos = useMemo(() => {
    let valorDesconto = 0;
    
    if (descontoInput) {
      const input = descontoTipo === "percentual"
        ? parseFloat(descontoInput.replace(",", "."))
        : parseCurrencyToNumber(descontoInput);
      if (!isNaN(input) && input > 0) {
        if (descontoTipo === "percentual") {
          valorDesconto = (totalOriginal * input) / 100;
        } else {
          valorDesconto = input;
        }
      }
    }

    const subtotalComDesconto = totalOriginal - valorDesconto;
    const valorUrgencia = urgente ? (subtotalComDesconto * urgencyPercentage) / 100 : 0;
    const taxaEntrega = deliveryMode === "entrega" ? Math.max(0, Number(deliveryFee) || 0) : 0;
    const valorTotal = subtotalComDesconto + valorUrgencia + taxaEntrega;

    return {
      subtotal: totalOriginal,
      valorDesconto,
      valorUrgencia,
      taxaEntrega,
      valorTotal: Math.max(0, valorTotal),
    };
  }, [deliveryFee, deliveryMode, descontoInput, descontoTipo, totalOriginal, urgente, urgencyPercentage]);

  const valorPagamentoNumerico = parseCurrencyToNumber(valorPagamento);
  const pagamentosCombinados = useMemo(() => {
    if (!formaPagamento || formaPagamento === "FIDELIDADE" || formaPagamento === "CREDITO_CLIENTE") return [];
    return [
      { method: formaPagamento, amount: valorPagamentoNumerico, amountReceived: formaPagamento === "DINHEIRO" ? parseCurrencyToNumber(valorRecebido) : undefined },
      ...formasAdicionais.map((row) => ({ method: row.method, amount: parseCurrencyToNumber(row.amount), amountReceived: undefined })),
    ];
  }, [formaPagamento, formasAdicionais, valorPagamentoNumerico, valorRecebido]);
  const totalCombinado = pagamentosCombinados.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const loyaltyBelowMinimum = Boolean(
    loyalty?.programaAtivo && loyalty.saldoPontos < loyalty.pontosMinimosResgate,
  );
  const valorCreditoNumerico = parseCurrencyToNumber(valorCredito);
  const valorAbatidoAgora = formaPagamento === "CREDITO_CLIENTE" ? valorCreditoNumerico : valorPagamentoNumerico;
  const valorRestante = Math.max(0, calculos.valorTotal - (formasAdicionais.length ? totalCombinado : (Number.isFinite(valorAbatidoAgora) ? valorAbatidoAgora : 0)));

  useEffect(() => {
    if (!open || !pagoAgora) {
      if (!pagoAgora) setValorPagamento("");
      return;
    }
    if (!valorPagamento) setValorPagamento(formatNumberToCurrency(calculos.valorTotal));
  }, [calculos.valorTotal, open, pagoAgora, valorPagamento]);

  useEffect(() => {
    if (formaPagamento === "DINHEIRO" && !valorRecebido && valorPagamento) {
      setValorRecebido(valorPagamento);
    }
  }, [formaPagamento, valorPagamento, valorRecebido]);

  // Calcular troco
  const troco = useMemo(() => {
    if (formaPagamento !== "DINHEIRO" || !valorRecebido) return 0;
    const recebido = parseCurrencyToNumber(valorRecebido);
    return Math.max(0, recebido - valorPagamentoNumerico);
  }, [valorRecebido, valorPagamentoNumerico, formaPagamento]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const requiresAddress = receiptMode === "coleta" || deliveryMode === "entrega";

  const submitBlockReason = (() => {
    if (isLoading) return "A venda está sendo processada.";
    if (!cliente) return "Selecione um cliente antes de finalizar.";
    if (termsLoading) return "Aguarde o carregamento das condições comerciais.";
    if (termsError || termsMismatch) return "Não foi possível validar as condições comerciais do cliente.";
    if (fulfillmentBlockReason) return fulfillmentBlockReason;
    if (!isCustomerPaymentAllowed(terms, { pagoAgora, formaPagamento: pagoAgora ? formaPagamento : null, canReceivePayments })) {
      if (pagoAgora && !canReceivePayments) return "Abra o caixa e confirme sua permissão para receber agora.";
      if (pagoAgora && !formaPagamento) return "Escolha a forma de pagamento.";
      return "O pagamento escolhido não é permitido pela condição comercial deste cliente.";
    }
    if (isBilled && (urgente || calculos.valorDesconto > 0)) return "Pedidos faturados não aceitam Lavagem Expressa ou desconto neste fluxo.";
    if (!canManageCommercialTerms && calculos.valorDesconto > 0) return "Seu perfil não permite conceder desconto.";
    if (!Number.isFinite(calculos.valorTotal) || !Number.isFinite(calculos.valorDesconto)) return "Revise os valores da venda.";
    if (calculos.valorDesconto > totalOriginal) return "O desconto não pode ser maior que o subtotal.";
    if (calculos.valorTotal <= 0) return "O total da venda deve ser maior que zero.";
    if (pagoAgora && formaPagamento && formaPagamento !== "FIDELIDADE" && formaPagamento !== "CREDITO_CLIENTE") {
      if (!Number.isFinite(valorPagamentoNumerico) || valorPagamentoNumerico <= 0) return "Informe quanto será pago agora.";
      if (formasAdicionais.some((row) => !Number.isFinite(parseCurrencyToNumber(row.amount)) || parseCurrencyToNumber(row.amount) <= 0)) return "Informe um valor válido para cada forma de pagamento.";
      if (totalCombinado > calculos.valorTotal + 0.009) return "A soma dos pagamentos não pode ultrapassar o total do ROL.";
      if (pagamentosCombinados.some((row) => row.method === "DINHEIRO" && (row.amountReceived ?? row.amount) < row.amount)) return "O valor recebido em dinheiro precisa cobrir essa forma de pagamento.";
    }
    if (pagoAgora && formaPagamento === "DINHEIRO") {
      const recebido = parseCurrencyToNumber(valorRecebido);
      if (!Number.isFinite(recebido) || recebido < valorPagamentoNumerico) return "Informe um valor recebido igual ou maior que o pagamento.";
    }
    if (pagoAgora && formaPagamento === "FIDELIDADE") {
      const pontos = Number(pontosResgate);
      const valorResgate = pontos * Number(loyalty?.valorPorPonto ?? 0);
      if (loyaltyLoading) return "Aguarde a consulta do saldo de fidelidade.";
      if (!loyalty?.programaAtivo) return "O programa de fidelidade não está ativo.";
      if (!Number.isInteger(pontos) || pontos < loyalty.pontosMinimosResgate || pontos > loyalty.saldoPontos) return "Informe uma quantidade válida de pontos dentro do saldo disponível.";
      if (valorResgate <= 0 || valorResgate > calculos.valorTotal + 0.009) return "O resgate não pode ultrapassar o total da venda.";
    }
    if (pagoAgora && formaPagamento === "CREDITO_CLIENTE") {
      const amount = parseCurrencyToNumber(valorCredito);
      if (customerCreditLoading) return "Aguarde a consulta do crédito disponível do cliente.";
      if (!Number.isFinite(amount) || amount <= 0 || amount > calculos.valorTotal + 0.009) return "Informe um valor de crédito maior que zero e até o total do ROL.";
      if (amount > Number(customerCredit?.saldo ?? 0) + 0.009) return "O crédito informado supera o saldo disponível do cliente.";
    }
    return null;
  })();
  const canSubmit = submitBlockReason === null;

  const discountBlockReason = (() => {
    if (!onApplyDiscount) return "A aplicação de desconto não está disponível neste fluxo.";
    if (isLoading) return "Aguarde o processamento atual.";
    if (!cliente) return "Selecione um cliente antes de aplicar o desconto.";
    if (isBilled) return "Pedidos faturados não aceitam desconto neste fluxo.";
    if (!canManageCommercialTerms) return "Seu perfil não permite conceder desconto.";
    if (!Number.isFinite(calculos.valorDesconto) || calculos.valorDesconto <= 0) return "Informe um desconto maior que zero.";
    if (calculos.valorDesconto > totalOriginal) return "O desconto não pode ser maior que o subtotal.";
    return null;
  })();
  const canApplyDiscount = discountBlockReason === null;

  const handleApplyDiscount = async () => {
    if (!canApplyDiscount || !onApplyDiscount) return;
    await onApplyDiscount(calculos.valorDesconto);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const recebido = parseCurrencyToNumber(valorRecebido);

    await onConfirm({
      pagoAgora,
      formaPagamento: pagoAgora ? formaPagamento : null,
      urgente,
      percentualUrgencia: urgente ? urgencyPercentage : 0,
      valorDesconto: calculos.valorDesconto,
      valorTotal: calculos.valorTotal,
      previsaoEntrega,
      receiptMode,
      deliveryMode,
      addressSnapshot: requiresAddress ? fulfillmentAddressSnapshot : undefined,
      motoristaId: requiresAddress && motoristaId ? motoristaId : undefined,
      veiculoId: requiresAddress && veiculoId ? veiculoId : undefined,
      parcelas: pagoAgora && formaPagamento === "CARTAO_CREDITO" ? parcelas : 1,
      valorPagamento: pagoAgora && formaPagamento && formaPagamento !== "FIDELIDADE" && formaPagamento !== "CREDITO_CLIENTE"
        ? valorPagamentoNumerico
        : undefined,
      valorRecebido: pagoAgora && formaPagamento === "DINHEIRO" ? recebido : undefined,
      troco: pagoAgora && formaPagamento === "DINHEIRO" ? troco : undefined,
      bandeira: pagoAgora && formaPagamento?.startsWith("CARTAO_") ? bandeira : undefined,
      nsu: pagoAgora && formaPagamento?.startsWith("CARTAO_") ? nsu.trim() || undefined : undefined,
      codigoAutorizacao: pagoAgora && formaPagamento?.startsWith("CARTAO_")
        ? codigoAutorizacao.trim() || undefined
        : undefined,
      pontosResgate: pagoAgora && formaPagamento === "FIDELIDADE" ? Number(pontosResgate) : undefined,
      valorCreditoAplicar: pagoAgora && formaPagamento === "CREDITO_CLIENTE" ? parseCurrencyToNumber(valorCredito) : undefined,
      pagamentos: formasAdicionais.length ? pagamentosCombinados : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pdv-compact-dialog pdv-payment-dialog border-strong bg-card">
        <DialogHeader className="pdv-payment-header">
          <DialogTitle className="font-black tracking-tight">Finalizar Venda</DialogTitle>
          <DialogDescription className="sr-only">Revise valores e a forma de pagamento antes de confirmar o ROL. Prazo, capacidade e logística foram definidos no atendimento.</DialogDescription>
        </DialogHeader>

        <div className="pdv-payment-body">
          {/* Resumo superior: cliente e itens */}
          <div className="pdv-payment-order-summary">
            <div className="rounded-lg border border-strong bg-card p-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="truncate text-base font-black tracking-tight">
                      {cliente?.nome_fantasia || cliente?.razao_social || "Cliente não selecionado"}
                    </p>
                    {cliente?.cpf_cnpj && <p className="text-xs text-muted-foreground">{cliente.cpf_cnpj}</p>}
                    {loyaltyLoading ? (
                      <p className="mt-1 text-xs text-muted-foreground">Consultando fidelidade...</p>
                    ) : loyalty?.programaAtivo ? (
                      <p className="mt-1 text-xs font-medium text-primary">Fidelidade: {loyalty.saldoPontos} pontos ({formatCurrency(loyalty.valorSaldo)})</p>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 border-l pl-3 text-right">
                  <p className="text-xl font-black text-primary">{formatCurrency(totalOriginal)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-strong bg-card p-2">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <p className="text-sm font-black">Itens do lançamento</p>
                </div>
                <span className="text-xs text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
              </div>
              <div className="pdv-payment-order-items">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.nome}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-strong bg-background px-2 py-1.5">
                    <span className="flex h-8 min-w-10 items-center justify-center rounded-md bg-primary px-2 text-xs font-black text-primary-foreground">{formatPaymentQuantity(item)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black uppercase">{item.nome}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{item.posicao_prateleira || "Sem posição informada"}</p>
                    </div>
                    <span className="text-sm font-black tabular-nums">{formatCurrency(item.preco * item.quantidade)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pdv-payment-notices">
          {termsLoading && <p role="status" className="text-sm text-muted-foreground">Carregando condições de pagamento. Aguarde para finalizar.</p>}
          {(termsError || termsMismatch) && <p role="alert" className="text-sm text-destructive">Não foi possível validar as condições deste cliente. Recarregue os dados antes de finalizar.</p>}
          {isBilled && <p className="text-sm text-muted-foreground">Será gerada uma pendência para fechamento no faturamento, sem recebimento imediato. Desconto e Lavagem Expressa estão indisponíveis neste fluxo para manter o valor do ROL igual ao lançamento. Nenhum boleto ou nota é emitido automaticamente aqui.</p>}
          {!canManageCommercialTerms && <p className="text-xs text-muted-foreground">Alterar configurações e conceder desconto exige permissão para gerenciar condições comerciais.</p>}
          {offlineMode && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">Modo offline: somente ROL sem recebimento. PIX, cartões, dinheiro, crédito do cliente e fidelidade serão liberados depois da reconexão.</p>}
          {!canReceivePayments && !offlineMode && <p role="alert" className="text-sm text-warning">Recebimentos indisponíveis: é necessário caixa disponível e permissão para receber. {isEntry ? "A condição de entrada exige recebimento; a finalização está bloqueada." : "Você pode finalizar sem recebimento imediato conforme a condição do cliente."}</p>}
          {offlineMode && isEntry && <p role="alert" className="text-sm text-destructive">Este cliente exige pagamento de entrada e, por segurança, o ROL só pode ser finalizado online.</p>}
          {isEntry && <p className="text-sm text-muted-foreground">Entrada exige o pagamento integral. Fidelidade está desabilitada porque o resgate pode deixar saldo pendente.</p>}
          </div>

          <div className="pdv-payment-discount rounded-lg border border-strong bg-muted/20 p-2.5">
            <Label className="flex items-center gap-2 text-sm font-bold"><Percent className="h-4 w-4 text-primary" /> Desconto</Label>
            <div className="flex gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-strong">
                <button disabled={!canManageCommercialTerms || isBilled} type="button" onClick={() => setDescontoTipo("percentual")} className={cn("px-3 py-1 text-sm font-bold transition-colors", descontoTipo === "percentual" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>%</button>
                <button disabled={!canManageCommercialTerms || isBilled} type="button" onClick={() => setDescontoTipo("valor")} className={cn("px-3 py-1 text-sm font-bold transition-colors", descontoTipo === "valor" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>R$</button>
              </div>
              {descontoTipo === "valor" ? (
                <CurrencyInput disabled={!canManageCommercialTerms || isBilled} value={descontoInput} onChange={(e) => setDescontoInput(e.target.value)} className="h-9 flex-1" />
              ) : (
                <Input disabled={!canManageCommercialTerms || isBilled} type="text" value={descontoInput} onChange={(e) => setDescontoInput(e.target.value)} placeholder="0" className="h-9 flex-1" />
              )}
            </div>
          </div>

          {!isBilled && <div className="pdv-payment-timing">
            <Label className="flex items-center gap-2 text-sm font-black">
              <CreditCard className="h-4 w-4 text-primary" />
              Momento do pagamento
            </Label>
            <div className="pdv-payment-timing-options">
              <button
                type="button"
                disabled={isEntry}
                onClick={() => { setPagoAgora(false); setFormaPagamento(null); }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  !pagoAgora
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Banknote className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black">Pagamento na retirada</span>
                    <span className="block text-xs text-muted-foreground">Quando retirar o pedido</span>
                  </span>
                </span>
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  !pagoAgora ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                )}>
                  {!pagoAgora && <Check className="h-4 w-4" />}
                </span>
              </button>
              <button
                type="button"
                disabled={!canReceivePayments}
                onClick={() => setPagoAgora(true)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  pagoAgora
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-black">Pagar agora</span>
                    <span className="block text-xs text-muted-foreground">No balcão agora</span>
                  </span>
                </span>
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  pagoAgora ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
                )}>
                  {!isBilled && pagoAgora && <Check className="h-4 w-4" />}
                </span>
              </button>
            </div>
          </div>}

          {/* Forma de Pagamento (se pagar agora) */}
          {!isBilled && pagoAgora && (
            <div className="pdv-payment-method-picker">
              <Label>Forma de pagamento</Label>
              <div className="pdv-payment-method-options">
                {FORMAS_PAGAMENTO.filter((forma) => forma.value !== "FIDELIDADE" || loyalty?.programaAtivo).map((forma) => (
                  <button
                    key={forma.value}
                    type="button"
                    disabled={!canReceivePayments || (isEntry && forma.value === "FIDELIDADE") || (forma.value === "FIDELIDADE" && (loyaltyLoading || loyaltyBelowMinimum)) || (forma.value === "CREDITO_CLIENTE" && (customerCreditLoading || Number(customerCredit?.saldo ?? 0) <= 0))}
                    onClick={() => {
                      setFormaPagamento(forma.value);
                      if (forma.value === "CREDITO_CLIENTE") {
                        setValorCredito(formatNumberToCurrency(Math.min(Number(customerCredit?.saldo ?? 0), calculos.valorTotal)));
                      }
                    }}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-50",
                      formaPagamento === forma.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    {forma.icon}
                    <span className="text-xs font-medium">{forma.label}</span>
                  </button>
                ))}
              </div>
              {loyaltyBelowMinimum && (
                <p className="mt-2 text-xs text-muted-foreground" role="status">
                  Resgate liberado a partir de {loyalty?.pontosMinimosResgate} pontos. Saldo atual: {loyalty?.saldoPontos} pontos.
                </p>
              )}
            </div>
          )}

          <div className="pdv-payment-details">
          {!isBilled && pagoAgora && formaPagamento && formaPagamento !== "FIDELIDADE" && formaPagamento !== "CREDITO_CLIENTE" && (
            <div className="pdv-payment-amount rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <Label htmlFor="pdv-payment-amount">Valor da entrada / pago agora</Label>
              <CurrencyInput
                id="pdv-payment-amount"
                value={valorPagamento}
                onChange={(event) => {
                  setValorPagamento(event.target.value);
                  if (formaPagamento === "DINHEIRO") setValorRecebido(event.target.value);
                }}
                className="h-9 text-base font-bold"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Informe quanto o cliente pagará agora. O saldo restante ficará pendente no ROL para recebimento posterior.
              </p>
              <p className="mt-1 text-xs font-semibold text-primary">
                Saldo restante do ROL: {formatCurrency(valorRestante)}
              </p>
              <div className="mt-2 space-y-2 border-t border-primary/20 pt-2">
                  {formasAdicionais.map((row, index) => (
                    <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,0.8fr)_auto] items-end gap-2">
                      <div className="space-y-1"><Label>Outra forma</Label><select aria-label={`Forma adicional ${index + 1}`} className="h-9 w-full rounded-md border border-strong bg-background px-2 text-sm" value={row.method} onChange={(event) => setFormasAdicionais((rows) => rows.map((item) => item.id === row.id ? { ...item, method: event.target.value as typeof item.method } : item))}><option value="DINHEIRO">Dinheiro</option><option value="PIX">PIX</option><option value="CARTAO_CREDITO">Crédito</option><option value="CARTAO_DEBITO">Débito</option></select></div>
                      <div className="space-y-1"><Label>Valor</Label><CurrencyInput value={row.amount} onChange={(event) => setFormasAdicionais((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} className="h-9" /></div>
                      <Button type="button" size="icon" variant="outline" aria-label="Remover forma adicional" onClick={() => setFormasAdicionais((rows) => rows.filter((item) => item.id !== row.id))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={formasAdicionais.length >= 3} onClick={() => setFormasAdicionais((rows) => [...rows, { id: crypto.randomUUID(), method: "PIX", amount: formatNumberToCurrency(0) }])}><Plus className="mr-1 h-4 w-4" />Adicionar forma</Button>
                    {formasAdicionais.length > 0 && <span className="text-xs font-semibold">Total dividido: {formatCurrency(totalCombinado)}</span>}
                  </div>
              </div>
            </div>
          )}

          {/* Cartão é apenas a classificação do recebimento; detalhes da maquininha ficam fora do ERP. */}

          {!isBilled && pagoAgora && (formaPagamento === "CARTAO_CREDITO" || formaPagamento === "CARTAO_DEBITO") && (
            <p className="pdv-payment-card-note rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
              Cartão registrado somente como forma de pagamento. Confirme a aprovação na maquininha; nenhum dado do cartão é solicitado ou armazenado.
            </p>
          )}

          {!isBilled && pagoAgora && formaPagamento === "PIX" && (
            <div className="pdv-payment-pix-note rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
              <p>Confirme o pagamento PIX na maquininha. O PDV registrará o valor e a forma de pagamento no caixa e no financeiro; não será gerada cobrança online nem QR Code.</p>
            </div>
          )}

          {!isBilled && pagoAgora && formaPagamento === "FIDELIDADE" && (
            <div className="pdv-payment-loyalty space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <Label htmlFor="sale-loyalty-points" className="flex items-center gap-2"><Gift className="h-4 w-4" /> Pontos para resgatar</Label>
              {loyaltyLoading ? (
                <p className="text-sm text-muted-foreground">Consultando saldo de pontos...</p>
              ) : !loyalty?.programaAtivo ? (
                <p className="text-sm text-muted-foreground">O programa de fidelidade está desativado para esta empresa.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Saldo disponível: <strong>{loyalty.saldoPontos} pontos</strong> ({formatCurrency(loyalty.valorSaldo)}). Mínimo: {loyalty.pontosMinimosResgate} pontos.
                  </p>
                  <Input id="sale-loyalty-points" type="number" min={loyalty.pontosMinimosResgate} max={loyalty.saldoPontos} step={1} value={pontosResgate} onChange={(event) => setPontosResgate(event.target.value)} placeholder={`Ex.: ${loyalty.pontosMinimosResgate}`} />
                  {pontosResgate && Number(pontosResgate) > 0 && (
                    <p className={cn("text-xs", canSubmit ? "text-muted-foreground" : "text-destructive")}>
                      Desconto estimado: {formatCurrency(Number(pontosResgate) * loyalty.valorPorPonto)}. O valor não pode ultrapassar o total da venda nem o saldo disponível.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Se o resgate não quitar tudo, o restante ficará pendente para outro pagamento.</p>
                </>
              )}
            </div>
          )}

          {/* Gaveta de Troco (apenas para dinheiro) */}
          {!isBilled && pagoAgora && formaPagamento === "DINHEIRO" && (
            <div className="pdv-payment-cash rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-1.5">
              <Label className="flex items-center gap-2 text-xs text-success">
                <Banknote className="w-4 h-4" />
                Valor Recebido
              </Label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <div>
                  <CurrencyInput
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="h-9 text-base font-bold"
                    autoFocus
                  />
                  <div className="mt-1 flex gap-1">
                    {[10, 20, 50, 100].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => {
                          const current = parseCurrencyToNumber(valorRecebido);
                          const next = current + v;
                          setValorRecebido(next.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }}
                      >
                        +{v}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-[100px] flex-col items-center justify-center rounded-md bg-success/10 px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">TROCO</p>
                  <p className={cn(
                    "text-lg font-bold",
                    troco > 0 ? "text-success" : "text-muted-foreground"
                  )}>
                    {formatCurrency(troco)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isBilled && pagoAgora && formaPagamento === "CREDITO_CLIENTE" && (
            <div className="pdv-payment-credit space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium text-primary"><Wallet className="h-4 w-4" /> Crédito disponível para abater</span>
                <strong>{customerCreditLoading ? "Consultando…" : formatCurrency(Number(customerCredit?.saldo ?? 0))}</strong>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pdv-credit-amount">Valor do crédito para abater neste ROL</Label>
                <CurrencyInput id="pdv-credit-amount" value={valorCredito} onChange={(event) => setValorCredito(event.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">O valor utilizado reduz o saldo do cliente e registra o abatimento neste ROL.</p>
              <p className="text-xs font-semibold text-primary">Saldo restante do ROL: {formatCurrency(valorRestante)}</p>
            </div>
          )}
          </div>

          {/* Resumo de Valores */}
          <div className="pdv-payment-value-summary">
            <div>
              <p className="text-xs text-muted-foreground">Subtotal</p>
              <p className="text-base font-black">{formatCurrency(calculos.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Desconto</p>
              <p className="text-base font-black text-success">-{formatCurrency(calculos.valorDesconto)}</p>
              {calculos.valorUrgencia > 0 && (
                <p className="text-xs font-semibold text-warning">Lavagem Expressa +{formatCurrency(calculos.valorUrgencia)}</p>
              )}
              {calculos.taxaEntrega > 0 && (
                <p className="text-xs font-semibold text-muted-foreground">Taxa de delivery +{formatCurrency(calculos.taxaEntrega)}</p>
              )}
              {!isBilled && pagoAgora && formaPagamento?.startsWith("CARTAO_") && <p className="text-xs text-muted-foreground">Cartão registrado como forma de pagamento.</p>}
            </div>
            <div className="rounded-md bg-primary/10 px-3 py-1.5 text-right">
              <p className="text-xs font-black tracking-wide text-muted-foreground">TOTAL</p>
              <p className="text-xl font-black text-primary">{formatCurrency(calculos.valorTotal)}</p>
            </div>
          </div>
        </div>

        <div className="pdv-payment-footer border-t bg-card/95 pt-2 backdrop-blur">
          {!adjustmentOnly && submitBlockReason && !isLoading && (
            <p role="alert" className="mb-3 flex items-start gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitBlockReason}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-9 px-4 text-sm font-bold"
          >
            Cancelar
          </Button>
          <Button 
            onClick={adjustmentOnly ? handleApplyDiscount : handleSubmit}
            disabled={adjustmentOnly ? !canApplyDiscount : !canSubmit || isLoading}
            className="h-9 min-w-[180px] gap-2 bg-success px-4 text-sm font-bold text-success-foreground hover:bg-success/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                {adjustmentOnly ? "Aplicar alteração" : offlineMode ? "Salvar ROL offline" : isBilled ? "Gerar pendência para fechamento" : "Finalizar Venda"}
              </>
            )}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
