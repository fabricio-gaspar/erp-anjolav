import assert from "node:assert/strict";
import test from "node:test";

import { REQUIRED_RELEASE_GATES, parseDotEnv, validateProductionConfig } from "../scripts/production-preflight.mjs";

const projectId = "lbrsblimephbjyjlrefv";

function validEvidence() {
  return {
    environment: "production",
    projectRef: projectId,
    releaseCommit: "a".repeat(40),
    approvedBy: "Responsável de release",
    approvedAt: "2026-09-14T12:00:00-03:00",
    gates: Object.fromEntries(
      REQUIRED_RELEASE_GATES.map((gate) => [gate, { passed: true, evidence: `Teste ${gate} aprovado` }]),
    ),
  };
}

function validFrontend() {
  return {
    VITE_SUPABASE_PROJECT_ID: projectId,
    VITE_SUPABASE_URL: `https://${projectId}.supabase.co`,
    VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_valid_for_test_only",
  };
}

function validFunctions() {
  return {
    ALLOWED_ORIGINS: "https://erp.anjolav.example",
    ASAAS_ENVIRONMENT: "production",
    ASAAS_API_KEY: "asaas_live_" + "a".repeat(32),
    ASAAS_WEBHOOK_TOKEN: "a".repeat(32),
    ASAAS_WEBHOOK_PUBLIC_URL: `https://${projectId}.supabase.co/functions/v1/asaas-webhook`,
    EVOLUTION_API_KEY: "evolution_" + "b".repeat(32),
    EVOLUTION_ALLOWED_HOSTS: "evolution.anjolav.example",
    N8N_ALLOWED_HOSTS: "n8n.anjolav.example",
    N8N_WEBHOOK_TOKEN: "c".repeat(32),
    ENABLE_DESTRUCTIVE_DATA_ADMIN: "false",
  };
}

test("aceita um contrato de produção completo sem expor secrets", () => {
  const result = validateProductionConfig({
    frontend: validFrontend(),
    functions: validFunctions(),
    evidence: validEvidence(),
    projectId,
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.errors, []);
});

test("bloqueia secrets colocados por engano no frontend", () => {
  const frontend = {
    ...validFrontend(),
    VITE_SUPABASE_SERVICE_ROLE_KEY: "não-deve-ir-para-o-browser",
  };
  const result = validateProductionConfig({ frontend, functions: validFunctions(), evidence: validEvidence(), projectId });

  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /VITE_SUPABASE_SERVICE_ROLE_KEY não pode ser exposto/);
});

test("bloqueia evidência de release incompleta", () => {
  const evidence = validEvidence();
  evidence.gates.tenantRls = { passed: false, evidence: "" };
  evidence.approvedBy = "PREENCHA_COM_O_RESPONSAVEL";
  const result = validateProductionConfig({
    frontend: validFrontend(),
    functions: validFunctions(),
    evidence,
    projectId,
  });

  assert.equal(result.ready, false);
  assert.match(result.errors.join("\n"), /Gate de release pendente: tenantRls/);
  assert.match(result.errors.join("\n"), /approvedBy deve identificar/);
});

test("preserva valores com sinal de igual ao ler dotenv", () => {
  const values = parseDotEnv("TOKEN='abc=def'\n# comentario\nALLOWED_ORIGINS=https://erp.anjolav.example");

  assert.equal(values.TOKEN, "abc=def");
  assert.equal(values.ALLOWED_ORIGINS, "https://erp.anjolav.example");
});
