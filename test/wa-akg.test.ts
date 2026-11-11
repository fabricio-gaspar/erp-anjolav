import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBrazilianWhatsApp, sendWaAkgText, waAkgBaseUrl, waAkgSessionId } from "../supabase/functions/_shared/wa-akg.ts";

const originalFetch = globalThis.fetch;
const originalDeno = (globalThis as typeof globalThis & { Deno?: unknown }).Deno;

test.after(() => {
  globalThis.fetch = originalFetch;
  (globalThis as typeof globalThis & { Deno?: unknown }).Deno = originalDeno;
});

test("isola a sessão por empresa e rejeita telefone ou origem não autorizados", () => {
  (globalThis as typeof globalThis & { Deno?: unknown }).Deno = {
    env: { get: (key: string) => key === "WA_AKG_ALLOWED_HOSTS" ? "wa.example.com" : undefined },
  };
  assert.equal(normalizeBrazilianWhatsApp("(11) 99999-0000"), "5511999990000");
  assert.equal(normalizeBrazilianWhatsApp("(55) 99999-0000"), "5555999990000");
  assert.equal(normalizeBrazilianWhatsApp("+55 (11) 99999-0000"), "5511999990000");
  assert.equal(normalizeBrazilianWhatsApp("123"), null);
  assert.equal(waAkgSessionId("11111111-1111-4111-8111-111111111111"), "anjolav-11111111-1111-4111-8111-111111111111");
  assert.throws(() => waAkgBaseUrl("https://private.example.com"), /autorizado/);
  assert.throws(() => waAkgBaseUrl("http://wa.example.com"), /HTTPS/);
  assert.equal(waAkgBaseUrl("https://wa.example.com").origin, "https://wa.example.com");
});

test("confirma somente resposta com ID; falha incerta nunca autoriza retry automático", async () => {
  const requests: Array<{ url: string; headers: HeadersInit | undefined; body: string | undefined }> = [];
  const base = new URL("https://wa.example.com");
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: init?.headers, body: String(init?.body) });
    return Response.json({ status: true, data: { key: { id: "ack-123" } } });
  };
  assert.deepEqual(await sendWaAkgText(base, "server-only-key", "anjolav-test", "5511999990000", "Olá"), {
    state: "accepted", messageId: "ack-123",
  });
  assert.match(requests[0].url, /\/api\/messages\/anjolav-test\/5511999990000%40s.whatsapp.net\/send$/);
  assert.deepEqual(JSON.parse(requests[0].body!), { message: { text: "Olá" } });
  assert.equal((requests[0].headers as Record<string, string>)["X-API-Key"], "server-only-key");

  globalThis.fetch = async () => new Response("{}", { status: 503 });
  assert.deepEqual(await sendWaAkgText(base, "key", "session", "5511999990000", "Olá"), {
    state: "uncertain", code: "HTTP_503",
  });
  globalThis.fetch = async () => { throw new Error("timeout"); };
  assert.deepEqual(await sendWaAkgText(base, "key", "session", "5511999990000", "Olá"), {
    state: "uncertain", code: "NETWORK_OR_TIMEOUT",
  });
  globalThis.fetch = async () => new Response("{}", { status: 400 });
  assert.deepEqual(await sendWaAkgText(base, "key", "session", "5511999990000", "Olá"), {
    state: "rejected", code: "HTTP_400",
  });
});
