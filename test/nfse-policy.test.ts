import assert from "node:assert/strict";
import test from "node:test";
import { selectFiscalEmitter, type FiscalEmitterSummary } from "../src/lib/nfsePolicy.ts";

const base = {
  cnpj: "00.000.000/0000-00",
  ativo: true,
  ambiente: "homologacao",
  modo_emissao: "homologacao",
  credencial_status: "configurada",
} satisfies Omit<FiscalEmitterSummary, "id" | "nome" | "operation_type">;

const emitters: FiscalEmitterSummary[] = [
  { ...base, id: "res", nome: "CNPJ Doméstico", operation_type: "domestico" },
  { ...base, id: "ind", nome: "CNPJ Industrial", operation_type: "industrial" },
];

test("prioriza o CNPJ definido no cadastro do cliente", () => {
  const result = selectFiscalEmitter(emitters, "ind", "domestico");
  assert.equal(result.emitter?.id, "ind");
  assert.equal(result.source, "cliente");
});

test("usa o CNPJ padrão da operação quando o cliente não definiu um", () => {
  const result = selectFiscalEmitter(emitters, null, "domestico");
  assert.equal(result.emitter?.id, "res");
  assert.equal(result.source, "operacao");
});

test("não escolhe arbitrariamente entre dois CNPJs", () => {
  const withoutDefaults = emitters.map((emitter) => ({ ...emitter, operation_type: null }));
  const result = selectFiscalEmitter(withoutDefaults, null, null);
  assert.equal(result.emitter, null);
  assert.match(result.issue || "", /não escolherá/i);
});

test("bloqueia preferência apontando para emitente inativo", () => {
  const result = selectFiscalEmitter([{ ...emitters[0], ativo: false }], "res", "domestico");
  assert.equal(result.emitter, null);
  assert.match(result.issue || "", /inativo/i);
});
