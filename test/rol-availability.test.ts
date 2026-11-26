import assert from "node:assert/strict";
import test from "node:test";
import { isRolReadyForNotification } from "../src/lib/rolAvailability.ts";

test("uma peça posicionada não libera aviso enquanto outra do mesmo ROL está pendente", () => {
  const items = [
    { ordemId: "rol-a", disponivel: true },
    { ordemId: "rol-a", disponivel: false },
    { ordemId: "rol-b", disponivel: true },
  ];
  assert.equal(isRolReadyForNotification(items, "rol-a"), false);
  assert.equal(isRolReadyForNotification(items, "rol-b"), true);
  assert.equal(isRolReadyForNotification(items, "rol-inexistente"), false);
  items[1].disponivel = true;
  assert.equal(isRolReadyForNotification(items, "rol-a"), true);
});
