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
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, body };
}

export type WaAkgSendOutcome =
  | { state: "accepted"; messageId: string }
  | { state: "rejected"; code: string }
  | { state: "uncertain"; code: string };

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
