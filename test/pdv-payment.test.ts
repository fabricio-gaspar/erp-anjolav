import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateChange,
  createPdvIdempotencyKey,
  isPixConfirmed,
  isPixTerminal,
} from "../src/lib/pdvPayment.ts";

test("calcula troco em centavos sem expor arredondamento binário", () => {
  assert.equal(calculateChange(19.9, 20), 0.1);
  assert.equal(calculateChange(41.37, 50), 8.63);
  assert.equal(calculateChange(50, 40), 0);
});

test("gera chaves de idempotência distintas e compatíveis com o backend", () => {
  const first = createPdvIdempotencyKey("sale");
  const second = createPdvIdempotencyKey("sale");
  assert.match(first, /^pdv:sale:[0-9a-f-]{36}$/);
  assert.notEqual(first, second);
});

test("somente confirmação interna encerra o PIX como pago", () => {
  assert.equal(isPixConfirmed("CONFIRMADO"), true);
  assert.equal(isPixConfirmed("PROCESSANDO"), false);
  assert.equal(isPixConfirmed("CONFIRMED"), false);
  assert.equal(isPixTerminal("CONFIRMADO"), true);
  assert.equal(isPixTerminal("CANCELADO"), true);
  assert.equal(isPixTerminal("PROCESSANDO"), false);
});
