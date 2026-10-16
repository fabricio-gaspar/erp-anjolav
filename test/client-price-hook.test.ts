import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function priceHookSource(): string {
  const source = readFileSync(new URL("../src/hooks/useProdutos.ts", import.meta.url), "utf8");
  return source.slice(source.indexOf("export function usePrecosEspeciais"));
}

test("preços especiais selecionam a relação de produto sem ambiguidade e expõem falhas de consulta", () => {
  const source = priceHookSource();

  assert.match(source, /produto:produtos!fk_precos_especiais_produto\(nome, unidade\)/);
  assert.match(source, /isError/);
  assert.match(source, /error/);
});

test("preço especial usa upsert atômico pela chave única do cliente e produto", () => {
  const source = priceHookSource();

  assert.match(source, /\.upsert\(preco,\s*\{\s*onConflict:\s*"cliente_id,produto_id"\s*\}\)/);
  assert.doesNotMatch(source, /const \{ data: existing \}/);
  assert.doesNotMatch(source, /\.maybeSingle\(\)/);
});
