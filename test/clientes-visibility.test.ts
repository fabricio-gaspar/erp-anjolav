import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

test("falha ao consultar clientes não é exibida como lista vazia", () => {
  const page = source("../src/pages/Clientes.tsx");

  assert.match(page, /error: clientesError/);
  assert.match(page, /clientesError \?/);
  assert.match(page, /role="alert"/);
  assert.match(page, /Não foi possível carregar os clientes/);
  assert.match(page, /onClick=\{\(\) => void refetch\(\)\}/);
});
