import assert from "node:assert/strict";
import test from "node:test";
import { calculateDeliveryFee, calculateDistanceKm } from "../src/lib/deliveryPricing.ts";

test("calcula delivery fixo sem alterar a regra configurada", () => {
  assert.equal(calculateDeliveryFee({ model: "fixo", baseFee: 12.5, feePerKm: 99 }, 4), 12.5);
});

test("calcula delivery por KM e arredonda em centavos", () => {
  const distance = calculateDistanceKm(-23.5505, -46.6333, -23.56, -46.64);
  assert.ok(distance !== null && distance > 0);
  assert.equal(calculateDeliveryFee({ model: "km", baseFee: 5, feePerKm: 2 }, distance), Math.round((5 + distance * 2) * 100) / 100);
  assert.equal(calculateDeliveryFee({ model: "km", baseFee: 5, feePerKm: 2 }, null), null);
});
