import assert from "node:assert/strict";
import test from "node:test";

import {
  generatePortalAccessCode,
  isStrongPortalAccessCode,
  normalizePortalAccessCode,
  PORTAL_CODE_LENGTH,
} from "../src/lib/portalCode.ts";

test("gera códigos de portal criptográficos no formato aceito", () => {
  const codes = new Set(Array.from({ length: 100 }, generatePortalAccessCode));

  assert.equal(codes.size, 100);
  for (const code of codes) {
    assert.equal(code.length, PORTAL_CODE_LENGTH);
    assert.equal(isStrongPortalAccessCode(code), true);
  }
});

test("normaliza códigos e rejeita tokens antigos ou malformados", () => {
  assert.equal(normalizePortalAccessCode("  abc234  "), "ABC234");
  assert.equal(isStrongPortalAccessCode("ABC12345"), false);
  assert.equal(isStrongPortalAccessCode("A".repeat(PORTAL_CODE_LENGTH)), true);
  assert.equal(isStrongPortalAccessCode(`${"A".repeat(PORTAL_CODE_LENGTH - 1)}0`), false);
});
