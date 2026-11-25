import assert from "node:assert/strict";
import test from "node:test";
import { formatPrintQuantity } from "../src/lib/printQuantity.ts";

test("mostra quantidade de tapete por área, sem chamar de peças", () => {
  assert.equal(formatPrintQuantity(8.9375, "metro"), "8,9375 m²");
});

test("preserva a unidade de peso e unidade", () => {
  assert.equal(formatPrintQuantity(2.5, "kg"), "2,5 kg");
  assert.equal(formatPrintQuantity(3, "unidade"), "3 un.");
});

test("pluraliza somente quantidades contáveis sem unidade específica", () => {
  assert.equal(formatPrintQuantity(1, "peça"), "1 peça");
  assert.equal(formatPrintQuantity(2, "peça"), "2 peças");
});
