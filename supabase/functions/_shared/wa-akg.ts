import { requireAllowlistedHttpsUrl } from "./safe-url.ts";

export type WaAkgResult = {
  response: Response;
  body: Record<string, unknown>;
};

export function waAkgSessionId(tenantId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error("Empresa inválida");
  return `anjolav-${tenantId.toLowerCase()}`;
}

export function normalizeBrazilianWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  // A local number can itself begin with DDD 55. Length distinguishes it
  // from a number that already includes the country code.
  const normalized = digits.length === 10 || digits.length === 11
    ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(normalized) ? normalized : null;
}

export function waAkgBaseUrl(raw: string): URL {
  const url = requireAllowlistedHttpsUrl(raw, "WA_AKG_ALLOWED_HOSTS");
  if (url.pathname !== "/" || url.search || url.hash || (url.port && url.port !== "443")) {
    throw new Error("Use somente a origem HTTPS da instalação WA-AKG");
  }
  return url;
}

export function waAkgQrCode(body: Record<string, unknown>): string | null {
  // The installed WA-AKG returns { success, qr, base64 } at the top level.
  if (body.success !== true || typeof body.base64 !== "string") return null;
  const value = body.base64.replace(/^data:image\/png;base64,/, "");
  return value.length > 0 && value.length <= 250_000 && /^[A-Za-z0-9+/=]+$/.test(value)
    ? value : null;
}

export async function waAkgRequest(
  baseUrl: URL,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<WaAkgResult> {
  const url = new URL(`/api/${path.replace(/^\/+/, "")}`, baseUrl);
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: (() => {
      const headers = new Headers(init.headers);
      headers.set("X-API-Key", apiKey);
      if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
      }
      return headers;
    })(),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, body };
}

export type WaAkgSendOutcome =
  | { state: "accepted"; messageId?: string }
  | { state: "rejected"; code: string; hint?: string }
  | { state: "uncertain"; code: string; hint?: string };

export type WaAkgMediaType = "image" | "document";

function safeProviderHint(body: Record<string, unknown>): string | undefined {
  const nestedError = body.error && typeof body.error === "object"
    ? body.error as Record<string, unknown>
    : undefined;
  const raw = typeof body.message === "string"
    ? body.message
    : typeof body.error === "string"
      ? body.error
      : typeof nestedError?.message === "string"
        ? nestedError.message
        : undefined;
  if (!raw) return undefined;

  const safe = raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[id]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[telefone]")
    .replace(/(api[-_ ]?key|authorization)\s*[:=]\s*\S+/gi, "$1=[redigido]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return safe || undefined;
}

// WA-AKG does not document an idempotency header for /send. Once a request
// might have reached it, only reconciliation can permit another attempt.
export async function sendWaAkgText(
  baseUrl: URL,
  apiKey: string,
  sessionId: string,
  phone: string,
  message: string,
): Promise<WaAkgSendOutcome> {
  const jid = `${phone}@s.whatsapp.net`;
  try {
    const { response, body } = await waAkgRequest(
      baseUrl,
      apiKey,
      `messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/send`,
      { method: "POST", body: JSON.stringify({ message: { text: message } }) },
    );
    if (response.ok && body.status !== false) {
      const data = body.data as Record<string, unknown> | undefined;
      const key = data?.key as Record<string, unknown> | undefined;
      if (typeof key?.id === "string" && key.id.length > 0 && key.id.length <= 256) {
        return { state: "accepted", messageId: key.id };
      }
      return { state: "uncertain", code: "PROVIDER_ACK_WITHOUT_ID" };
    }
    if ([400, 401, 403, 404, 422, 429].includes(response.status)) {
      return { state: "rejected", code: `HTTP_${response.status}` };
    }
    return { state: "uncertain", code: `HTTP_${response.status}` };
  } catch {
    return { state: "uncertain", code: "NETWORK_OR_TIMEOUT" };
  }
}

export async function sendWaAkgMedia(
  baseUrl: URL,
  apiKey: string,
  sessionId: string,
  phone: string,
  file: Uint8Array,
  filename: string,
  mimeType: string,
  caption: string,
  mediaType: WaAkgMediaType = "document",
): Promise<WaAkgSendOutcome> {
  const jid = `${phone}@s.whatsapp.net`;
  try {
    const form = new FormData();
    form.append("file", new File([Uint8Array.from(file)], filename, { type: mimeType }), filename);
    form.append("type", mediaType);
    if (caption) form.append("caption", caption);
    const { response, body } = await waAkgRequest(
      baseUrl,
      apiKey,
      `messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/media`,
      { method: "POST", body: form },
    );
    if (response.ok && body.status === true) {
      const data = body.data as Record<string, unknown> | undefined;
      const key = data?.key as Record<string, unknown> | undefined;
      const providerId = key?.id || data?.messageId || data?.id;
      return {
        state: "accepted",
        ...(typeof providerId === "string" && providerId.length > 0 && providerId.length <= 256
          ? { messageId: providerId }
          : {}),
      };
    }
    if (response.ok) {
      return { state: "uncertain", code: "PROVIDER_ACK_INVALID", hint: safeProviderHint(body) };
    }
    if ([400, 401, 403, 404, 422, 429].includes(response.status)) {
      return { state: "rejected", code: `HTTP_${response.status}`, hint: safeProviderHint(body) };
    }
    return { state: "uncertain", code: `HTTP_${response.status}`, hint: safeProviderHint(body) };
  } catch {
    return { state: "uncertain", code: "NETWORK_OR_TIMEOUT" };
  }
}

export function isWaAkgMediaUploadFailure(outcome: WaAkgSendOutcome): boolean {
  return outcome.state !== "accepted"
    && outcome.code === "HTTP_500"
    && /(?:media upload failed on all hosts|failed to send media)/i.test(outcome.hint || "");
}


