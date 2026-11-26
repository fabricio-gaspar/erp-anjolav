import assert from "node:assert/strict";
import test from "node:test";
import { suggestBillingPeriod } from "./billingCycles.ts";

const billed = (frequency, closingDay = null, baseDate = null) => ({ condition: "faturado", frequency, closingDay, baseDate });

test("rolling cycles close exactly every 10 or 20 days", () => {
  assert.deepEqual(suggestBillingPeriod(billed("a_cada_10_dias", null, "2026-11-01"), "2026-11-25"), { start: "2026-11-11", end: "2026-11-20" });
  assert.deepEqual(suggestBillingPeriod(billed("a_cada_20_dias", null, "2026-11-01"), "2026-11-25"), { start: "2026-11-01", end: "2026-11-20" });
  assert.equal(suggestBillingPeriod(billed("a_cada_20_dias", null, "2026-11-20"), "2026-11-25"), null);
});

test("monthly and fortnightly periods handle shorter months", () => {
  assert.deepEqual(suggestBillingPeriod(billed("mensal", 31), "2026-03-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(suggestBillingPeriod(billed("quinzenal", 1), "2026-11-25"), { start: "2026-11-02", end: "2026-11-16" });
});

test("domestic immediate payments do not suggest a billing period", () => {
  assert.equal(suggestBillingPeriod({ condition: "retirada", frequency: "mensal", closingDay: 1, baseDate: null }, "2026-11-25"), null);
  assert.equal(suggestBillingPeriod(billed("avulso"), "2026-11-25"), null);
});
