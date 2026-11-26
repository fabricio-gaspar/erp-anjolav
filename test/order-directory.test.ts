import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRolReportPayment,
  classifyRolReportStatus,
  hasActiveOrderDirectoryFilters,
  normalizeOrderDirectoryDate,
} from "../src/lib/orderDirectory.ts";

test("classifica os quatro grupos simplificados do relatório de ROLs", () => {
  assert.equal(classifyRolReportStatus("entregue"), "entregue");
  assert.equal(classifyRolReportStatus("retirada"), "retirado");
  assert.equal(classifyRolReportStatus("expedicao"), "a_retirar");
  assert.equal(classifyRolReportStatus("lavagem"), "nao_entregue");
  assert.equal(classifyRolReportStatus("cancelada"), "cancelado");
});

test("considera somente pagamento concluído como pago", () => {
  assert.equal(classifyRolReportPayment("pago"), "pago");
  assert.equal(classifyRolReportPayment("pendente"), "nao_pago");
  assert.equal(classifyRolReportPayment("parcial"), "nao_pago");
  assert.equal(classifyRolReportPayment(null), "nao_pago");
});

test("aceita somente datas válidas no formato do calendário", () => {
  assert.equal(normalizeOrderDirectoryDate("2026-11-13"), "2026-11-13");
  assert.equal(normalizeOrderDirectoryDate("2026-02-29"), "");
  assert.equal(normalizeOrderDirectoryDate("13/11/2026"), "");
  assert.equal(normalizeOrderDirectoryDate(null), "");
});

test("reconhece filtros de situação, pagamento e período", () => {
  const clean = {
    rolStatus: "all" as const,
    payment: "all" as const,
    dataInicio: "",
    dataFim: "",
  };

  assert.equal(hasActiveOrderDirectoryFilters(clean), false);
  assert.equal(hasActiveOrderDirectoryFilters({ ...clean, rolStatus: "a_retirar" }), true);
  assert.equal(hasActiveOrderDirectoryFilters({ ...clean, payment: "nao_pago" }), true);
  assert.equal(hasActiveOrderDirectoryFilters({ ...clean, dataInicio: "2026-11-01" }), true);
  assert.equal(hasActiveOrderDirectoryFilters({ ...clean, dataFim: "2026-11-30" }), true);
});
