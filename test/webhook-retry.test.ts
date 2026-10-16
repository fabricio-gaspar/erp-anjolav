import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const helperUrl = new URL("../supabase/functions/_shared/asaas-webhook-retry.ts", import.meta.url);
const migrationUrl = new URL("../supabase/migrations/20261015116000_webhook_retry.sql", import.meta.url);

async function loadRetryStateMachine() {
  assert.ok(existsSync(helperUrl), "a state machine de retentativa deve existir");
  return import(helperUrl.href);
}

test("não torna eventos processados ou dead-letter elegíveis novamente", async () => {
  const { isWebhookEventEligibleForClaim } = await loadRetryStateMachine();
  const now = new Date("2026-10-16T12:00:00.000Z");

  assert.equal(isWebhookEventEligibleForClaim({ processingStatus: "processed", attemptCount: 1 }, now), false);
  assert.equal(isWebhookEventEligibleForClaim({ processingStatus: "dead_letter", attemptCount: 5 }, now), false);
});

test("aceita evento vencido e rejeita agendamento ou lock ainda ativos", async () => {
  const { isWebhookEventEligibleForClaim, PROCESSING_LOCK_TIMEOUT_MS } = await loadRetryStateMachine();
  const now = new Date("2026-10-16T12:00:00.000Z");

  assert.equal(isWebhookEventEligibleForClaim({ processingStatus: "pending", attemptCount: 1 }, now), true);
  assert.equal(
    isWebhookEventEligibleForClaim({
      processingStatus: "failed",
      attemptCount: 2,
      nextAttemptAt: "2026-10-16T12:00:01.000Z",
    }, now),
    false,
  );
  assert.equal(
    isWebhookEventEligibleForClaim({
      processingStatus: "processing",
      attemptCount: 2,
      lockedAt: new Date(now.getTime() - PROCESSING_LOCK_TIMEOUT_MS + 1).toISOString(),
    }, now),
    false,
  );
  assert.equal(
    isWebhookEventEligibleForClaim({
      processingStatus: "processing",
      attemptCount: 2,
      lockedAt: new Date(now.getTime() - PROCESSING_LOCK_TIMEOUT_MS).toISOString(),
    }, now),
    true,
  );
});

test("calcula backoff limitado e envia a quinta falha para dead letter", async () => {
  const { MAX_WEBHOOK_ATTEMPTS, nextWebhookFailureState } = await loadRetryStateMachine();
  const now = new Date("2026-10-16T12:00:00.000Z");

  assert.equal(MAX_WEBHOOK_ATTEMPTS, 5);
  assert.deepEqual(nextWebhookFailureState(1, now), {
    processingStatus: "failed",
    nextAttemptAt: "2026-10-16T12:01:00.000Z",
    deadLetteredAt: null,
  });
  assert.deepEqual(nextWebhookFailureState(4, now), {
    processingStatus: "failed",
    nextAttemptAt: "2026-10-16T12:08:00.000Z",
    deadLetteredAt: null,
  });
  assert.deepEqual(nextWebhookFailureState(5, now), {
    processingStatus: "dead_letter",
    nextAttemptAt: null,
    deadLetteredAt: "2026-10-16T12:00:00.000Z",
  });
});

test("a migration cria um claim atômico, limitado e restrito ao service role", () => {
  assert.ok(existsSync(migrationUrl), "a migration da fila de retentativa deve existir");
  const migration = readFileSync(migrationUrl, "utf8").replace(/\r\n/g, "\n");

  for (const field of ["next_attempt_at", "locked_at", "last_error_code", "dead_lettered_at"]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(migration, /'pending'/);
  assert.match(migration, /'dead_letter'/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.claim_asaas_webhook_events\s*\(/);
  assert.match(migration, /SECURITY DEFINER\s*\nSET search_path = ''/);
  assert.match(migration, /FOR UPDATE SKIP LOCKED/);
  assert.match(migration, /attempt_count < 5/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_asaas_webhook_events[\s\S]*FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_asaas_webhook_events[\s\S]*TO service_role/);
});
