/* global URL, Request, Response, Headers, TextEncoder, console */
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const entryFile = fileURLToPath(new URL("../supabase/functions/rol-notifications/index.ts", import.meta.url));
const code = ts.transpileModule(readFileSync(entryFile, "utf8"), {
  fileName: entryFile,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const tenantId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

async function renderNotification({
  event = "rol_entrada",
  deliveryMode = "balcao",
  template = null,
  itemObservation = "Operação: lavagem_passadoria",
  orderObservation = null,
  itemColor = null,
  itemBrand = null,
  itemDamage = null,
} = {}) {
  const reserved = [];
  let handler;
  const item = {
    quantidade: 1,
    preco_unitario: 125,
    subtotal: 125,
    cor_item: itemColor,
    marca_item: itemBrand,
    avarias: itemDamage,
    observacoes: itemObservation,
    posicao_prateleira: "A-1",
    operation_type: "domestico",
    produto: { nome: "Camisa", categoria: null },
  };
  const order = {
    id: orderId,
    numero: "2026-000001",
    cliente_id: "33333333-3333-4333-8333-333333333333",
    atendente_id: null,
    created_at: "2026-11-26T12:00:00Z",
    data_previsao_entrega: "2026-11-28",
    entrega_modalidade: deliveryMode,
    valor_total: 120,
    valor_desconto: 10,
    valor_pago: 40,
    valor_acrescimo_express: 5,
    taxa_entrega: 0,
    delivery_modelo_snapshot: null,
    observacoes: orderObservation,
    status: "aberta",
  };
  const result = (data) => ({ data, error: null });
  const db = {
    auth: { async getUser() { return result({ user: { id: "44444444-4444-4444-8444-444444444444" } }); } },
    from(table) {
      let projection = "";
      const query = {
        select(columns) {
          projection = columns;
          return query;
        },
        eq() { return query; },
        in() { return query; },
        order() { return query; },
        limit() { return query; },
        async maybeSingle() {
          if (table === "tenant_memberships") return result(projection.includes("tenant_id") ? { tenant_id: tenantId } : { id: "membership" });
          if (table === "ordens_servico") return result(projection === "id" ? { id: orderId } : order);
          if (table === "clientes") return result({ id: order.cliente_id, nome_fantasia: "Cliente Teste", telefone: "11999999999", telefone2: null, ativo: true, whatsapp_opt_out: false });
          if (table === "enderecos_clientes") return result(null);
          if (table === "funcionarios") return result({ nome: "Atendente Teste" });
          if (table === "rol_configuracoes") return result({ nome_completo: "Lavanderia Teste" });
          if (table === "notificacoes_config") return result(template === null ? null : { ativo: true, template });
          throw new Error(`Unexpected single-row query: ${table}`);
        },
        async single() {
          if (table === "mensagens_log") return result({ status: "enviado", last_error_code: null });
          throw new Error(`Unexpected status query: ${table}`);
        },
        then(resolve, reject) {
          if (table !== "itens_ordem_servico") throw new Error(`Unexpected list query: ${table}`);
          return Promise.resolve(result([item])).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const env = {
    SUPABASE_URL: "https://example.supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "fake-service-key",
    SUPABASE_ANON_KEY: "fake-anon-key",
  };
  runInNewContext(code, {
    exports: {},
    require(specifier) {
      if (specifier.startsWith("https://esm.sh/@supabase/supabase-js@")) return { createClient: () => db };
      if (specifier === "../_shared/wa-akg.ts") return { normalizeBrazilianWhatsApp: (phone) => `55${phone}` };
      if (specifier === "../_shared/wa-delivery.ts") return {
        async reserveDelivery(_client, payload) {
          reserved.push(payload);
          return { row: { id: "delivery", status: "pendente" }, duplicate: false };
        },
        async processReservedDelivery() {},
      };
      throw new Error(`Unexpected import: ${specifier}`);
    },
    Deno: { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } },
    Request,
    Response,
    Headers,
    TextEncoder,
    crypto: webcrypto,
    console,
  }, { filename: entryFile });

  const response = await handler(new Request("https://example.test/rol-notifications", {
    method: "POST",
    headers: { authorization: "Bearer fake-token", "content-type": "application/json" },
    body: JSON.stringify({ evento: event, ordem_servico_id: orderId }),
  }));
  assert.equal(response.status, 200);
  return { message: reserved[0]?.message, body: await response.json() };
}

test("default entry notice omits unknown service operation and keeps observed detail and amounts", async () => {
  const { message, body } = await renderNotification();
  assert.match(message, /\*AVISO DE ENTRADA · ROL Nº 2026-000001\*/);
  assert.doesNotMatch(message, /operação: não informada/i);
  assert.doesNotMatch(message, /operação: domestico/i);
  assert.match(message, /obs\.: Operação: lavagem_passadoria/);
  assert.match(message, /Valor bruto: R\$\s+125,00/);
  assert.match(message, /Desconto: R\$\s+10,00/);
  assert.match(message, /Lavagem Expressa: \+ R\$\s+5,00/);
  assert.match(message, /Total do ROL: R\$\s+120,00/);
  assert.match(message, /Total recebido: R\$\s+40,00/);
  assert.match(message, /A pagar: R\$\s+80,00/);
  assert.equal(body.sent_count, 1);
  assert.equal(body.success, true);
});

for (const [event, deliveryMode, title] of [
  ["rol_pronto_retirada", "balcao", "AVISO DE DISPONIBILIDADE PARA RETIRADA"],
  ["rol_pronto_delivery", "entrega", "AVISO DE DISPONIBILIDADE PARA DELIVERY"],
]) {
  test(`default ${event} title identifies availability`, async () => {
    const { message } = await renderNotification({ event, deliveryMode, itemObservation: null });
    assert.match(message, new RegExp(`\\*${title} · ROL Nº 2026-000001\\*`));
    assert.doesNotMatch(message, /operação: não informada/i);
    assert.match(message, /local: A-1/);
  });
}

test("configured WhatsApp template keeps its own title and receives corrected item text", async () => {
  const template = "*Texto escolhido pelo cliente*\n{itens}\nValor: {valor}\nRecebido: {valor_recebido}";
  const { message } = await renderNotification({ template });
  assert.match(message, /^\*Texto escolhido pelo cliente\*/);
  assert.doesNotMatch(message, /AVISO DE ENTRADA/);
  assert.match(message, /obs\.: Operação: lavagem_passadoria/);
  assert.match(message, /Valor: R\$\s+120,00/);
  assert.match(message, /Recebido: R\$\s+40,00/);
});

for (const event of ["rol_entrada", "rol_pronto_retirada"]) {
  test(`${event} includes complete notes and item details even with a custom template`, async () => {
    const longDetail = `${"detalhe ".repeat(80)}FIM DO DETALHE`;
    const { message, body } = await renderNotification({
      event, template: "Olá {cliente}", itemObservation: longDetail,
      itemColor: "Azul", itemBrand: "Marca teste", itemDamage: "Mancha\nna gola",
      orderObservation: "Cuidado especial\nEmbalar separado",
    });
    assert.equal(body.success, true);
    for (const expected of [longDetail, "cor: Azul", "marca: Marca teste", "avarias: Mancha\nna gola", "Cuidado especial\nEmbalar separado"]) {
      assert.ok(message.includes(expected), `missing ${expected}`);
    }
  });
}

test("overlong notices fail explicitly instead of silently truncating", async () => {
  const { message, body } = await renderNotification({ orderObservation: "x".repeat(4100) });
  assert.equal(message, undefined);
  assert.equal(body.success, false);
  assert.equal(body.reason, "MESSAGE_TOO_LONG");
});
