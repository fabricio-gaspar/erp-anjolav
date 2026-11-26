import test from "node:test";
import assert from "node:assert/strict";
import { totalMonthlySales } from "../src/lib/monthlyReportMath.ts";

test("resultado mensal desconta estornos e inclui vendas antigas sem evento", () => {
  assert.equal(totalMonthlySales([
    {valor: 50, evento_pagamento: "CONFIRMACAO"},
    {valor: 20, evento_pagamento: "ESTORNO"},
    {valor: 10, evento_pagamento: null},
    {valor: 5, evento_pagamento: null, tipo: "ESTORNO"},
  ]), 35);
});
