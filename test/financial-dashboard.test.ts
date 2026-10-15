import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

function readProjectFile(relativePath: string) {
  const fileUrl = new URL(`../${relativePath}`, import.meta.url);
  assert.ok(existsSync(fileUrl), `${relativePath} deve existir`);
  return readFileSync(fileUrl, "utf8");
}

async function loadFinanceiroDashboardState() {
  try {
    return await import(new URL("../src/lib/financeiroDashboardState.ts", import.meta.url).href);
  } catch {
    return null;
  }
}

async function requireFinanceiroDashboardState() {
  const state = await loadFinanceiroDashboardState();
  assert.ok(state, "src/lib/financeiroDashboardState.ts deve existir");
  return state;
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
  assert.match(aggregateHook, /_inicio:\s*periodoNormalizado\.inicio/i);
  assert.match(aggregateHook, /_fim:\s*periodoNormalizado\.fim/i);
  assert.match(aggregateHook, /_setor:\s*setor/i);
  assert.match(generatedTypes, /consultar_dashboard_financeiro:/i);
  assert.match(dashboardHook, /useFinanceiroAgregado\(/);
  assert.doesNotMatch(dashboardHook, /useContasPagar|useFaturas|caixa_movimentacoes/);
  assert.doesNotMatch(dashboardHook, /\.select\(\s*["']\*["']\s*\)/);
  assert.doesNotMatch(dashboardHook, /\.from\(\s*["'](?:faturas|contas_pagar|caixa_movimentacoes)["']\s*\)/);
});

test("separa o cache financeiro por empresa e limpa somente o namespace financeiro na troca", async () => {
  const financeiro = await requireFinanceiroDashboardState();
  const periodo = { inicio: "2026-01-01", fim: "2026-12-31" };
  const chaveEmpresaA = financeiro.criarChaveConsultaFinanceira("tenant-a", periodo, "todos");
  const chaveEmpresaB = financeiro.criarChaveConsultaFinanceira("tenant-b", periodo, "todos");
  const cache = new QueryClient();

  assert.deepEqual(chaveEmpresaA, ["financeiro-agregado", "tenant-a", "2026-01-01", "2026-12-31", "todos"]);
  assert.deepEqual(chaveEmpresaB, ["financeiro-agregado", "tenant-b", "2026-01-01", "2026-12-31", "todos"]);

  cache.setQueryData(chaveEmpresaA, { receitasTotais: 125 });
  cache.setQueryData(["outra-consulta", "tenant-a"], { preservada: true });

  assert.equal(cache.getQueryData(chaveEmpresaB), undefined);

  financeiro.limparCacheFinanceiroAgregado(cache);

  assert.equal(cache.getQueryData(chaveEmpresaA), undefined);
  assert.deepEqual(cache.getQueryData(["outra-consulta", "tenant-a"]), { preservada: true });
});

test("rejeita períodos financeiros inválidos antes de consultar a RPC", async () => {
  const financeiro = await requireFinanceiroDashboardState();

  assert.doesNotThrow(() => {
    financeiro.criarChaveConsultaFinanceira(
      "tenant-a",
      { inicio: "2026-01-01", fim: "2027-01-02" },
      "industrial",
    );
  });

  assert.throws(() => {
    financeiro.criarChaveConsultaFinanceira(
      "tenant-a",
      { inicio: "2026-01-01", fim: "2027-01-03" },
      "industrial",
    );
  }, /366 dias/);

  assert.throws(() => {
    financeiro.criarChaveConsultaFinanceira(
      "tenant-a",
      { inicio: "2026-02-30", fim: "2026-03-01" },
      "todos",
    );
  }, /Data inicial inválida/);

  assert.throws(() => {
    financeiro.criarChaveConsultaFinanceira(
      "tenant-a",
      { inicio: "2026-06-02", fim: "2026-06-01" },
      "loja",
    );
  }, /Intervalo financeiro inválido/);
});

test("expõe retry somente para uma falha financeira já carregada", async () => {
  const financeiro = await requireFinanceiroDashboardState();

  assert.deepEqual(
    financeiro.resolverEstadoWidgetFinanceiro({ hasError: false, isLoading: true, isRetrying: false }),
    { kind: "loading", ariaBusy: true, showRetry: false, retryDisabled: true },
  );
  assert.deepEqual(
    financeiro.resolverEstadoWidgetFinanceiro({ hasError: true, isLoading: false, isRetrying: false }),
    { kind: "error", ariaBusy: false, showRetry: true, retryDisabled: false },
  );
  assert.deepEqual(
    financeiro.resolverEstadoWidgetFinanceiro({ hasError: true, isLoading: false, isRetrying: true }),
    { kind: "retrying", ariaBusy: true, showRetry: true, retryDisabled: true },
  );
});
