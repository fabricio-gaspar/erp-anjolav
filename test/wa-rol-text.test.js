import test from "node:test";
import assert from "node:assert/strict";
import { processReservedDelivery } from "../supabase/functions/_shared/wa-delivery.ts";

const tenant = "11111111-1111-4111-8111-111111111111";
const order = "22222222-2222-4222-8222-222222222222";
const phone = "5511999999999";
const env = { WA_AKG_ENABLED: "true", WA_AKG_API_KEY: "fake-key", WA_AKG_ALLOWED_HOSTS: "wa.example.test" };
const oldFetch = globalThis.fetch;
globalThis.Deno = { env: { get: (key) => env[key] } };
test.afterEach(() => { globalThis.fetch = oldFetch; });

function database({ claimed = true, event = "rol_entrada", media = null } = {}) {
  const writes = [];
  const row = { id: "delivery", status: "pendente", attempt_count: 0, tenant_id: tenant, cliente_id: "client", telefone: phone, mensagem: "*ROL* teste", evento: event, ordem_servico_id: order, media_storage_path: media, media_mime_type: media ? "application/pdf" : null, media_kind: media ? "document" : null };
  return {
    writes,
    storage: { from() { throw new Error("O envio de texto não deve acessar mídia"); } },
    from(table) {
      let patch = null, selecting = false;
      const q = {
        select() { selecting = true; return q; },
        update(value) { patch = value; writes.push(value); return q; },
        eq() { return q; },
        async maybeSingle() {
          if (table === "mensagens_log" && patch) return { data: claimed ? { id: "delivery" } : null, error: null };
          if (table === "mensagens_log") return { data: row, error: null };
          if (table === "clientes") return { data: { ativo: true, whatsapp_opt_out: false, telefone: phone, telefone2: null }, error: null };
          if (table === "whatsapp_instancias") return { data: { api_url: "https://wa.example.test" }, error: null };
          throw Error(table);
        },
        then(resolve, reject) { return Promise.resolve({ data: selecting ? null : undefined, error: null }).then(resolve, reject); }
      };
      return q;
    }
  };
}

test("avisos de ROL usam texto mesmo quando existe PDF antigo", async () => {
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init };
    return globalThis.Response.json({ status: true, data: { key: { id: "provider-id" } } });
  };
  const db = database({ event: "rol_pronto_retirada", media: "old.pdf" });
  await processReservedDelivery(db, "delivery", tenant);
  assert.match(request.url, /\/send$/);
  assert.deepEqual(JSON.parse(request.init.body), { message: { text: "*ROL* teste" } });
  assert.equal(db.writes.at(-1).status, "enviado");
});

test("sem obter a reserva não dispara mensagem", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; throw Error("unexpected"); };
  const db = database({ claimed: false });
  await processReservedDelivery(db, "delivery", tenant);
  assert.equal(called, false);
});

test("falha de comunicação fica incerta e não gera sucesso falso", async () => {
  globalThis.fetch = async () => { throw Error("network"); };
  const db = database();
  await processReservedDelivery(db, "delivery", tenant);
  assert.equal(db.writes.at(-1).status, "incerto");
});
