import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

test("migração define modo de tabela por cliente e porte opcional do produto", () => {
  const migrationPath = new URL(
    "../supabase/migrations/20261016120000_client_pricing_and_product_size.sql",
    import.meta.url,
  );
  assert.equal(existsSync(migrationPath), true);
  const migration = readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS tabela_preco_tipo\s+text\s+NOT NULL\s+DEFAULT\s+'padrao'/i);
  assert.match(migration, /tabela_preco_tipo[^\n]*padrao[^\n]*personalizada/i);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS porte\s+text/i);
  assert.match(migration, /porte[^\n]*(pequeno|medio|grande)/i);
  assert.match(migration, /precos_especiais/i);
});

test("contratos de cliente e produto expõem os novos campos", () => {
  const clientHook = source("../src/hooks/useClientes.ts");
  const productHook = source("../src/hooks/useProdutos.ts");
  const generatedTypes = source("../src/integrations/supabase/types.ts");

  assert.match(clientHook, /tabela_preco_tipo/);
  assert.match(productHook, /porte/);
  assert.match(generatedTypes, /tabela_preco_tipo/);
  assert.match(generatedTypes, /porte/);
});
