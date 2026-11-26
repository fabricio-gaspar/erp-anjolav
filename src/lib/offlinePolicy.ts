import type { QueryKey } from "@tanstack/react-query";

export const OFFLINE_CACHE_SCHEMA_VERSION = 1;
export const OFFLINE_QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const OFFLINE_REFERENCE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const OFFLINE_REFERENCE_REFRESH_MS = 15 * 60 * 1_000;

const OFFLINE_QUERY_PREFIXES = new Set([
  "accessible-workspaces",
  "authorization",
  "caixa-aberto",
  "clientes",
  "configuracao_pagamento_cliente",
  "configuracoes_gerais",
  "endereco_cliente",
  "offline-pdv-package",
  "operational-access-context",
  "permissoes-usuario",
  "precos_especiais",
  "produtos",
  "rol-config",
]);

export function shouldPersistOfflineQuery(queryKey: QueryKey): boolean {
  return typeof queryKey[0] === "string" && OFFLINE_QUERY_PREFIXES.has(queryKey[0]);
}

export function isOfflineLikeError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const source = error as { message?: unknown; status?: unknown; context?: { status?: unknown } } | null;
  const status = Number(source?.status ?? source?.context?.status ?? 0);
  if (status === 0 || status === 408 || status === 425 || status === 429 || status >= 500) {
    if (status !== 0) return true;
  }
  const message = String(source?.message ?? error ?? "").toLowerCase();
  return [
    "failed to fetch",
    "fetch failed",
    "network",
    "networkerror",
    "load failed",
    "connection",
    "timeout",
    "temporarily unavailable",
  ].some((fragment) => message.includes(fragment));
}

export interface OfflineSyncFailure {
  retryable: boolean;
  message: string;
  status: number | null;
}

export function classifyOfflineSyncFailure(error: unknown): OfflineSyncFailure {
  const source = error as { message?: unknown; status?: unknown; context?: { status?: unknown } } | null;
  const numericStatus = Number(source?.status ?? source?.context?.status ?? 0);
  const status = Number.isFinite(numericStatus) && numericStatus > 0 ? numericStatus : null;
  const retryable = isOfflineLikeError(error) || status === 408 || status === 425 || status === 429 || Boolean(status && status >= 500);
  const message = typeof source?.message === "string" && source.message.trim()
    ? source.message.trim().slice(0, 500)
    : "Não foi possível sincronizar o ROL.";
  return { retryable, message, status };
}

export function isOfflineReferenceFresh(updatedAt: string | null | undefined, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && now - timestamp <= OFFLINE_REFERENCE_MAX_AGE_MS;
}
