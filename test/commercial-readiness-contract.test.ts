import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
