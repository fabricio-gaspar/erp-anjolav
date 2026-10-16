import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditEventsQueryPlan,
  createAuditEventsCursor,
} from "../src/lib/auditEvents.ts";

function withTimeZone<T>(timeZone: string, callback: () => T): T {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = timeZone;

  try {
    return callback();
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
}

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
      from: "",
      to: "",
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
    occurredAtFrom: null,
    occurredAtBefore: null,
  });
  assert.equal(plan.columns.includes("old_data"), false);
  assert.equal(plan.columns.includes("new_data"), false);
  assert.equal(plan.columns.includes("actor_id"), false);
  assert.equal(plan.columns.includes("tenant_id"), false);
});

test("converte filtros de data para os limites inclusivo e exclusivo do dia local exibido", () => {
  withTimeZone("America/Sao_Paulo", () => {
    const plan = buildAuditEventsQueryPlan({
      filters: { from: "2026-10-15", to: "2026-10-15" },
    });

    assert.deepEqual(
      {
        occurredAtFrom: plan.filters.occurredAtFrom,
        occurredAtBefore: plan.filters.occurredAtBefore,
      },
      {
        occurredAtFrom: "2026-10-15T03:00:00.000Z",
        occurredAtBefore: "2026-10-16T03:00:00.000Z",
      },
    );
  });

  withTimeZone("America/New_York", () => {
    const plan = buildAuditEventsQueryPlan({
      filters: { from: "2026-03-08", to: "2026-03-08" },
    });

    assert.deepEqual(
      {
        occurredAtFrom: plan.filters.occurredAtFrom,
        occurredAtBefore: plan.filters.occurredAtBefore,
      },
      {
        occurredAtFrom: "2026-03-08T05:00:00.000Z",
        occurredAtBefore: "2026-03-09T04:00:00.000Z",
      },
    );
  });
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
