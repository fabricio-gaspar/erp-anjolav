import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function priceHookSource(): string {
  const source = readFileSync(new URL("../src/hooks/useProdutos.ts", import.meta.url), "utf8");
  return source.slice(source.indexOf("export function usePrecosEspeciais"));
}

test("preços especiais selecionam a relação de produto sem ambiguidade e expõem falhas de consulta", () => {
  const source = priceHookSource();

  assert.match(source, /produto:produtos!fk_precos_especiais_produto\(nome, unidade, preco\)/);
  assert.match(source, /isError/);
  assert.match(source, /error/);
});

test("fluxos comerciais resolvem preço padrão ou personalizado conforme o cliente", () => {
  const pdv = readFileSync(new URL("../src/pages/CaixaPDV.tsx", import.meta.url), "utf8");
  const lancamentos = readFileSync(new URL("../src/components/lancamentos/NovoLancamentoTab.tsx", import.meta.url), "utf8");
  const producao = readFileSync(new URL("../src/components/producao/FormularioEtapa.tsx", import.meta.url), "utf8");
  const conferencia = readFileSync(new URL("../src/components/lancamentos/ConferenciaModal.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20261016133000_apply_client_price_modes.sql", import.meta.url), "utf8");

  assert.match(pdv, /tabela_preco_tipo.*personalizada/);
  assert.match(lancamentos, /useProdutos/);
  assert.match(lancamentos, /tabela_preco_tipo/);
  assert.match(producao, /useProdutos/);
  assert.match(producao, /tabela_preco_tipo/);
  assert.match(conferencia, /useProdutos/);
  assert.match(conferencia, /tabela_preco_tipo/);
  assert.match(migration, /tabela_preco_tipo\s*=\s*'personalizada'/i);
});

test("preço especial usa upsert atômico pela chave única do cliente e produto", () => {
  const source = priceHookSource();

  assert.match(source, /\.upsert\(preco,\s*\{\s*onConflict:\s*"cliente_id,produto_id"\s*\}\)/);
  assert.doesNotMatch(source, /const \{ data: existing \}/);
  assert.doesNotMatch(source, /\.maybeSingle\(\)/);
});
