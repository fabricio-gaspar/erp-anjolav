import assert from "node:assert/strict";
import test from "node:test";

import {
  formatarCEP,
  formatarCNPJ,
  formatarCPF,
  validarCEP,
  validarCNPJ,
  validarCPF,
  validarCpfCnpj,
  validarCodigoIBGE,
} from "../src/lib/validacoesFiscais.ts";

test("valida e formata CPF sem aceitar sequências repetidas", () => {
  assert.equal(validarCPF("529.982.247-25"), true);
  assert.equal(validarCPF("111.111.111-11"), false);
  assert.equal(formatarCPF("52998224725"), "529.982.247-25");
});

test("valida e formata CNPJ", () => {
  assert.equal(validarCNPJ("04.252.011/0001-10"), true);
  assert.equal(validarCNPJ("00.000.000/0000-00"), false);
  assert.equal(formatarCNPJ("04252011000110"), "04.252.011/0001-10");
});

test("classifica documentos e rejeita comprimentos inválidos", () => {
  assert.deepEqual(validarCpfCnpj("52998224725"), { valid: true, tipo: "cpf", erro: undefined });
  assert.equal(validarCpfCnpj("123").valid, false);
});

test("valida CEP e código IBGE pelo formato esperado", () => {
  assert.equal(validarCEP("18130-000"), true);
  assert.equal(formatarCEP("18130000"), "18130-000");
  assert.equal(validarCodigoIBGE("3550605"), true);
  assert.equal(validarCodigoIBGE("35506"), false);
});
