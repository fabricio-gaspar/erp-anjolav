const PORTAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PORTAL_CODE_LENGTH = 32;

export function normalizePortalAccessCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isStrongPortalAccessCode(value: string): boolean {
  const normalized = normalizePortalAccessCode(value);
  return (
    normalized.length === PORTAL_CODE_LENGTH &&
    [...normalized].every((character) => PORTAL_CODE_ALPHABET.includes(character))
  );
}

export function generatePortalAccessCode(): string {
  const bytes = new Uint8Array(PORTAL_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);

  return [...bytes]
    .map((byte) => PORTAL_CODE_ALPHABET[byte & 31])
    .join("");
}
