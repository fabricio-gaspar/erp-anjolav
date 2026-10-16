export const MAX_WEBHOOK_ATTEMPTS = 5;
export const WEBHOOK_RETRY_BASE_DELAY_MS = 60_000;
export const WEBHOOK_RETRY_MAX_DELAY_MS = 30 * 60_000;
export const PROCESSING_LOCK_TIMEOUT_MS = 10 * 60_000;

export type WebhookProcessingStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed"
  | "dead_letter";

export interface WebhookRetryCandidate {
  processingStatus: WebhookProcessingStatus;
  attemptCount: number;
  nextAttemptAt?: string | null;
  lockedAt?: string | null;
}

export interface WebhookFailureState {
  processingStatus: "failed" | "dead_letter";
  nextAttemptAt: string | null;
  deadLetteredAt: string | null;
}

export type WebhookDuplicateOutcome = "duplicate" | "queued";

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validAttemptCount(attemptCount: number): boolean {
  return Number.isInteger(attemptCount) && attemptCount > 0;
}

export function webhookRetryDelayMs(attemptCount: number): number {
  if (!validAttemptCount(attemptCount)) {
    throw new Error("Quantidade de tentativas inválida");
  }
  return Math.min(
    WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** (attemptCount - 1),
    WEBHOOK_RETRY_MAX_DELAY_MS,
  );
}

export function isWebhookEventEligibleForClaim(
  event: WebhookRetryCandidate,
  now = new Date(),
): boolean {
  if (!validAttemptCount(event.attemptCount) || event.attemptCount >= MAX_WEBHOOK_ATTEMPTS) return false;

  if (event.processingStatus === "pending" || event.processingStatus === "failed") {
    const nextAttemptAt = timestamp(event.nextAttemptAt);
    return nextAttemptAt === null || nextAttemptAt <= now.getTime();
  }

  if (event.processingStatus === "processing") {
    const lockedAt = timestamp(event.lockedAt);
    return lockedAt !== null && lockedAt <= now.getTime() - PROCESSING_LOCK_TIMEOUT_MS;
  }

  return false;
}

export function shouldProcessWebhookEvent(status: WebhookProcessingStatus): boolean {
  return status === "processing";
}

export function webhookDuplicateOutcome(status: WebhookProcessingStatus): WebhookDuplicateOutcome {
  return status === "processed" || status === "dead_letter" ? "duplicate" : "queued";
}

export function nextWebhookFailureState(attemptCount: number, now = new Date()): WebhookFailureState {
  if (!validAttemptCount(attemptCount)) {
    throw new Error("Quantidade de tentativas inválida");
  }
  const occurredAt = now.toISOString();
  if (attemptCount >= MAX_WEBHOOK_ATTEMPTS) {
    return {
      processingStatus: "dead_letter",
      nextAttemptAt: null,
      deadLetteredAt: occurredAt,
    };
  }

  return {
    processingStatus: "failed",
    nextAttemptAt: new Date(now.getTime() + webhookRetryDelayMs(attemptCount)).toISOString(),
    deadLetteredAt: null,
  };
}
