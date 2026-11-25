import assert from "node:assert/strict";
import test from "node:test";
import { validarCNPJ, validarCpfCnpj, normalizarCnpj } from "../src/lib/validacoesFiscais.ts";
import { formatCnpj } from "../src/lib/nfsePolicy.ts";

test("CNPJ alfanumérico é preservado, validado e formatado", () => {
  const sample = "00.000.000/E08G-12";
  assert.equal(normalizarCnpj(sample), "00000000E08G12");
  assert.equal(validarCNPJ(sample), true);
  assert.equal(validarCpfCnpj(sample).valid, true);
  assert.equal(formatCnpj("00000000E08G12"), sample);
  assert.equal(validarCNPJ("00.000.000/E08G-13"), false);
});
