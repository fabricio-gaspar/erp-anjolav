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
import { parseCurrencyToNumber } from "@/lib/currencyUtils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Percent,
  Calculator,
  Gift,
  MapPin,
  UserRound,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CARD_BRANDS } from "@/lib/pdvPayment";
import { validarCpfCnpj } from "@/lib/validacoesFiscais";
import type { PdvLoyaltySummary } from "@/hooks/usePdvPayments";
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

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
  classificacao?: "industrial" | "residencial";
}

interface PagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  cliente: Cliente | null;
  totalOriginal: number;
  totalItems: number;
  loyalty: PdvLoyaltySummary | null;
  loyaltyLoading?: boolean;
  configuracaoPagamento?: ConfiguracaoPagamentoCliente | null;
  canManageCommercialTerms?: boolean;
  /** The parent must pass false whenever the cash register is unavailable. */
  canReceivePayments?: boolean;
  termsLoading?: boolean;
  termsError?: boolean;
  fulfillment: PdvFulfillmentSettings;
  fulfillmentAddressSnapshot?: DadosPagamento["addressSnapshot"];
  fulfillmentBlockReason?: string | null;
  /** A escolha rápida é só uma preferência visual; as regras comerciais ainda são validadas neste modal e no servidor. */
  initialSelection?: {
    pagoAgora: boolean;
    formaPagamento: PdvPaymentMethod | null;
  } | null;
  onConfirm: (dados: DadosPagamento) => Promise<void>;
  isLoading?: boolean;
}

export interface DadosPagamento {
  pagoAgora: boolean;
  formaPagamento: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "FIDELIDADE" | null;
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
  valorRecebido?: number;
  troco?: number;
  bandeira?: string;
  nsu?: string;
  codigoAutorizacao?: string;
  pontosResgate?: number;
}

export type PdvPaymentMethod = "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "FIDELIDADE";
type FormaPagamento = PdvPaymentMethod;

const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string; icon: React.ReactNode }[] = [
  { value: "DINHEIRO", label: "Dinheiro", icon: <Banknote className="w-5 h-5" /> },
  { value: "PIX", label: "PIX", icon: <Smartphone className="w-5 h-5" /> },
  { value: "CARTAO_CREDITO", label: "Crédito", icon: <CreditCard className="w-5 h-5" /> },
  { value: "CARTAO_DEBITO", label: "Débito", icon: <CreditCard className="w-5 h-5" /> },
  { value: "FIDELIDADE", label: "Pontos", icon: <Gift className="w-5 h-5" /> },
];

const PARCELAS_OPCOES = [1, 2, 3, 4, 5, 6, 10, 12];

const PERCENTUAL_URGENCIA_PADRAO = 30;

export function PagamentoModal(props: PagamentoModalProps) {
  // Reset payment evidence and adjustments whenever the customer or terms change.
  const config = props.configuracaoPagamento;
  const formKey = JSON.stringify([
    props.open, props.cliente?.id, props.termsLoading, props.termsError,
    config?.cliente_id, config?.condicao_pagamento, config?.forma_pagamento,
    config?.tipo_faturamento, config?.dia_fechamento, config?.dia_vencimento,
    props.canReceivePayments, props.canManageCommercialTerms,
    props.initialSelection?.pagoAgora, props.initialSelection?.formaPagamento,
  ]);
  return <PagamentoModalForm key={formKey} {...props} />;
}

function PagamentoModalForm({
  open,
  onOpenChange,
  cart,
  cliente,
  totalOriginal,
  totalItems,
  loyalty,
  loyaltyLoading = false,
  configuracaoPagamento = null,
  canManageCommercialTerms = false,
  canReceivePayments = true,
  termsLoading = false,
  termsError = false,
  fulfillment,
  fulfillmentAddressSnapshot,
  fulfillmentBlockReason = null,
  initialSelection = null,
  onConfirm,
  isLoading = false,
}: PagamentoModalProps) {
  const termsMismatch = !!configuracaoPagamento && configuracaoPagamento.cliente_id !== cliente?.id;
  const terms = parseCustomerPaymentTerms(termsMismatch ? null : configuracaoPagamento);
  const isBilled = terms.condition === "faturado";
  const isEntry = terms.condition === "entrada";
  const customerInitialPayment = initialCustomerPayment(terms);
  const initialPayment = initialSelection && !isBilled
    ? {
        pagoAgora: initialSelection.pagoAgora,
        formaPagamento: initialSelection.pagoAgora ? initialSelection.formaPagamento : null,
      }
    : customerInitialPayment;
  const [pagoAgora, setPagoAgora] = useState(initialPayment.pagoAgora);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(initialPayment.formaPagamento);
  const [descontoTipo, setDescontoTipo] = useState<"percentual" | "valor">("percentual");
  const [descontoInput, setDescontoInput] = useState("");
  // Novos estados para parcelamento e troco
  const [parcelas, setParcelas] = useState(1);
  const [valorRecebido, setValorRecebido] = useState("");
  const [bandeira, setBandeira] = useState("");
  const [nsu, setNsu] = useState("");
  const [codigoAutorizacao, setCodigoAutorizacao] = useState("");
  const [pontosResgate, setPontosResgate] = useState("");
  const { deliveryDate: previsaoEntrega, urgent: urgente, receiptMode, deliveryMode, driverId: motoristaId, vehicleId: veiculoId } = fulfillment;

  // Reset parcelas when payment method changes
  useEffect(() => {
    if (formaPagamento !== "CARTAO_CREDITO") {
      setParcelas(1);
    }
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
    const valorUrgencia = urgente ? (subtotalComDesconto * PERCENTUAL_URGENCIA_PADRAO) / 100 : 0;
    const valorTotal = subtotalComDesconto + valorUrgencia;

    return {
      subtotal: totalOriginal,
      valorDesconto,
      valorUrgencia,
      valorTotal: Math.max(0, valorTotal),
    };
  }, [totalOriginal, descontoInput, descontoTipo, urgente]);

  // Calcular troco
  const troco = useMemo(() => {
    if (formaPagamento !== "DINHEIRO" || !valorRecebido) return 0;
    const recebido = parseCurrencyToNumber(valorRecebido);
    return Math.max(0, recebido - calculos.valorTotal);
  }, [valorRecebido, calculos.valorTotal, formaPagamento]);

  // Valor da parcela
  const valorParcela = useMemo(() => {
    return calculos.valorTotal / parcelas;
  }, [calculos.valorTotal, parcelas]);

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
    if (isBilled && (urgente || calculos.valorDesconto > 0)) return "Pedidos faturados não aceitam urgência ou desconto neste fluxo.";
    if (!canManageCommercialTerms && calculos.valorDesconto > 0) return "Seu perfil não permite conceder desconto.";
    if (!Number.isFinite(calculos.valorTotal) || !Number.isFinite(calculos.valorDesconto)) return "Revise os valores da venda.";
    if (calculos.valorDesconto > totalOriginal) return "O desconto não pode ser maior que o subtotal.";
    if (calculos.valorTotal <= 0) return "O total da venda deve ser maior que zero.";
    if (pagoAgora && formaPagamento === "DINHEIRO") {
      const recebido = parseCurrencyToNumber(valorRecebido);
      if (!Number.isFinite(recebido) || recebido < calculos.valorTotal) return "Informe um valor recebido igual ou maior que o total.";
    }
    if (pagoAgora && formaPagamento === "PIX") {
      if (!cliente.cpf_cnpj || !validarCpfCnpj(cliente.cpf_cnpj).valid) return "Cadastre um CPF/CNPJ válido no cliente para gerar o PIX.";
    }
    if (pagoAgora && (formaPagamento === "CARTAO_CREDITO" || formaPagamento === "CARTAO_DEBITO")) {
      if (!bandeira || (!nsu.trim() && !codigoAutorizacao.trim())) {
        return !bandeira
          ? "Selecione a bandeira do cartão."
          : "Informe o NSU ou o código de autorização da maquininha.";
      }
    }
    if (pagoAgora && formaPagamento === "FIDELIDADE") {
      const pontos = Number(pontosResgate);
      const valorResgate = pontos * Number(loyalty?.valorPorPonto ?? 0);
      if (loyaltyLoading) return "Aguarde a consulta do saldo de fidelidade.";
      if (!loyalty?.programaAtivo) return "O programa de fidelidade não está ativo.";
      if (!Number.isInteger(pontos) || pontos < loyalty.pontosMinimosResgate || pontos > loyalty.saldoPontos) return "Informe uma quantidade válida de pontos dentro do saldo disponível.";
      if (valorResgate <= 0 || valorResgate > calculos.valorTotal + 0.009) return "O resgate não pode ultrapassar o total da venda.";
    }
    return null;
  })();
  const canSubmit = submitBlockReason === null;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const recebido = parseCurrencyToNumber(valorRecebido);

    await onConfirm({
      pagoAgora,
      formaPagamento: pagoAgora ? formaPagamento : null,
      urgente,
      percentualUrgencia: urgente ? PERCENTUAL_URGENCIA_PADRAO : 0,
      valorDesconto: calculos.valorDesconto,
      valorTotal: calculos.valorTotal,
      previsaoEntrega,
      receiptMode,
      deliveryMode,
      addressSnapshot: requiresAddress ? fulfillmentAddressSnapshot : undefined,
      motoristaId: requiresAddress && motoristaId ? motoristaId : undefined,
      veiculoId: requiresAddress && veiculoId ? veiculoId : undefined,
      parcelas: pagoAgora && formaPagamento === "CARTAO_CREDITO" ? parcelas : 1,
      valorRecebido: pagoAgora && formaPagamento === "DINHEIRO" ? recebido : undefined,
      troco: pagoAgora && formaPagamento === "DINHEIRO" ? troco : undefined,
      bandeira: pagoAgora && formaPagamento?.startsWith("CARTAO_") ? bandeira : undefined,
      nsu: pagoAgora && formaPagamento?.startsWith("CARTAO_") ? nsu.trim() || undefined : undefined,
      codigoAutorizacao: pagoAgora && formaPagamento?.startsWith("CARTAO_")
        ? codigoAutorizacao.trim() || undefined
        : undefined,
      pontosResgate: pagoAgora && formaPagamento === "FIDELIDADE" ? Number(pontosResgate) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-[1200px] xl:max-w-[1320px] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-2xl border-strong bg-card p-4 sm:p-6">
        <DialogHeader className="mb-1">
          <DialogTitle className="text-2xl font-black tracking-tight sm:text-3xl">Finalizar Venda</DialogTitle>
          <DialogDescription className="sr-only">Revise valores e a forma de pagamento antes de confirmar o ROL. Prazo, capacidade e logística foram definidos no atendimento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Resumo superior: cliente e itens */}
          <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr]">
            <div className="rounded-xl border border-strong bg-card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="truncate text-xl font-black tracking-tight">
                      {cliente?.nome_fantasia || cliente?.razao_social || "Cliente não selecionado"}
                    </p>
                    {cliente?.cpf_cnpj && <p className="text-sm text-muted-foreground">{cliente.cpf_cnpj}</p>}
                    {loyaltyLoading ? (
                      <p className="mt-1 text-sm text-muted-foreground">Consultando fidelidade...</p>
                    ) : loyalty?.programaAtivo ? (
                      <p className="mt-1 text-sm font-medium text-primary">Fidelidade: {loyalty.saldoPontos} pontos ({formatCurrency(loyalty.valorSaldo)})</p>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 border-l pl-4 text-right">
                  <p className="text-sm text-muted-foreground">{totalItems} {totalItems === 1 ? "peça" : "peças"}</p>
                  <p className="text-2xl font-black text-primary">{formatCurrency(totalOriginal)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-strong bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-6 w-6 text-primary" />
                  <p className="text-lg font-black">Itens do lançamento</p>
                </div>
                <span className="text-sm text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
              </div>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={`${item.id}-${item.nome}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-strong bg-background px-3 py-2.5">
                    <span className="flex h-10 min-w-12 items-center justify-center rounded-lg bg-primary px-2 text-sm font-black text-primary-foreground">{item.quantidade}x</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase">{item.nome}</p>
                      <p className="flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{item.posicao_prateleira || "Sem posição informada"}</p>
                    </div>
                    <span className="text-base font-black tabular-nums">{formatCurrency(item.preco * item.quantidade)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {termsLoading && <p role="status" className="text-sm text-muted-foreground">Carregando condições de pagamento. Aguarde para finalizar.</p>}
          {(termsError || termsMismatch) && <p role="alert" className="text-sm text-destructive">Não foi possível validar as condições deste cliente. Recarregue os dados antes de finalizar.</p>}
          {isBilled && <p className="text-sm text-muted-foreground">Será gerada uma pendência para fechamento no faturamento, sem recebimento imediato. Desconto e urgência estão indisponíveis neste fluxo para manter o valor da OS igual ao lançamento. Nenhum boleto ou nota é emitido automaticamente aqui.</p>}
          {!canManageCommercialTerms && <p className="text-xs text-muted-foreground">Alterar configurações e conceder desconto exige permissão para gerenciar condições comerciais.</p>}
          {!canReceivePayments && <p role="alert" className="text-sm text-warning">Recebimentos indisponíveis: é necessário caixa disponível e permissão para receber. {isEntry ? "A condição de entrada exige recebimento; a finalização está bloqueada." : "Você pode finalizar sem recebimento imediato conforme a condição do cliente."}</p>}
          {isEntry && <p className="text-sm text-muted-foreground">Entrada exige o pagamento integral. Fidelidade está desabilitada porque o resgate pode deixar saldo pendente.</p>}

          <div className="space-y-2 rounded-xl border border-strong bg-muted/20 p-3">
            <Label className="flex items-center gap-2 text-base font-bold"><Percent className="h-5 w-5 text-primary" /> Desconto</Label>
            <p className="text-xs text-muted-foreground">O prazo, capacidade, urgência e logística foram definidos antes deste resumo.</p>
            <div className="flex gap-2">
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-strong">
                <button disabled={!canManageCommercialTerms || isBilled} type="button" onClick={() => setDescontoTipo("percentual")} className={cn("px-4 py-2 text-base font-bold transition-colors", descontoTipo === "percentual" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>%</button>
                <button disabled={!canManageCommercialTerms || isBilled} type="button" onClick={() => setDescontoTipo("valor")} className={cn("px-4 py-2 text-base font-bold transition-colors", descontoTipo === "valor" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>R$</button>
              </div>
              {descontoTipo === "valor" ? (
                <CurrencyInput disabled={!canManageCommercialTerms || isBilled} value={descontoInput} onChange={(e) => setDescontoInput(e.target.value)} className="h-12 flex-1" />
              ) : (
                <Input disabled={!canManageCommercialTerms || isBilled} type="text" value={descontoInput} onChange={(e) => setDescontoInput(e.target.value)} placeholder="0" className="h-12 flex-1" />
              )}
            </div>
          </div>

          <Separator className="my-1" />
          {!isBilled && <div className="space-y-2">
            <Label className="flex items-center gap-2 text-lg font-black">
              <CreditCard className="h-5 w-5 text-primary" />
              Momento do pagamento
            </Label>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                disabled={isEntry}
                onClick={() => { setPagoAgora(false); setFormaPagamento(null); }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  !pagoAgora
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Banknote className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-black">Pagamento na retirada</span>
                    <span className="block text-sm text-muted-foreground">Quando retirar o pedido</span>
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
                  "flex items-center justify-between gap-3 rounded-xl border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50",
                  pagoAgora
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CreditCard className="h-6 w-6" />
                  </span>
                  <span>
                    <span className="block text-base font-black">Pagar agora</span>
                    <span className="block text-sm text-muted-foreground">No balcão agora</span>
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
            <div className="space-y-3">
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {FORMAS_PAGAMENTO.filter((forma) => forma.value !== "FIDELIDADE" || (cliente?.classificacao !== "industrial" && loyalty?.programaAtivo)).map((forma) => (
                  <button
                    key={forma.value}
                    type="button"
                    disabled={!canReceivePayments || (isEntry && forma.value === "FIDELIDADE")}
                    onClick={() => setFormaPagamento(forma.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all disabled:cursor-not-allowed disabled:opacity-50",
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
            </div>
          )}

          {/* Parcelamento (apenas para crédito) */}
          {!isBilled && pagoAgora && formaPagamento === "CARTAO_CREDITO" && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Parcelas
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {PARCELAS_OPCOES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setParcelas(n)}
                    className={cn(
                      "p-2 rounded-lg border-2 text-center transition-all",
                      parcelas === n
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <p className="font-bold text-sm">{n}x</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatCurrency(calculos.valorTotal / n)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isBilled && pagoAgora && (formaPagamento === "CARTAO_CREDITO" || formaPagamento === "CARTAO_DEBITO") && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div>
                <Label>Bandeira</Label>
                <Select value={bandeira} onValueChange={setBandeira}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a bandeira" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_BRANDS.map((brand) => (
                      <SelectItem key={brand.value} value={brand.value}>{brand.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pdv-nsu">NSU</Label>
                  <Input
                    id="pdv-nsu"
                    value={nsu}
                    onChange={(event) => setNsu(event.target.value)}
                    maxLength={100}
                    placeholder="Número do comprovante"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pdv-autorizacao">Código de autorização</Label>
                  <Input
                    id="pdv-autorizacao"
                    value={codigoAutorizacao}
                    onChange={(event) => setCodigoAutorizacao(event.target.value)}
                    maxLength={100}
                    placeholder="Código da maquininha"
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Confirme a aprovação na maquininha e informe ao menos o NSU ou o código de autorização.
                O sistema não solicita nem armazena número, validade ou CVV do cartão.
              </p>
            </div>
          )}

          {!isBilled && pagoAgora && formaPagamento === "PIX" && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
              {cliente?.cpf_cnpj && validarCpfCnpj(cliente.cpf_cnpj).valid ? (
                <p>Será gerado um QR Code dinâmico com a conta e o valor exato. A baixa ocorrerá somente após a confirmação do provedor.</p>
              ) : (
                <p className="text-destructive">Cadastre um CPF/CNPJ válido no cliente para gerar o PIX dinâmico.</p>
              )}
            </div>
          )}

          {!isBilled && pagoAgora && formaPagamento === "FIDELIDADE" && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
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
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
              <Label className="flex items-center gap-2 text-success">
                <Banknote className="w-4 h-4" />
                Valor Recebido
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <CurrencyInput
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="text-lg font-bold h-12"
                    autoFocus
                  />
                  <div className="flex gap-1 mt-2">
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
                <div className="flex flex-col items-center justify-center bg-success/10 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">TROCO</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    troco > 0 ? "text-success" : "text-muted-foreground"
                  )}>
                    {formatCurrency(troco)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator className="my-1" />

          {/* Resumo de Valores */}
          <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-[1fr_1fr_1.25fr] sm:items-center">
            <div>
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-lg font-black">{formatCurrency(calculos.subtotal)}</p>
            </div>
            <div className="border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <p className="text-sm text-muted-foreground">Desconto</p>
              <p className="text-lg font-black text-success">-{formatCurrency(calculos.valorDesconto)}</p>
              {calculos.valorUrgencia > 0 && (
                <p className="text-xs font-semibold text-warning">Urgência +{formatCurrency(calculos.valorUrgencia)}</p>
              )}
              {!isBilled && pagoAgora && formaPagamento === "CARTAO_CREDITO" && parcelas > 1 && (
                <p className="text-xs text-muted-foreground">{parcelas}x de {formatCurrency(valorParcela)}</p>
              )}
            </div>
            <div className="rounded-lg bg-primary/10 px-4 py-2 sm:text-right">
              <p className="text-sm font-black tracking-wide text-muted-foreground">TOTAL</p>
              <p className="text-2xl font-black text-primary">{formatCurrency(calculos.valorTotal)}</p>
            </div>
          </div>
        </div>

        <div className="sticky -bottom-4 -mx-4 mt-1 border-t bg-card/95 px-4 pb-4 pt-3 backdrop-blur sm:-bottom-6 sm:-mx-6 sm:px-6 sm:pb-6">
          {submitBlockReason && !isLoading && (
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
            className="h-12 px-6 text-base font-bold"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit || isLoading}
            className="h-12 min-w-[220px] gap-2 bg-success px-6 text-base font-bold text-success-foreground hover:bg-success/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                {isBilled ? "Gerar pendência para fechamento" : pagoAgora && formaPagamento === "PIX" ? "Criar OS e gerar PIX" : "Finalizar Venda"}
              </>
            )}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
