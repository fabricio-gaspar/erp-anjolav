import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const releasePlan = readFileSync(
  new URL("../docs/superpowers/plans/2026-10-15-commercial-readiness-program.md", import.meta.url),
  "utf8",
);

test("plano de release inclui as superfícies obrigatórias da prontidão comercial", () => {
  const requiredReleaseSurface = [
    "src/lib/appRoutes.ts",
    "supabase/migrations/20261015110000_financial_dashboard_aggregates.sql",
    "src/hooks/usePortalData.ts",
    "src/components/portal/FidelidadeClienteCard.tsx",
    "supabase/functions/retry-asaas-webhook/index.ts",
    "supabase/migrations/20261015119000_platform_administration.sql",
  ];

  for (const artifact of requiredReleaseSurface) {
    assert.ok(
      releasePlan.includes(`\`${artifact}\``),
      `a superfície de release deve incluir ${artifact}`,
    );
  }
});

test("CI executa os gates visuais e de desempenho depois do build", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts?: Record<string, string>;
  };
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const playwrightConfig = readFileSync(new URL("../playwright.config.ts", import.meta.url), "utf8");

  assert.match(packageJson.scripts?.["test:e2e"] ?? "", /playwright\s+test/);
  assert.match(packageJson.scripts?.["check:performance"] ?? "", /check-performance-budget/);

  const buildStep = workflow.indexOf("run: npm run build");
  const browserInstallStep = workflow.indexOf("run: npx playwright install --with-deps chromium");
  const e2eStep = workflow.indexOf("run: npm run test:e2e");
  const performanceStep = workflow.indexOf("run: npm run check:performance");
  assert.ok(buildStep >= 0, "o CI deve gerar o build antes de validar os assets");
  assert.ok(browserInstallStep >= 0, "o CI deve instalar o Chromium do Playwright");
  assert.ok(browserInstallStep < e2eStep, "o Chromium deve estar disponível antes dos testes E2E");
  assert.ok(e2eStep > buildStep, "o CI deve executar os testes E2E depois do build");
  assert.ok(performanceStep > buildStep, "o CI deve validar o orçamento de desempenho depois do build");
  assert.match(playwrightConfig, /npm run build -- --mode e2e/);
  assert.match(playwrightConfig, /npm run preview/);
});

test("plugins exclusivos do compilador CSS não entram no runtime de produção", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.equal(packageJson.dependencies?.["tailwindcss-animate"], undefined);
  assert.ok(packageJson.devDependencies?.["tailwindcss-animate"]);
});

test("gate de desempenho bloqueia um entrypoint compactado acima do orçamento", (t) => {
  const script = new URL("../scripts/check-performance-budget.mjs", import.meta.url);
  assert.ok(existsSync(script), "o verificador de orçamento de desempenho deve existir");

  const fixtureRoot = mkdtempSync(join(tmpdir(), "anjolav-performance-"));
  t.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
  const assetDirectory = join(fixtureRoot, "assets");
  const manifestPath = join(fixtureRoot, "manifest.json");
  mkdirSync(assetDirectory, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({
    "index.html": { file: "assets/index-oversized.js", isEntry: true },
  }));
  writeFileSync(
    join(assetDirectory, "index-oversized.js"),
    Array.from({ length: 16_384 }, (_, index) => `${index.toString(36)}-${(index * 2_654_435_761).toString(36)}\n`).join(""),
  );

  const result = spawnSync(process.execPath, [
    fileURLToPath(script),
    "--manifest", manifestPath,
    "--assets-dir", fixtureRoot,
    "--main-budget-kb", "1",
  ], { encoding: "utf8" });

  assert.notEqual(result.status, 0, "um entrypoint acima do limite deve falhar");
  assert.match(`${result.stdout}\n${result.stderr}`, /orçamento|budget|excede/i);
});
