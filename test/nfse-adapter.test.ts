import assert from "node:assert/strict";
import test from "node:test";

import { readNfseRuntimeConfig } from "../supabase/functions/_shared/nfse-config.ts";

function env(values: Record<string, string>): (name: string) => string | undefined {
  return (name) => values[name];
}

test("NFS-e permanece desativada sem município, provedor e credenciais", () => {
  const config = readNfseRuntimeConfig(env({}));
  assert.equal(config.enabled, false);
  assert.equal(config.ready, false);
  assert.ok(config.issues.includes("disabled"));
  assert.ok(config.issues.includes("provider-missing"));
  assert.ok(config.issues.includes("municipality-missing"));
});

test("NFS-e rejeita endpoint que não esteja na allowlist HTTPS", () => {
  const config = readNfseRuntimeConfig(env({
    NFSE_ENABLED: "true",
    NFSE_PROVIDER: "provedor-futuro",
    NFSE_MUNICIPALITY_IBGE: "3550308",
    NFSE_ENVIRONMENT: "homologation",
    NFSE_API_BASE_URL: "http://localhost:8080/nfse",
    NFSE_ALLOWED_HOSTS: "api.provedor.example",
    NFSE_API_TOKEN: "token-com-comprimento-seguro",
    NFSE_CERTIFICATE_SECRET: "segredo-certificado-seguro",
  }));
  assert.equal(config.ready, false);
  assert.ok(config.issues.includes("endpoint-not-allowlisted"));
  assert.ok(config.issues.includes("provider-adapter-not-installed"));
});
