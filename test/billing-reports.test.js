import test from "node:test";
import assert from "node:assert/strict";
import { buildBillingReport } from "../src/lib/billingReports.ts";

const item = (rol, date, product, quantity, unitPrice, total) => ({
  numero_rol: rol, data_rol: date, produto: product, quantidade: quantity,
  unidade: "peça", valor_unitario: unitPrice, valor_total: total,
});
const items = [item("1", "2026-11-01", "Lençol", 2, 10, 20),
  item("2", "2026-11-15", "Lençol", 3, 10, 30),
  item("3", "2026-11-15", "Lençol", 1, 12, 12),
  item("3", "2026-11-15", "Taxa de delivery", 1, 5, 5)];

test("mapa de peças mantém cada ROL e inclui a taxa", () => {
  const report = buildBillingReport(items, "mapa_pecas");
  assert.equal(report.rows.length, 4);
  assert.deepEqual(report.rows[0], ["1", "01/11/2026", "Lençol", 2, "peça", "10.00", "20.00"]);
  assert.equal(report.rows[3][2], "Taxa de delivery");
});

test("mapa mensal separa preços e distribui quantidades pelas datas", () => {
  const report = buildBillingReport(items, "mapa_mensal");
  assert.deepEqual(report.headers.slice(2, 4), ["01/11/2026", "15/11/2026"]);
  assert.deepEqual(report.rows[0], ["Lençol", "peça", 2, 3, 5, "10.00", "50.00"]);
  assert.deepEqual(report.rows[1], ["Lençol", "peça", 0, 1, 1, "12.00", "12.00"]);
  assert.equal(report.rows.reduce((sum, row) => sum + Number(row.at(-1)), 0), 67);
  assert.deepEqual(buildBillingReport(items, "detalhado"), report);
});

test("modelo desconhecido é recusado e modelo legado permanece disponível", () => {
  assert.throws(() => buildBillingReport(items, "desconhecido"));
  assert.equal(buildBillingReport(items, "mapa").rows.length, 3);
});
