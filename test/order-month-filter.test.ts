import test from "node:test";
import assert from "node:assert/strict";
import { orderMonthRange } from "../src/lib/orderMonthFilter.ts";

test("filtra o mês de entrada completo, incluindo fevereiro bissexto", () => {
  assert.deepEqual(orderMonthRange("2026-11"), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(orderMonthRange("2024-02"), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(orderMonthRange("2100-02"), { from: "2100-02-01", to: "2100-02-28" });
  assert.deepEqual(orderMonthRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
  assert.equal(orderMonthRange(""), null);
  assert.equal(orderMonthRange("2026-13"), null);
});
