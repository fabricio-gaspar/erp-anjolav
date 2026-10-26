import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildPortalLoyalty } from "../supabase/functions/_shared/portal-loyalty.ts";

const migrationPath = new URL(
  "../supabase/migrations/20261015111500_portal_loyalty_visibility.sql",
  import.meta.url,
);
const portalFunctionPath = new URL("../supabase/functions/portal-customer/index.ts", import.meta.url);
const portalCardPath = new URL("../src/components/portal/FidelidadeClienteCard.tsx", import.meta.url);
const portalPagePath = new URL("../src/pages/PortalCliente.tsx", import.meta.url);
const fidelityConfigurationPath = new URL(
  "../src/components/configuracoes/ConfiguracoesFidelidade.tsx",
  import.meta.url,
);
const generatedTypesPath = new URL("../src/integrations/supabase/types.ts", import.meta.url);

const visibleConfig = {
  ativo: true,
  portal_exibir_fidelidade: true,
  valor_por_ponto: 0.3333,
  pontos_minimos_resgate: 125,
};

test("mantém o retorno de fidelidade inerte quando o programa está ausente, inativo ou oculto", () => {
  const ledger = [{ pontos: 80 }];
  const hiddenOrInactiveConfigs = [
    null,
    { ...visibleConfig, ativo: false },
    { ...visibleConfig, portal_exibir_fidelidade: false },
  ];

  for (const config of hiddenOrInactiveConfigs) {
    assert.deepEqual(buildPortalLoyalty(config, ledger, []), {
      active: false,
      visible: false,
      balancePoints: 0,
      balanceValue: 0,
      minimumRedemptionPoints: 0,
      recentEntries: [],
    });
  }
});

test("calcula o saldo algebricamente, limita apenas o saldo final e arredonda o valor", () => {
  const loyalty = buildPortalLoyalty(
    visibleConfig,
    [
      { pontos: 110, tipo: "CREDITO" },
      { pontos: -40, tipo: "RESGATE" },
      { pontos: -12, tipo: "EXPIRACAO" },
      { pontos: 5, tipo: "ESTORNO" },
      { pontos: -3, tipo: "ESTORNO" },
    ],
    [],
  );

  assert.equal(loyalty.active, true);
  assert.equal(loyalty.visible, true);
  assert.equal(loyalty.balancePoints, 60);
  assert.equal(loyalty.balanceValue, 20);
  assert.equal(loyalty.minimumRedemptionPoints, 125);

  const depleted = buildPortalLoyalty(visibleConfig, [{ pontos: -9, tipo: "RESGATE" }], []);
  assert.equal(depleted.balancePoints, 0);
  assert.equal(depleted.balanceValue, 0);
});

test("limita e sanitiza as movimentações recentes sem vazar referências internas", () => {
  const recentEntries = Array.from({ length: 12 }, (_, index) => ({
    id: `entry-${index}`,
    tenant_id: "other-tenant",
    cliente_id: "other-client",
    ordem_servico_id: `os-${index}`,
    idempotency_key: `loyalty:entry:${index}`,
    criado_por: "operator-id",
    valor_referencia: 99.9,
    descricao: `Movimentação ${index}`,
    pontos: index % 2 === 0 ? 1 : -1,
    tipo: index % 2 === 0 ? "CREDITO" as const : "RESGATE" as const,
    created_at: `2026-10-${String(12 - index).padStart(2, "0")}T12:00:00.000Z`,
  }));

  const loyalty = buildPortalLoyalty(visibleConfig, [], recentEntries);

  assert.equal(loyalty.recentEntries.length, 10);
  assert.deepEqual(loyalty.recentEntries[0], {
    description: "Movimentação 0",
    points: 1,
    type: "CREDITO",
    timestamp: "2026-10-12T12:00:00.000Z",
  });
  for (const entry of loyalty.recentEntries) {
    assert.deepEqual(Object.keys(entry).sort(), ["description", "points", "timestamp", "type"]);
    assert.equal("tenant_id" in entry, false);
    assert.equal("cliente_id" in entry, false);
    assert.equal("ordem_servico_id" in entry, false);
    assert.equal("idempotency_key" in entry, false);
  }
});

test("cria uma opção dedicada e fail-closed para a visibilidade do Portal", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /ALTER TABLE public\.fidelidade_configuracoes\s+ADD COLUMN IF NOT EXISTS portal_exibir_fidelidade boolean NOT NULL DEFAULT false;/,
  );
  assert.doesNotMatch(migration, /rol_configuracoes/);
});

test("o bootstrap usa o contexto resolvido, filtra toda leitura de ledger e não serializa tenant_id", () => {
  const source = readFileSync(portalFunctionPath, "utf8");

  assert.ok(source.indexOf("const loyaltyVisible") < source.indexOf('.from("fidelidade_lancamentos")'));
  assert.match(
    source,
    /\.from\("fidelidade_configuracoes"\)\s*\.select\("ativo, portal_exibir_fidelidade, valor_por_ponto, pontos_minimos_resgate"\)\s*\.eq\("tenant_id", tenantId\)/,
  );
  assert.match(
    source,
    /const loyaltyBalanceQuery = supabase[\s\S]*?\.from\("fidelidade_lancamentos"\)[\s\S]*?\.eq\("tenant_id", tenantId\)[\s\S]*?\.eq\("cliente_id", clientId\)/,
  );
  assert.match(
    source,
    /const loyaltyHistoryQuery = supabase[\s\S]*?\.from\("fidelidade_lancamentos"\)[\s\S]*?\.eq\("tenant_id", tenantId\)[\s\S]*?\.eq\("cliente_id", clientId\)[\s\S]*?\.order\("created_at", \{ ascending: false \}\)[\s\S]*?\.limit\(10\)/,
  );
  assert.match(source, /config:\s*\{\s*cliente_id: context\.config\.cliente_id,/);
  assert.doesNotMatch(source, /config:\s*context\.config/);
  assert.doesNotMatch(source, /body\.(?:tenant_id|cliente_id)/);
});

test("o Portal não renderiza o cartão quando a fidelidade não está visível", () => {
  const cardSource = readFileSync(portalCardPath, "utf8");
  const pageSource = readFileSync(portalPagePath, "utf8");

  assert.match(cardSource, /if \(!loyalty\.visible\) return null;/);
  assert.match(pageSource, /<FidelidadeClienteCard loyalty=\{portalData\.loyalty\} \/>/);
});

test("a configuração administrativa controla a opção dedicada com tipos locais atualizados", () => {
  const configurationSource = readFileSync(fidelityConfigurationPath, "utf8");
  const generatedTypes = readFileSync(generatedTypesPath, "utf8");

  assert.match(
    configurationSource,
    /\.select\("ativo, portal_exibir_fidelidade, valor_minimo_acumulo, reais_por_ponto, valor_por_ponto, pontos_minimos_resgate"\)/,
  );
  assert.match(configurationSource, /checked=\{config\.portal_exibir_fidelidade\}/);
  assert.match(generatedTypes, /fidelidade_configuracoes:[\s\S]*?portal_exibir_fidelidade: boolean/);
  assert.match(generatedTypes, /Insert: \{[\s\S]*?portal_exibir_fidelidade\?: boolean/);
  assert.match(generatedTypes, /Update: \{[\s\S]*?portal_exibir_fidelidade\?: boolean/);
});
