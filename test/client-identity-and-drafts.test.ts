import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClientName, normalizeClientPhone, validateClientIdentity } from "../src/lib/clientIdentity.ts";
import { clearAllScopedDrafts, readScopedDraft, restoreDraftDate, scopedDraftKey, writeScopedDraft } from "../src/lib/scopedDraft.ts";

test("restaura a data do rascunho após serialização e usa data segura se estiver inválida", () => {
  const original = new Date("2026-11-30T15:00:00.000Z");
  const saved = JSON.parse(JSON.stringify({ deliveryDate: original }));
  const restored = restoreDraftDate(saved.deliveryDate, new Date("2026-12-01T00:00:00.000Z"));
  assert.ok(restored instanceof Date);
  assert.equal(restored.getTime(), original.getTime());
  const fallback = new Date("2026-12-01T00:00:00.000Z");
  assert.equal(restoreDraftDate("inválida", fallback), fallback);
});

test("normaliza telefone brasileiro e rejeita o dígito extra que gerou a duplicata", () => {
  assert.equal(normalizeClientPhone("+55 (11) 99741-2724"), "11997412724");
  assert.equal(normalizeClientName("  MISLENE  BARBOSA DA SILVA "), normalizeClientName("Mislene Barbosa da Silva"));
  const draft = {
    personType: "cpf" as const,
    classification: "domestico" as const,
    document: "", legalName: "Mislene Barbosa da Silva", tradeName: "", email: "",
    phone: "119974412724", secondaryPhone: "", contact: "", stateRegistration: "",
    municipalRegistration: "", taxRegime: "", notes: "",
  };
  assert.match(validateClientIdentity(draft).phone ?? "", /10 ou 11 dígitos/);
  assert.equal(validateClientIdentity({ ...draft, phone: "+55 11 99741-2724" }).phone, undefined);
});

test("rascunhos ficam separados por usuário e empresa e saem no logout", () => {
  const values = new Map<string, string>();
  const sessionStorage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
    removeItem(key: string) { values.delete(key); },
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage } });
  try {
    const first = scopedDraftKey("usuario-a", "empresa-a", "pdv:domestico:rol");
    const otherUser = scopedDraftKey("usuario-b", "empresa-a", "pdv:domestico:rol");
    const otherTenant = scopedDraftKey("usuario-a", "empresa-b", "pdv:domestico:rol");
    writeScopedDraft(first, { notes: "rascunho" });
    values.set("outra-chave", "preservar");
    assert.deepEqual(readScopedDraft(first), { notes: "rascunho" });
    assert.equal(readScopedDraft(otherUser), null);
    assert.equal(readScopedDraft(otherTenant), null);
    clearAllScopedDrafts();
    assert.equal(readScopedDraft(first), null);
    assert.equal(values.get("outra-chave"), "preservar");
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
