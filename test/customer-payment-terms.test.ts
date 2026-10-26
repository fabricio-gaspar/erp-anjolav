import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomerPaymentTerms, customerPaymentTermsLabels, customerPaymentTermsToConfig,
  initialCustomerPayment, isCustomerPaymentAllowed, PAYMENT_METHOD_LABELS, customerPaymentMethodError,
} from "../src/lib/customerPaymentTerms.ts";

test("ausência, condições desconhecidas e mensal legado não autorizam faturamento", () => {
  for (const config of [undefined, null, {},
    { condicao_pagamento: null, tipo_faturamento: "mensal", dia_fechamento: 1 },
    { condicao_pagamento: "30 dias", tipo_faturamento: "quinzenal" },
    { condicao_pagamento: "constructor", forma_pagamento: "toString" },
  ]) {
    const terms = parseCustomerPaymentTerms(config);
    assert.equal(terms.condition, "retirada");
    assert.equal(terms.conditionConfigured, false);
    assert.equal(terms.frequency, "avulso");
    assert.equal(terms.closingDay, null);
    assert.equal(initialCustomerPayment(terms).pagoAgora, false);
    assert.match(customerPaymentTermsLabels(terms).condition, /Não configurada/);
    assert.equal(customerPaymentTermsLabels(terms).frequency, null);
  }
});

test("cadastro permite boleto e transferência somente com condição faturado", () => {
  for (const condition of ["entrada", "retirada", "faturado", null] as const) {
    for (const method of ["boleto", "transferencia"] as const) {
      assert.equal(customerPaymentMethodError(condition, method), condition === "faturado" ? null : "Boleto/transferência exigem condição Faturado");
    }
    for (const method of ["dinheiro", "pix", "cartao_credito", "cartao_debito", null] as const) {
      assert.equal(customerPaymentMethodError(condition, method), null);
    }
  }
});

test("validação de salvamento não altera a condição nem o método de um cadastro legado", () => {
  for (const condition of ["entrada", "retirada", null] as const) {
    for (const method of ["boleto", "transferencia"] as const) {
      const config = Object.freeze({ condicao_pagamento: condition, forma_pagamento: method });
      const terms = parseCustomerPaymentTerms(config);
      assert.equal(terms.condition, condition ?? "retirada");
      assert.equal(terms.conditionConfigured, condition !== null);
      assert.equal(terms.preferredMethod, method);
      assert.equal(customerPaymentMethodError(terms.condition, terms.preferredMethod), "Boleto/transferência exigem condição Faturado");
      assert.deepEqual(parseCustomerPaymentTerms(config), terms);
    }
  }
});

test("periodicidade explícita prevalece sobre o dia, inclusive mensal no dia 16", () => {
  for (const [frequency, closingDay] of [["mensal", 16], ["quinzenal", 5], ["avulso", null]] as const) {
    const config = { condicao_pagamento: "faturado", tipo_faturamento: frequency, dia_fechamento: closingDay, dia_vencimento: 31, forma_pagamento: "boleto" };
    const terms = parseCustomerPaymentTerms(config);
    assert.equal(terms.frequency, frequency);
    assert.equal(terms.closingDay, closingDay);
    assert.deepEqual(customerPaymentTermsToConfig(terms), config);
    assert.equal(initialCustomerPayment(terms).pagoAgora, false);
    assert.equal(initialCustomerPayment(terms).formaPagamento, null);
  }
});

test("dias inválidos e periodicidade desconhecida não inventam calendário", () => {
  for (const invalid of [-1, 0, 32, 1.5, NaN, Infinity]) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: "faturado", tipo_faturamento: "mensal", dia_fechamento: invalid, dia_vencimento: invalid });
    assert.equal(terms.closingDay, null);
    assert.equal(terms.dueDay, null);
  }
  const terms = parseCustomerPaymentTerms({ condicao_pagamento: "faturado", tipo_faturamento: "semanal", dia_fechamento: 16 });
  assert.equal(terms.frequency, "avulso");
  assert.equal(terms.closingDay, null);
});

test("entrada seleciona apenas os quatro métodos imediatos suportados", () => {
  for (const [preferred, immediate] of [
    ["dinheiro", "DINHEIRO"], ["pix", "PIX"], ["cartao_credito", "CARTAO_CREDITO"], ["cartao_debito", "CARTAO_DEBITO"],
  ]) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: "entrada", forma_pagamento: preferred });
    assert.deepEqual(initialCustomerPayment(terms), { pagoAgora: true, formaPagamento: immediate, unsupportedPreference: false });
    assert.equal(isCustomerPaymentAllowed(terms, initialCustomerPayment(terms)), true);
  }
});

test("boleto e transferência na entrada exigem seleção de um fluxo suportado", () => {
  for (const preferred of ["boleto", "transferencia"]) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: "entrada", forma_pagamento: preferred });
    assert.deepEqual(initialCustomerPayment(terms), { pagoAgora: true, formaPagamento: null, unsupportedPreference: true });
    assert.equal(isCustomerPaymentAllowed(terms, initialCustomerPayment(terms)), false);
    assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: true, formaPagamento: preferred.toUpperCase() }), false);
    assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: true, formaPagamento: "DINHEIRO" }), true);
  }
});

test("preferência ausente ou inválida não seleciona nem confirma um recebimento", () => {
  for (const preferred of [null, "cheque", "FIDELIDADE", "constructor"]) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: "entrada", forma_pagamento: preferred });
    assert.equal(terms.preferredMethod, null);
    assert.equal(initialCustomerPayment(terms).formaPagamento, null);
    assert.equal(isCustomerPaymentAllowed(terms, initialCustomerPayment(terms)), false);
  }
});

test("retirada inicia pendente apesar da preferência e permite antecipar", () => {
  const terms = parseCustomerPaymentTerms({ condicao_pagamento: "retirada", forma_pagamento: "pix" });
  assert.equal(initialCustomerPayment(terms).pagoAgora, false);
  assert.equal(initialCustomerPayment(terms).formaPagamento, null);
  assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: false, formaPagamento: null }), true);
  assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: true, formaPagamento: "PIX" }), true);
  assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: false, formaPagamento: "PIX" }), false);
});

test("faturado nunca aceita meios imediatos, mesmo com caixa disponível", () => {
  const terms = parseCustomerPaymentTerms({ condicao_pagamento: "faturado", forma_pagamento: "dinheiro" });
  assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: false, formaPagamento: null, canReceivePayments: false }), true);
  for (const method of [null, "PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "FIDELIDADE"]) {
    assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: true, formaPagamento: method }), false);
  }
  assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: false, formaPagamento: "PIX" }), false);
});

test("caixa indisponível bloqueia recebimentos e entrada, preservando retirada pendente", () => {
  for (const condition of ["entrada", "retirada"]) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: condition });
    for (const method of ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO", "FIDELIDADE"]) {
      assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: true, formaPagamento: method, canReceivePayments: false }), false);
    }
    assert.equal(isCustomerPaymentAllowed(terms, { pagoAgora: false, formaPagamento: null, canReceivePayments: false }), condition === "retirada");
  }
});

test("entrada proíbe fidelidade e postergação, retirada mantém o fluxo de pontos", () => {
  const entry = parseCustomerPaymentTerms({ condicao_pagamento: "entrada" });
  assert.equal(isCustomerPaymentAllowed(entry, { pagoAgora: false, formaPagamento: null }), false);
  assert.equal(isCustomerPaymentAllowed(entry, { pagoAgora: true, formaPagamento: "FIDELIDADE" }), false);
  const pickup = parseCustomerPaymentTerms({ condicao_pagamento: "retirada" });
  assert.equal(isCustomerPaymentAllowed(pickup, { pagoAgora: true, formaPagamento: "FIDELIDADE" }), true);
});

test("salvar entrada ou retirada remove periodicidade e dias de faturamento antigos", () => {
  const billed = parseCustomerPaymentTerms({ condicao_pagamento: "faturado", forma_pagamento: "pix", tipo_faturamento: "quinzenal", dia_fechamento: 16, dia_vencimento: 20 });
  for (const condition of ["entrada", "retirada"] as const) {
    assert.deepEqual(customerPaymentTermsToConfig({ ...billed, condition }), {
      condicao_pagamento: condition, forma_pagamento: "pix", tipo_faturamento: "avulso", dia_fechamento: null, dia_vencimento: null,
    });
  }
});

test("rótulos cobrem os seis métodos e não inferem periodicidade fora de faturado", () => {
  for (const [method, label] of Object.entries(PAYMENT_METHOD_LABELS)) {
    const terms = parseCustomerPaymentTerms({ condicao_pagamento: "retirada", forma_pagamento: method, tipo_faturamento: "mensal" });
    assert.equal(customerPaymentTermsLabels(terms).preferredMethod, label);
    assert.equal(customerPaymentTermsLabels(terms).condition, "Pagamento na retirada");
    assert.equal(customerPaymentTermsLabels(terms).frequency, null);
  }
});
