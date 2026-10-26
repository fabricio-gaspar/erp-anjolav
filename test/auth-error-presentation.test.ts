import assert from "node:assert/strict";
import test from "node:test";

import { presentAuthError } from "../src/lib/authErrorPresentation.ts";

test("falha transitória do Supabase Auth não é exibida como senha incorreta", () => {
  const result = presentAuthError(Object.assign(new Error("Failed to fetch"), {
    name: "AuthRetryableFetchError",
  }));

  assert.equal(result.kind, "service_unavailable");
  assert.match(result.message, /serviço de acesso está indisponível/i);
});

test("credenciais inválidas preservam a mensagem específica", () => {
  const result = presentAuthError(new Error("Invalid login credentials"));

  assert.equal(result.kind, "invalid_credentials");
  assert.equal(result.message, "Login ou senha incorretos.");
});
