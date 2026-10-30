import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const consultaSource = readFileSync(join(root, "src", "hooks", "useConsultaOS.ts"), "utf8");
const pdvSource = readFileSync(join(root, "src", "pages", "CaixaPDV.tsx"), "utf8");

test("consulta do ROL usa o ciclo operacional persistido", () => {
  for (const expected of [
    '"retirada": { label: "Aguardando separação"',
    '"separacao": { label: "Separação"',
    '"expedicao": { label: "Pronto para entrega"',
    '"cancelada": { label: "Cancelada", variant: "destructive"',
    '{ value: "canceladas", label: "Canceladas" }',
  ]) {
    assert.match(consultaSource, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("consulta carrega itens no mesmo request do ROL", () => {
  assert.match(consultaSource, /itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey/);
  assert.match(consultaSource, /produto:produtos!itens_ordem_servico_produto_id_fkey/);
  assert.doesNotMatch(consultaSource, /ordensData\.map\(async/);
});

test("consulta distingue filtros operacionais e financeiros", () => {
  assert.match(consultaSource, /statusFilter === "pendentes_pagamento"/);
  assert.match(consultaSource, /statusFilter === "quitadas"/);
  assert.match(consultaSource, /statusFilter === "canceladas"/);
  assert.match(consultaSource, /const hasActiveFilter = Boolean/);
  assert.match(consultaSource, /term\.length >= 2 \|\| !!options\.recent \|\| hasActiveFilter/);
  assert.match(consultaSource, /function useDebouncedTerm/);
  assert.match(consultaSource, /normalizarNumeroRol/);
});

test("PDV mantém somente ações principais no painel rápido", () => {
  assert.doesNotMatch(pdvSource, /Consultar<span>F5<\/span>/);
  assert.doesNotMatch(pdvSource, /Histórico<span>F6<\/span>/);
  assert.doesNotMatch(pdvSource, /Cancelar<span>F8<\/span>/);
  assert.match(pdvSource, /Mais<span>Ações<\/span>/);
  assert.match(pdvSource, /Histórico de atendimentos/);
});

test("atalhos do PDV respeitam o setor autorizado", () => {
  assert.match(pdvSource, /canAccessRoute\("\/" \+ area \+ "\/relatorios\/caixa"\)/);
  assert.match(pdvSource, /openQuickCadastro\("\/" \+ area \+ "\/relatorios\/caixa"\)/);
  assert.doesNotMatch(pdvSource, /openQuickCadastro\("\/residencial\/relatorios\/caixa"\)/);
});

test("PDV não mantém uma segunda barra superior de ações", () => {
  assert.doesNotMatch(pdvSource, /aria-label="Ações de cadastro do atendimento"/);
  assert.match(pdvSource, /Contrato do cliente/);
  assert.match(pdvSource, /Novo produto\/serviço/);
});
