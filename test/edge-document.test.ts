import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidCnpj,
  isValidCpf,
  isValidCpfCnpj,
} from "../supabase/functions/_shared/br-document.ts";

test("valida CPF no limite da integração de pagamentos", () => {
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("11111111111"), false);
});

test("valida CNPJ no limite da integração de pagamentos", () => {
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11222333000180"), false);
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCpfCnpj("11222333000181"), true);
});
