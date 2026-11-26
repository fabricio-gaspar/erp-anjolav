import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyOfflineSyncFailure,
  isOfflineReferenceFresh,
  shouldPersistOfflineQuery,
} from "../src/lib/offlinePolicy.ts";

test("cache offline guarda apenas as consultas permitidas do PDV", () => {
  assert.equal(shouldPersistOfflineQuery(["clientes", "user", "tenant", "residencial"]), true);
  assert.equal(shouldPersistOfflineQuery(["produtos", "user", "tenant", "residencial"]), true);
  assert.equal(shouldPersistOfflineQuery(["pdv-customer-credit", "user", "tenant", "client"]), false);
  assert.equal(shouldPersistOfflineQuery(["faturas", "tenant"]), false);
});

test("falhas transitórias voltam para a fila e conflitos exigem revisão", () => {
  assert.deepEqual(classifyOfflineSyncFailure({ message: "Service unavailable", status: 503 }), {
    retryable: true,
    message: "Service unavailable",
    status: 503,
  });
  assert.deepEqual(classifyOfflineSyncFailure({ message: "Capacidade alterada", status: 409 }), {
    retryable: false,
    message: "Capacidade alterada",
    status: 409,
  });
});

test("referências do PDV expiram após a janela de segurança", () => {
  const now = Date.UTC(2026, 10, 12, 12, 0, 0);
  assert.equal(isOfflineReferenceFresh(new Date(now - 23 * 60 * 60 * 1_000).toISOString(), now), true);
  assert.equal(isOfflineReferenceFresh(new Date(now - 25 * 60 * 60 * 1_000).toISOString(), now), false);
  assert.equal(isOfflineReferenceFresh(null, now), false);
});
