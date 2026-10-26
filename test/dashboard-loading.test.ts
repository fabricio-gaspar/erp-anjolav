import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { resolverEstadoDashboard, type DashboardSourceState } from "../src/lib/dashboardState.ts";

const dashboardSource = readFileSync(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");

function source(
  label: string,
  state: Partial<DashboardSourceState> = {},
): DashboardSourceState {
  return {
    label,
    enabled: true,
    isLoading: false,
    hasError: false,
    ...state,
  };
}

test("uma fonte lenta não bloqueia o shell do Dashboard", () => {
  assert.deepEqual(
    resolverEstadoDashboard([
      source("indicadores operacionais", { isLoading: true }),
      source("agenda"),
    ]),
    {
      loadingSources: ["indicadores operacionais"],
      failedSources: [],
      hasBlockingLoad: false,
    },
  );
});

test("fontes com erro ficam identificadas para oferecer nova tentativa", () => {
  assert.deepEqual(
    resolverEstadoDashboard([
      source("agenda", { hasError: true }),
      source("contas a pagar", { enabled: false, isLoading: true, hasError: true }),
      source("caixa", { isLoading: true }),
    ]),
    {
      loadingSources: ["caixa"],
      failedSources: ["agenda"],
      hasBlockingLoad: false,
    },
  );
});

test("a ausência de dados não é confundida com carregamento ou erro", () => {
  assert.deepEqual(
    resolverEstadoDashboard([
      source("indicadores operacionais"),
      source("agenda"),
    ]),
    {
      loadingSources: [],
      failedSources: [],
      hasBlockingLoad: false,
    },
  );
});

test("o Dashboard não retorna uma tela global de carregamento", () => {
  assert.doesNotMatch(dashboardSource, /if\s*\(isLoading\)\s*\{\s*return\s*\(/s);
  assert.match(dashboardSource, /resolverEstadoDashboard\(/);
  assert.match(dashboardSource, /Tentar novamente/);
});

test("as métricas independentes do Dashboard são consultadas em paralelo e com payload mínimo", () => {
  const productionHook = readFileSync(
    new URL("../src/hooks/useHistoricoProducao.ts", import.meta.url),
    "utf8",
  );

  assert.match(productionHook, /const \[\s*\{ count: osEmAberto[\s\S]+?\] = await Promise\.all\(/);
  assert.match(productionHook, /\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(productionHook, /id, horario, status,/);
  assert.doesNotMatch(productionHook, /\.select\(`\s*\*,\s*cliente:clientes\(razao_social\)/);
  assert.match(dashboardSource, /useFaturas\(inicioMes, fimMes, temFinanceiro, true\)/);
  assert.match(readFileSync(new URL("../src/hooks/useFaturas.ts", import.meta.url), "utf8"), /incluirPeriodosSobrepostos/);
});

test("os joins do Dashboard desambiguam as FKs de tenant", () => {
  const productionHook = readFileSync(
    new URL("../src/hooks/useHistoricoProducao.ts", import.meta.url),
    "utf8",
  );
  const invoicesHook = readFileSync(new URL("../src/hooks/useFaturas.ts", import.meta.url), "utf8");

  assert.match(productionHook, /ordem:ordens_servico!historico_producao_ordem_servico_id_fkey/);
  assert.match(productionHook, /ordem:ordens_servico!itens_ordem_servico_ordem_servico_id_fkey/);
  assert.match(productionHook, /cliente:clientes!fk_agendamentos_cliente/);
  assert.match(productionHook, /cliente:clientes!ordens_servico_cliente_id_fkey/);
  assert.match(productionHook, /historico:historico_producao!historico_producao_ordem_servico_id_fkey/);
  assert.match(productionHook, /itens:itens_ordem_servico!itens_ordem_servico_ordem_servico_id_fkey/);
  assert.match(productionHook, /produto:produtos!itens_ordem_servico_produto_id_fkey/);
  assert.match(invoicesHook, /cliente:clientes!faturas_cliente_id_fkey!inner/);
  assert.doesNotMatch(productionHook, /ordem:ordens_servico!inner/);
  assert.doesNotMatch(productionHook, /cliente:clientes!inner/);
  assert.doesNotMatch(invoicesHook, /cliente:clientes!inner/);
});
