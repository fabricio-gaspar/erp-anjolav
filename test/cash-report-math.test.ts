import assert from "node:assert/strict";
import test from "node:test";
import { hasCompleteCashPeriod, receiptsByOrder } from "../src/lib/cashReportMath.ts";

test("não inclui troco como receita nem pagamento em processamento", () => {
  const result = receiptsByOrder([
    { ordem_servico_id: "a", status: "CONFIRMADO", valor: 50, valor_recebido: 100 },
    { ordem_servico_id: "a", status: "PROCESSANDO", valor: 30, valor_recebido: 30 },
  ], [{ ordem_servico_id: "a", tipo: "VENDA", evento_pagamento: null, valor: 50 }]);
  assert.equal(result.get("a"), 50);
});

test("inclui movimentos legados apenas para pedidos sem pagamento registrado", () => {
  const result = receiptsByOrder([{ ordem_servico_id: "a", status: "CONFIRMADO", valor: 10, valor_recebido: 10 }], [
    { ordem_servico_id: "a", tipo: "VENDA", evento_pagamento: null, valor: 10 },
    { ordem_servico_id: "b", tipo: "RECEBIMENTO", evento_pagamento: null, valor: 7 },
    { ordem_servico_id: "b", tipo: "RECEBIMENTO", evento_pagamento: null, valor: 3 },
  ]);
  assert.equal(result.get("a"), 10);
  assert.equal(result.get("b"), 10);
});

test("não apresenta saldo de caixa quando a abertura está fora do período", () => {
  assert.equal(hasCompleteCashPeriod([{ data_abertura: "2026-11-19T10:00:00Z", data_fechamento: null }], "2026-11-22T03:00:00Z", "2026-11-23T03:00:00Z"), false);
  assert.equal(hasCompleteCashPeriod([{ data_abertura: "2026-11-22T10:00:00Z", data_fechamento: "2026-11-22T18:00:00Z" }], "2026-11-22T03:00:00Z", "2026-11-23T03:00:00Z"), true);
});
