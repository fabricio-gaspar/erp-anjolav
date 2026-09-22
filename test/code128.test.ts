import assert from "node:assert/strict";
import test from "node:test";

import { encodeCode128B, generateCode128BPattern } from "../src/lib/code128.ts";

test("codifica Code 128-B com start, checksum e stop corretos", () => {
  assert.deepEqual(encodeCode128B("1234"), [104, 17, 18, 19, 20, 88, 106]);
});

test("gera o padrão binário conhecido para 1234", () => {
  const expected = [
    "11010010000",
    "10011100110",
    "11001110010",
    "11001011100",
    "11001001110",
    "11110010010",
    "1100011101011",
  ].join("");

  assert.equal(generateCode128BPattern("1234").join(""), expected);
});

test("rejeita conteúdo vazio ou incompatível em vez de imprimir outro valor", () => {
  assert.throws(() => encodeCode128B(""), /não pode ser vazio/);
  assert.throws(() => encodeCode128B("ação"), /ASCII imprimíveis/);
});
