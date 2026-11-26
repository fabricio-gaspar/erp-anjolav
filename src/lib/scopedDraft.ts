const DRAFT_PREFIX = "anjolav:draft:v1:";
const MAX_DRAFT_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function scopedDraftKey(userId: string | undefined, tenantId: string | undefined, scope: string) {
  return userId && tenantId ? `${DRAFT_PREFIX}${userId}:${tenantId}:${scope}` : null;
}

export function readScopedDraft<T>(key: string | null): T | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { savedAt?: number; value?: T };
    if (!stored.savedAt || Date.now() - stored.savedAt > MAX_DRAFT_AGE_MS || !stored.value) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return stored.value;
  } catch {
    return null;
  }
}

export function writeScopedDraft<T>(key: string | null, value: T) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // O formulário permanece disponível mesmo se o armazenamento do navegador falhar.
  }
}

export function clearScopedDraft(key: string | null) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nada a limpar quando o armazenamento está indisponível.
  }
}

export function clearAllScopedDrafts() {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // O logout continua mesmo se o armazenamento estiver indisponível.
  }
}
