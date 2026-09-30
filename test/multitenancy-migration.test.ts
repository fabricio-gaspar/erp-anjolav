import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260930120000_commercial_multitenancy_hardening.sql",
  import.meta.url,
);
const migration = readFileSync(migrationPath, "utf8");

test("migration comercial cobre todas as tabelas de negócio existentes", () => {
  const match = /tenant_tables constant text\[\] := ARRAY\[(.*?)\];/s.exec(migration);
  assert.ok(match, "lista tenant_tables não encontrada");
  const listed = new Set(Array.from(match[1].matchAll(/'([a-z0-9_]+)'/g), (item) => item[1]));
  const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
  const created = new Set<string>();

  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith(".sql"))) {
    const sql = readFileSync(new URL(file, migrationsDir), "utf8").replace(/--.*$/gm, "");
    for (const table of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      created.add(table[1].toLowerCase());
    }
  }

  const infrastructure = new Set(["audit_events", "portal_rate_limits", "tenant_memberships", "tenants"]);
  const missing = [...created].filter((table) => !listed.has(table) && !infrastructure.has(table)).sort();
  assert.deepEqual(missing, []);
});

test("migration remove policies antigas e recria isolamento, grants e auditoria", () => {
  assert.match(migration, /DROP POLICY IF EXISTS %I ON %I\.%I/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.%I FROM PUBLIC, anon/);
  assert.match(migration, /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public/);
  assert.match(migration, /v_contas_receber SET \(security_invoker = true\)/);
  assert.match(migration, /v_fluxo_caixa SET \(security_invoker = true\)/);
  assert.match(migration, /FUNCTION private\.is_tenant_member/);
  assert.match(migration, /tenant_id = private\.current_tenant_id\(\)/);
  assert.match(migration, /private\.is_tenant_admin\(tenant_id\)/);
  assert.match(migration, /enabled boolean NOT NULL DEFAULT true/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_employee_email_by_login\(text\)/);
  assert.match(migration, /CREATE TABLE public\.audit_events/);
  assert.match(migration, /private\.redact_audit_data/);
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+USING\s*\(\s*true\s*\)/is);
});

test("RLS combina empresa, módulo e área de negócio", () => {
  assert.match(migration, /FUNCTION private\.has_any_module_access/);
  assert.match(migration, /FUNCTION private\.can_access_area/);
  assert.match(migration, /permission\.area = 'central'/);
  assert.match(migration, /FUNCTION private\.can_access_client/);
  assert.match(migration, /FUNCTION private\.can_access_order/);
  assert.match(migration, /FUNCTION private\.can_access_product/);
  assert.match(migration, /FUNCTION public\.get_fiscal_configs_for_operations/);
  assert.doesNotMatch(migration, /tenant_billing_read_fiscal_config/);
  assert.match(migration, /access_check := format\('\(%s\) AND \(%s\)'/);
  assert.match(migration, /tenant_id = private\.current_tenant_id\(\) AND %s/);
});

test("migration preserva pagamentos e oferece operações transacionais", () => {
  assert.match(migration, /pdv_pagamentos_ordem_servico_id_fkey[\s\S]+ON DELETE RESTRICT/);
  assert.match(migration, /FUNCTION public\.cancelar_ordem_servico/);
  assert.match(migration, /FUNCTION public\.avancar_etapa_producao/);
  assert.match(migration, /FUNCTION public\.criar_lancamento_portal/);
  assert.match(migration, /portal_idempotency_key/);
  assert.match(migration, /FUNCTION public\.consume_portal_rate_limit/);
});
