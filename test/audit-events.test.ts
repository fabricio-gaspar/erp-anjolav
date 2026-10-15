import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditEventsQueryPlan,
  createAuditEventsCursor,
} from "../src/lib/auditEvents.ts";

test("monta uma consulta paginada que pede somente o resumo seguro da auditoria", () => {
  const cursor = createAuditEventsCursor({
    id: "09b75b77-4f6f-47a1-ae30-d236803340a3",
    occurred_at: "2026-10-15T14:30:00.000Z",
  });

  const plan = buildAuditEventsQueryPlan({
    cursor,
    limit: 25,
    filters: {
      action: "UPDATE",
      entity: "ordens_servico",
      from: "2026-10-01",
      to: "2026-10-15",
    },
  });

  assert.deepEqual(plan.columns, ["id", "action", "entity_schema", "entity_table", "occurred_at"]);
  assert.equal(plan.limit, 25);
  assert.deepEqual(plan.cursor, {
    id: "09b75b77-4f6f-47a1-ae30-d236803340a3",
    occurredAt: "2026-10-15T14:30:00.000Z",
  });
  assert.deepEqual(plan.filters, {
    action: "UPDATE",
    entity: "ordens_servico",
    occurredAtFrom: "2026-10-01T00:00:00.000Z",
    occurredAtBefore: "2026-10-16T00:00:00.000Z",
  });
  assert.equal(plan.columns.includes("old_data"), false);
  assert.equal(plan.columns.includes("new_data"), false);
  assert.equal(plan.columns.includes("actor_id"), false);
  assert.equal(plan.columns.includes("tenant_id"), false);
});

test("rejeita cursores inválidos e limita a página a um tamanho seguro", () => {
  const plan = buildAuditEventsQueryPlan({
    cursor: "cursor-manipulado",
    limit: 10_000,
    filters: { action: "DELETE", entity: "clientes;drop", from: "", to: "" },
  });

  assert.equal(plan.cursor, null);
  assert.equal(plan.limit, 100);
  assert.deepEqual(plan.filters, {
    action: "DELETE",
    entity: "clientesdrop",
    occurredAtFrom: null,
    occurredAtBefore: null,
  });
});
