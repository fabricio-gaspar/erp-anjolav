import assert from "node:assert/strict";
import test from "node:test";
import {
  getRoutePermissionRequirement,
  hasAnyModulePermission,
  normalizeAppPath,
} from "../src/lib/authorization.ts";

test("normaliza query string, hash e barra final", () => {
  assert.equal(normalizeAppPath("/central/contas/?tab=receber#lista"), "/central/contas");
  assert.equal(normalizeAppPath("/"), "/");
});

test("mapeia rotas de cada área para módulos explícitos", () => {
  assert.deepEqual(getRoutePermissionRequirement("/central"), ["dashboard"]);
  assert.deepEqual(getRoutePermissionRequirement("/industrial/ordens"), ["ordens"]);
  assert.deepEqual(getRoutePermissionRequirement("/residencial/caixa"), ["caixa"]);
});

test("permite a página de contas quando ao menos um módulo financeiro foi concedido", () => {
  const requirement = getRoutePermissionRequirement("/central/contas");
  assert.ok(requirement);
  assert.equal(hasAnyModulePermission({ contas_receber: true }, requirement), true);
  assert.equal(hasAnyModulePermission({ contas_pagar: true }, requirement), true);
  assert.equal(hasAnyModulePermission({ faturamento: true }, requirement), false);
});

test("nega rotas desconhecidas em vez de liberar por padrão", () => {
  assert.equal(getRoutePermissionRequirement("/central/modulo-inexistente"), null);
});
