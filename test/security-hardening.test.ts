import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const baselineMigrationPath = new URL(
  "../supabase/migrations/20260930120000_commercial_multitenancy_hardening.sql",
  import.meta.url,
);
const hardeningMigrationPath = new URL(
  "../supabase/migrations/20261015113000_security_performance_hardening.sql",
  import.meta.url,
);
const loyaltyMigrationPath = new URL(
  "../supabase/migrations/20261008110000_customer_loyalty_program.sql",
  import.meta.url,
);

function readRequired(path: URL, label: string): string {
  assert.equal(existsSync(path), true, `${label} must exist`);
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

function extractBlock(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `missing ${end}`);
  return source.slice(startIndex, endIndex + "    END;".length);
}

function policyBlock(source: string, policyName: string): string {
  const start = source.indexOf(`CREATE POLICY ${policyName} `);
  assert.notEqual(start, -1, `missing ${policyName}`);
  const end = source.indexOf(";", start);
  assert.notEqual(end, -1, `missing terminator for ${policyName}`);
  return source.slice(start, end + 1);
}

function assertPolicyIsRecreated(source: string, policyName: string, tableName: string): string {
  assert.match(
    source,
    new RegExp(`DROP POLICY IF EXISTS ${policyName} ON public\\.${tableName};`),
    `${policyName} must be dropped before it is recreated`,
  );
  return policyBlock(source, policyName);
}

test("adds the phase-A local hardening migration", () => {
  assert.equal(existsSync(hardeningMigrationPath), true, "Task 7 hardening migration must exist");
});

test("caches only stable caller context while retaining generated module and area semantics", () => {
  const baseline = readRequired(baselineMigrationPath, "baseline multitenancy migration");
  const migration = readRequired(hardeningMigrationPath, "Task 7 hardening migration");
  const expectedModules = extractBlock(baseline, "allowed_modules := CASE", "    END;\n    module_check");
  const expectedAreas = extractBlock(baseline, "area_check := CASE", "    END;\n    access_check");

  assert.ok(migration.includes(expectedModules), "allowed module arrays must be copied unchanged");
  assert.ok(migration.includes(expectedAreas), "row-dependent area expressions must be copied unchanged");
  assert.match(
    migration,
    /module_check := format\('\(select private\.has_any_module_access\(%L::text\[\]\)\)', allowed_modules\);/,
  );
  for (const policy of ["tenant_select", "tenant_insert", "tenant_update", "tenant_delete"]) {
    assert.match(
      migration,
      new RegExp(`DROP POLICY IF EXISTS ${policy} ON public\\.%I`),
      `${policy} must be recreated only for the known commercial table set`,
    );
  }
  assert.match(
    migration,
    /CREATE POLICY tenant_select ON public\.%I FOR SELECT TO authenticated USING \(tenant_id = \(select private\.current_tenant_id\(\)\) AND %s\)/,
  );
  assert.match(
    migration,
    /CREATE POLICY tenant_insert ON public\.%I FOR INSERT TO authenticated WITH CHECK \(tenant_id = \(select private\.current_tenant_id\(\)\) AND %s\)/,
  );
  assert.match(
    migration,
    /CREATE POLICY tenant_update ON public\.%I FOR UPDATE TO authenticated USING \(tenant_id = \(select private\.current_tenant_id\(\)\) AND %s\) WITH CHECK \(tenant_id = \(select private\.current_tenant_id\(\)\) AND %s\)/,
  );
  assert.match(
    migration,
    /CREATE POLICY tenant_delete ON public\.%I FOR DELETE TO authenticated USING \(tenant_id = \(select private\.current_tenant_id\(\)\) AND %s\)/,
  );
  assert.doesNotMatch(migration, /CREATE POLICY[^;]+USING\s*\(\s*true\s*\)/is);
  assert.doesNotMatch(
    migration,
    /\(select private\.(?:can_access_area|can_access_client|can_access_order|can_access_product|can_access_appointment|can_access_invoice|can_access_launch|can_access_portal_launch|can_access_contract)\(/,
  );
});

test("preserves self, membership, module, and audit RLS semantics with safe statement wrappers", () => {
  const migration = readRequired(hardeningMigrationPath, "Task 7 hardening migration");

  const membership = assertPolicyIsRecreated(migration, "tenant_member_read_membership", "tenant_memberships");
  assert.match(membership, /FOR SELECT TO authenticated USING \(\s*user_id = \(select auth\.uid\(\)\) OR private\.is_tenant_admin\(tenant_id\)\s*\)/s);
  assert.doesNotMatch(membership, /current_tenant_id/);

  for (const [name, table] of [
    ["employee_self_read", "funcionarios"],
    ["own_roles_read", "user_roles"],
    ["own_areas_read", "area_permissoes"],
  ]) {
    const policy = assertPolicyIsRecreated(migration, name, table);
    assert.match(policy, new RegExp(`ON public\\.${table}\\s+FOR SELECT TO authenticated`, "s"));
    assert.match(
      policy,
      /tenant_id = \(select private\.current_tenant_id\(\)\) AND user_id = \(select auth\.uid\(\)\)/,
    );
  }

  for (const name of [
    "own_module_permissions_read",
    "employee_read_own_payroll",
    "employee_read_own_benefits",
    "employee_read_own_payroll_history",
  ]) {
    const table = name === "own_module_permissions_read"
      ? "modulo_permissoes"
      : name.includes("payroll") ? "folha_pagamento" : "folha_beneficios";
    const policy = assertPolicyIsRecreated(
      migration,
      name,
      name === "employee_read_own_payroll_history" ? "folha_pagamento_historico" : table,
    );
    assert.match(policy, /tenant_id = \(select private\.current_tenant_id\(\)\)/);
    assert.match(policy, /funcionario_id = \(select public\.get_funcionario_for_user\(auth\.uid\(\)\)\)/);
  }

  const generalConfig = assertPolicyIsRecreated(migration, "tenant_member_read_general_config", "configuracoes_gerais");
  assert.match(generalConfig, /tenant_id = \(select private\.current_tenant_id\(\)\)/);
  assert.match(generalConfig, /private\.is_tenant_member\(tenant_id\)/);
  assert.doesNotMatch(generalConfig, /select private\.is_tenant_member\(tenant_id\)/);

  const modulePolicies = new Map([
    ["tenant_finance_read_categories", "ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios']"],
    ["tenant_finance_read_cost_centers", "ARRAY['faturamento', 'caixa', 'contas_receber', 'contas_pagar', 'relatorios']"],
    ["tenant_billing_read_service_descriptions", "ARRAY['clientes', 'faturamento']"],
    ["tenant_operations_read_label_config", "ARRAY['ordens', 'producao', 'caixa']"],
    ["tenant_operations_read_rol_config", "ARRAY['ordens', 'producao', 'faturamento']"],
    ["tenant_clients_read_portal_config", "ARRAY['clientes']"],
  ]);
  for (const [name, modules] of modulePolicies) {
    const table = new Map([
      ["tenant_finance_read_categories", "categorias_financeiras"],
      ["tenant_finance_read_cost_centers", "centros_custo"],
      ["tenant_billing_read_service_descriptions", "descricoes_servicos_fiscais"],
      ["tenant_operations_read_label_config", "etiquetas_configuracoes"],
      ["tenant_operations_read_rol_config", "rol_configuracoes"],
      ["tenant_clients_read_portal_config", "portal_config"],
    ]).get(name);
    assert.ok(table, `missing table mapping for ${name}`);
    const policy = assertPolicyIsRecreated(migration, name, table);
    assert.match(policy, /tenant_id = \(select private\.current_tenant_id\(\)\)/);
    assert.ok(policy.includes(`(select private.has_any_module_access(${modules}))`));
  }

  const audit = assertPolicyIsRecreated(migration, "tenant_admin_read_audit", "audit_events");
  assert.match(audit, /FOR SELECT TO authenticated/);
  assert.match(audit, /tenant_id = \(select private\.current_tenant_id\(\)\)/);
  assert.match(audit, /\(select private\.is_tenant_admin\(\(select private\.current_tenant_id\(\)\)\)\)/);
  assert.doesNotMatch(audit, /private\.is_tenant_admin\(tenant_id\)/);

  const loyalty = assertPolicyIsRecreated(migration, "fidelidade_lancamentos_leitura_empresa", "fidelidade_lancamentos");
  assert.match(loyalty, /ON public\.fidelidade_lancamentos\s+FOR SELECT TO authenticated/s);
  assert.match(loyalty, /tenant_id = \(select private\.current_tenant_id\(\)\)/);
  assert.match(loyalty, /\(select private\.has_any_module_access\(ARRAY\['caixa', 'clientes'\]\)\)/);

  const originalLoyalty = readRequired(loyaltyMigrationPath, "loyalty migration");
  assert.match(originalLoyalty, /ARRAY\['caixa', 'clientes'\]/);
});

test("adds neither speculative indexes nor a new privileged database function", () => {
  const migration = readRequired(hardeningMigrationPath, "Task 7 hardening migration");

  assert.doesNotMatch(migration, /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i);
  assert.doesNotMatch(migration, /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
  assert.doesNotMatch(migration, /\bSECURITY\s+DEFINER\b/i);
});
