import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(relativePath: string) {
  const fileUrl = new URL(`../${relativePath}`, import.meta.url);
  assert.ok(existsSync(fileUrl), `${relativePath} deve existir`);
  return readFileSync(fileUrl, "utf8");
}

test("RPC financeira falha fechada para tenant, área e intervalo inválidos", () => {
  const migration = readProjectFile("supabase/migrations/20261015110000_financial_dashboard_aggregates.sql");

  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.consultar_dashboard_financeiro\s*\(\s*_inicio date,\s*_fim date,\s*_setor text\s*\)/is,
  );
  assert.match(migration, /SECURITY DEFINER/i);
  assert.match(migration, /SET search_path\s*=\s*''/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /private\.current_tenant_id\(\)/i);
  assert.match(migration, /private\.can_access_area\(/i);
  assert.match(migration, /WHEN\s+'todos'\s+THEN\s+'central'/is);
  assert.match(migration, /WHEN\s+'industrial'\s+THEN\s+'industrial'/is);
  assert.match(migration, /WHEN\s+'loja'\s+THEN\s+'residencial'/is);
  assert.match(migration, /_fim\s*-\s*_inicio\s*>\s*366/i);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.consultar_dashboard_financeiro\(date, date, text\) FROM PUBLIC, anon, service_role;/i);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consultar_dashboard_financeiro\(date, date, text\) TO authenticated;/i);
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION[\s\S]*?TO\s+(?:PUBLIC|anon)\b/i);
});

test("RPC retorna somente o contrato agregado e limita vencidos", () => {
  const migration = readProjectFile("supabase/migrations/20261015110000_financial_dashboard_aggregates.sql");

  assert.match(migration, /jsonb_build_object\(/i);
  for (const aggregateKey of [
    "resultado_registrado",
    "receitas_totais",
    "receitas_count",
    "despesas_totais",
    "despesas_count",
    "a_receber_vencido",
    "a_pagar_vencido",
    "movimentacoes_vencidas",
  ]) {
    assert.match(migration, new RegExp(`'${aggregateKey}'`, "i"));
  }
  assert.match(migration, /LIMIT\s+20/i);
  assert.match(migration, /tenant_id\s*=\s*v_tenant_id/i);
});

test("dashboard consome uma RPC tipada em vez de baixar históricos financeiros", () => {
  const aggregateHook = readProjectFile("src/hooks/useFinanceiroAgregado.ts");
  const dashboardHook = readProjectFile("src/hooks/useDashboardFinanceiro.ts");
  const generatedTypes = readProjectFile("src/integrations/supabase/types.ts");

  assert.match(aggregateHook, /supabase\.rpc\(\s*["']consultar_dashboard_financeiro["']/i);
  assert.match(aggregateHook, /_inicio:\s*periodo\.inicio/i);
  assert.match(aggregateHook, /_fim:\s*periodo\.fim/i);
  assert.match(aggregateHook, /_setor:\s*setor/i);
  assert.match(generatedTypes, /consultar_dashboard_financeiro:/i);
  assert.match(dashboardHook, /useFinanceiroAgregado\(/);
  assert.doesNotMatch(dashboardHook, /useContasPagar|useFaturas|caixa_movimentacoes/);
  assert.doesNotMatch(dashboardHook, /\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(dashboardHook, /\.from\(\s*["'](?:faturas|contas_pagar|caixa_movimentacoes)["']\s*\)/);
});

test("tela financeira mantém os widgets recuperáveis quando a consulta agregada falha", () => {
  const page = readProjectFile("src/pages/DashboardFinanceiro.tsx");
  const widgetState = readProjectFile("src/components/financeiro/FinanceiroWidgetState.tsx");

  assert.match(page, /FinanceiroWidgetState/);
  assert.match(page, /onRetry=\{retry\}/);
  assert.match(widgetState, /role=["']alert["']/);
  assert.match(widgetState, /Tentar novamente/);
  assert.match(widgetState, /aria-busy/);
});
