import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const tenant = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const client = "44444444-4444-4444-8444-444444444444";
const order = "55555555-5555-4555-8555-555555555555";
const cash = "66666666-6666-4666-8666-666666666666";
const payment = "77777777-7777-4777-8777-777777777777";
const product = "88888888-8888-4888-8888-888888888888";
const scripts = ["_shared/auth.ts", "pdv-payment/index.ts"].map((path) => {
  const source = readFileSync(new URL(`../supabase/functions/${path}`, import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "").replace(/^export /gm, "");
  return new vm.Script(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText, { filename: path });
});

function fixture({ area = "industrial", role = "member", modules = ["caixa"], employeeActive = true,
  clientArea = "industrial", orderArea = "industrial", orderTenant = tenant, terms = "retirada", cashTenant = tenant,
  cashStatus = "ABERTO", clientActive = true, failTable = null, providerResponse = null } = {}) {
  const rows = {
    tenant_memberships: [{ id: "member", tenant_id: tenant, user_id: user, enabled: true, is_active: true, role, tenant: { status: "active" } }],
    funcionarios: [{ id: "employee", tenant_id: tenant, user_id: user, ativo: employeeActive }],
    area_permissoes: [{ tenant_id: tenant, user_id: user, area }],
    modulo_permissoes: modules.map((modulo_key) => ({ tenant_id: tenant, funcionario_id: "employee", modulo_key, tem_acesso: true })),
    clientes: [{ id: client, tenant_id: tenant, ativo: clientActive, classificacao: clientArea, cpf_cnpj: "00000000000" }],
    caixas: [{ id: cash, tenant_id: cashTenant, status: cashStatus }],
    ordens_servico: [{ id: order, tenant_id: orderTenant, cliente_id: client, origem: orderArea, condicao_pagamento: terms, status: "retirada", valor_total: 100, valor_pago: 0 }],
    pdv_pagamentos: [{ id: payment, tenant_id: tenant, ordem_servico_id: order, metodo: "PIX", asaas_charge_id: "charge", provedor_pagamento_id: "pay_test", idempotency_key: "old-payment-key", valor: 100 }],
    asaas_charges: [{ id: "charge", tenant_id: tenant, external_reference: "old-payment-key" }],
  };
  const calls = [];
  const queries = [];
  const providerCalls = [];
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) },
    from(table) {
      const filters = [];
      let single = false;
      const query = {
        select() { return query; },
        update() { return query; },
        eq(key, value) { filters.push((row) => key.split(".").reduce((object, part) => object?.[part], row) === value); return query; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() { single = true; return query; },
        single() { single = true; return query; },
        then(resolve, reject) {
          queries.push(table);
          const data = (rows[table] ?? []).filter((row) => filters.every((matches) => matches(row)));
          return Promise.resolve({ data: single ? data[0] ?? null : data, error: table === failTable ? new Error("database unavailable") : null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: name === "criar_venda_pdv" ? { order: { id: order } } : {}, error: null };
    },
  };
  let handler;
  const context = vm.createContext({
    Response, Request, console: { error() {} }, TextEncoder, crypto: globalThis.crypto, AbortSignal,
    createClient: () => supabase,
    Deno: { env: { get: (key) => key === "ASAAS_ENVIRONMENT" ? "sandbox" : "local-test-placeholder" }, serve: (callback) => { handler = callback; } },
    jsonResponse: (_req, value, status = 200) => Response.json(value, { status }),
    handlePreflight: () => null, requireJsonPost: () => null,
    readJsonBody: async (req) => ({ ok: true, value: await req.json() }),
    isValidCpfCnpj: () => true,
    fetch: async (...args) => {
      providerCalls.push(args);
      if (providerResponse) return Response.json(providerResponse);
      throw new Error("External calls forbidden in test");
    },
  });
  for (const script of scripts) script.runInContext(context);
  return {
    rows, calls, queries, providerCalls,
    async invoke(body) {
      const response = await handler(new Request("https://local.invalid/pdv", {
        method: "POST", headers: { authorization: "Bearer test" }, body: JSON.stringify(body),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

const sale = () => ({ action: "create_sale", clientId: client, cashRegisterId: null,
  deliveryDate: "2027-01-01", urgent: false, urgencyPercentage: 0, discountAmount: 0,
  items: [{ produto_id: product, quantidade: 1 }], payment: null, idempotencyKey: "sale-test-key" });
const cashPayment = { method: "DINHEIRO", amount: 100, amountReceived: 100, installments: 1 };

test("billing-only employee creates an unpaid industrial sale without a cash register", async () => {
  const app = fixture({ modules: ["faturamento"] });
  assert.equal((await app.invoke(sale())).status, 200);
  assert.equal(app.calls[0].args._caixa_id, null);
  assert.equal(app.calls[0].args._pagamento, null);
  assert.equal(app.queries.includes("caixas"), false);
});

test("billing-only employee cannot receive payment, retrieve history, or generate PIX", async () => {
  for (const body of [
    { ...sale(), cashRegisterId: cash, payment: cashPayment },
    { action: "list_payments", orderId: order },
    { action: "create_pix", orderId: order, cashRegisterId: cash, idempotencyKey: "pix-test-key" },
  ]) {
    const app = fixture({ modules: ["faturamento"] });
    assert.equal((await app.invoke(body)).status, 403);
    assert.equal(app.calls.length, 0);
    assert.equal(app.providerCalls.length, 0);
  }
});

test("payment requires a cash register even when the employee has caixa permission", async () => {
  for (const paymentInput of [cashPayment, { method: "PIX" }]) {
    const app = fixture();
    assert.equal((await app.invoke({ ...sale(), payment: paymentInput })).status, 400);
    assert.equal(app.calls.length, 0);
  }
});

test("industrial and residential cashiers can only create sales in their granted area", async () => {
  for (const area of ["industrial", "residencial"]) {
    const own = fixture({ area, clientArea: area });
    assert.equal((await own.invoke(sale())).status, 200);
    const other = fixture({ area, clientArea: area === "industrial" ? "residencial" : "industrial" });
    assert.equal((await other.invoke(sale())).status, 403);
    assert.equal(other.calls.length, 0);
  }
});

test("central and tenant administrators may use both areas, but need an active employee", async () => {
  for (const config of [{ area: "central" }, { area: "none", role: "admin", modules: [] }]) {
    const app = fixture(config);
    assert.equal((await app.invoke(sale())).status, 200);
    const inactive = fixture({ ...config, employeeActive: false });
    assert.equal((await inactive.invoke(sale())).status, 403);
    assert.equal(inactive.calls.length, 0);
  }
});

test("inactive customers and failed permission lookups cannot create an order", async () => {
  for (const config of [{ clientActive: false }, { failTable: "area_permissoes" }]) {
    const app = fixture(config);
    assert.ok((await app.invoke(sale())).status >= 400);
    assert.equal(app.calls.length, 0);
  }
});

test("PIX placeholder reaches SQL so entrada cannot be confused with an unpaid sale", async () => {
  const app = fixture();
  const result = await app.invoke({ ...sale(), cashRegisterId: cash, payment: { method: "PIX" } });
  assert.equal(result.status, 200);
  assert.equal(app.calls[0].args._pagamento.metodo, "PIX");
  assert.equal(result.body.pix, null);
  assert.ok(result.body.pixError); // No provider configuration/data supplied in this local test.
});

test("billed orders cannot receive direct cash, loyalty, or PIX payments", async () => {
  for (const action of ["record_payment", "redeem_loyalty", "create_pix"]) {
    const app = fixture({ terms: "faturado" });
    const result = await app.invoke({ action, orderId: order, cashRegisterId: cash, payment: cashPayment,
      points: 100, idempotencyKey: "payment-test-key" });
    assert.equal(result.status, 409);
    assert.match(result.body.error, /faturado/);
    assert.equal(app.calls.length, 0);
    assert.equal(app.providerCalls.length, 0);
  }
});

test("all order actions reject another tenant, another area and unknown origins", async () => {
  for (const config of [{ orderTenant: otherTenant }, { orderArea: "residencial" }, { orderArea: "unknown" }]) {
    for (const action of ["record_payment", "redeem_loyalty", "create_pix", "list_payments", "loyalty_summary"]) {
      const app = fixture(config);
      assert.equal((await app.invoke({ action, orderId: order, cashRegisterId: cash, payment: cashPayment,
        points: 100, idempotencyKey: "payment-test-key" })).status, 403);
      assert.equal(app.calls.length, 0);
      assert.equal(app.providerCalls.length, 0);
    }
  }
});

test("payment-id actions validate the parent order tenant and sector before provider or RPC calls", async () => {
  for (const config of [{ orderArea: "residencial" }, { orderTenant: otherTenant }]) {
    for (const action of ["get_pix_status", "cancel_pix"]) {
      const app = fixture(config);
      assert.equal((await app.invoke({ action, paymentId: payment })).status, 403);
      assert.equal(app.calls.length, 0);
      assert.equal(app.providerCalls.length, 0);
    }
  }
  for (const action of ["reverse_payment", "edit_payment"]) {
    const app = fixture({ role: "admin", orderTenant: otherTenant });
    assert.equal((await app.invoke({ action, paymentId: payment, reason: "Test correction", newValue: 100, newMethod: "DINHEIRO" })).status, 403);
    assert.equal(app.calls.length, 0);
  }
});

test("foreign or closed cash registers are rejected before generating PIX", async () => {
  for (const config of [{ cashTenant: otherTenant }, { cashStatus: "FECHADO" }]) {
    const app = fixture(config);
    assert.ok((await app.invoke({ action: "create_pix", orderId: order, cashRegisterId: cash,
      idempotencyKey: "pix-test-key" })).status >= 400);
    assert.equal(app.providerCalls.length, 0);
    assert.equal(app.calls.length, 0);
  }
});

test("manual payments support both sectors and legacy loja orders", async () => {
  for (const orderArea of ["industrial", "residencial", "loja"]) {
    const app = fixture({ area: "central", orderArea });
    assert.equal((await app.invoke({ action: "record_payment", orderId: order, cashRegisterId: cash,
      payment: cashPayment, idempotencyKey: "payment-test-key" })).status, 200);
    assert.equal(app.calls[0].name, "registrar_pagamento_pdv");
  }
});

test("loyalty redemption stays residential and explains the restriction", async () => {
  const app = fixture();
  const result = await app.invoke({ action: "redeem_loyalty", orderId: order, cashRegisterId: cash, points: 10, idempotencyKey: "loyalty-test-key" });
  assert.equal(result.status, 409);
  assert.match(result.body.error, /somente.*residenciais/);
  assert.equal(app.calls.length, 0);
});

test("provider lookup namespaces a supplied idempotency key by tenant and order", async () => {
  const references = [];
  for (const targetOrder of [order, product]) {
    const app = fixture();
    app.rows.ordens_servico[0].id = targetOrder;
    app.rows.pdv_pagamentos = [];
    await app.invoke({ action: "create_pix", orderId: targetOrder, cashRegisterId: cash, idempotencyKey: "same-client-key" });
    assert.equal(app.providerCalls.length, 1);
    const reference = new URL(app.providerCalls[0][0]).searchParams.get("externalReference");
    assert.match(reference, /^pdv:[a-f0-9]{64}$/);
    references.push(reference);
  }
  assert.notEqual(references[0], references[1]);
});

test("legacy PIX reconciliation uses the persisted charge reference", async () => {
  const app = fixture({ providerResponse: { id: "pay_test", status: "PENDING", billingType: "PIX", value: 100, externalReference: "legacy-charge-reference" } });
  app.rows.asaas_charges[0].external_reference = "legacy-charge-reference";
  const result = await app.invoke({ action: "get_pix_status", paymentId: payment });
  assert.equal(result.status, 200);
  assert.equal(app.calls[0].name, "reconciliar_pagamento_pdv");
});

test("loyalty customer summary does not reveal another sector or tenant", async () => {
  for (const foreignTenant of [false, true]) {
    const app = fixture({ clientArea: "residencial" });
    if (foreignTenant) app.rows.clientes[0].tenant_id = otherTenant;
    assert.equal((await app.invoke({ action: "loyalty_customer_summary", clientId: client })).status, 403);
    assert.equal(app.queries.includes("fidelidade_lancamentos"), false);
  }
});
