import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

test("o Relatório Mensal usa as relações explícitas e encerra o loading em caso de erro", () => {
  const hook = source("../src/hooks/useRelatorioMensal.ts");
  const page = source("../src/pages/RelatorioMensal.tsx");

  assert.match(hook, /cliente:clientes!faturas_cliente_id_fkey\(/);
  assert.match(hook, /funcionario:funcionarios!folha_pagamento_funcionario_id_fkey\(/);
  assert.match(page, /const \{ data, error, isLoading, refetch \} = useRelatorioMensal/);
  assert.match(page, /error && !data/);
  assert.match(page, /Tentar novamente/);
  assert.doesNotMatch(page, /isLoading \|\| !data/);
});

test("a Administração SaaS diferencia endpoint ausente de falha de autorização", () => {
  const hook = source("../src/hooks/useAdministracaoSaas.ts");
  const component = source("../src/components/configuracoes/AdministracaoSaas.tsx");

  assert.match(hook, /context\?\.status === 404/);
  assert.match(hook, /não está publicada neste ambiente/i);
  assert.match(component, /plans\.error|tenants\.error/);
  assert.match(component, /Tentar novamente/);
});
