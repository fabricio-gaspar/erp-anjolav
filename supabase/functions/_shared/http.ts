const LOCAL_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
]);

function configuredOrigins(): Set<string> {
  const configured = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...LOCAL_ORIGINS, ...configured]);
}

export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  return !origin || configuredOrigins().has(origin);
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };

  if (origin && configuredOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isOriginAllowed(req)) return jsonResponse(req, { error: "Origem não autorizada" }, 403);
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function requireJsonPost(req: Request): Response | null {
  if (!isOriginAllowed(req)) return jsonResponse(req, { error: "Origem não autorizada" }, 403);
  if (req.method !== "POST") return jsonResponse(req, { error: "Método não permitido" }, 405);

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonResponse(req, { error: "Content-Type deve ser application/json" }, 415);
  }

  return null;
}

export function serverJsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; response: Response };

async function readBodyBytes(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel("request body too large").catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}

async function parseJsonBody(
  req: Request,
  maxBytes: number,
  response: (body: Record<string, unknown>, status: number) => Response,
): Promise<JsonBodyResult> {
  const bytes = await readBodyBytes(req, maxBytes);
  if (!bytes) {
    return { ok: false, response: response({ error: "Requisição muito grande" }, 413) };
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: response({ error: "JSON inválido" }, 400) };
  }
}

export function readJsonBody(req: Request, maxBytes = 65_536): Promise<JsonBodyResult> {
  return parseJsonBody(req, maxBytes, (body, status) => jsonResponse(req, body, status));
}

export function readServerJsonBody(req: Request, maxBytes = 65_536): Promise<JsonBodyResult> {
  return parseJsonBody(req, maxBytes, serverJsonResponse);
}
