import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedOrderOrigins,
  getAllowedProductUnits,
  getCanonicalOrderOrigin,
  isOrderOriginAllowed,
} from "../src/lib/workspaceScope.ts";

test("preserva a origem loja como legado apenas no painel residencial", () => {
  assert.deepEqual(getAllowedOrderOrigins("residencial"), ["residencial", "loja"]);
  assert.equal(isOrderOriginAllowed("residencial", "loja"), true);
  assert.equal(isOrderOriginAllowed("industrial", "loja"), false);
});

test("padroniza novas ordens pela área ativa", () => {
  assert.equal(getCanonicalOrderOrigin("residencial", "loja"), "residencial");
  assert.equal(getCanonicalOrderOrigin("industrial", "residencial"), "industrial");
  assert.equal(getCanonicalOrderOrigin("central", "industrial"), "industrial");
});

test("mapeia produtos compartilhados para cada unidade", () => {
  assert.deepEqual(getAllowedProductUnits("industrial"), ["ID1", "ambos"]);
  assert.deepEqual(getAllowedProductUnits("residencial"), ["ID2", "ambos"]);
  assert.equal(getAllowedProductUnits("central"), null);
});
