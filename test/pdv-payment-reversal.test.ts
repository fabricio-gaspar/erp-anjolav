import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const migration = readFileSync(join(root, "supabase", "migrations", "20261019100000_pdv_payment_reversal.sql"), "utf8");
const editMigration = readFileSync(join(root, "supabase", "migrations", "20261019110000_pdv_payment_edit.sql"), "utf8");
const edgeFunction = readFileSync(join(root, "supabase", "functions", "pdv-payment", "index.ts"), "utf8");
const osModal = readFileSync(join(root, "src", "components", "caixa", "ConsultarOSModal.tsx"), "utf8");

test("estorno do PDV preserva o pagamento e registra o movimento inverso", () => {
  assert.match(migration, /status = 'ESTORNADO'/);
  assert.match(migration, /INSERT INTO public\.caixa_movimentacoes/);
  assert.match(migration, /evento_pagamento, categoria_id, centro_custo_id/);
  assert.match(migration, /'ESTORNO'/);
  assert.match(migration, /v_pagamento\.status NOT IN \('CONFIRMADO', 'EM_REVISAO'\)/);
  assert.doesNotMatch(migration, /DELETE FROM public\.pdv_pagamentos/);
});

test("estorno exige perfil administrativo, motivo e não mascara dependência de provedor", () => {
  assert.match(edgeFunction, /action === "reverse_payment"/);
  assert.match(edgeFunction, /requireAdmin\(req, supabase\)/);
  assert.match(edgeFunction, /requireReason\(raw\.reason\)/);
  assert.match(migration, /role IN \('owner', 'admin'\)/);
  assert.match(migration, /provedor NOT IN \('MANUAL', 'LEGACY'\)/);
});

test("consulta da OS expõe histórico e confirmação do estorno", () => {
  assert.match(osModal, /usePdvPaymentsForOrder/);
  assert.match(osModal, /Histórico de pagamentos/);
  assert.match(osModal, /Confirmar estorno/);
  assert.match(osModal, /Informe pelo menos 5 caracteres/);
});

test("correção de pagamento preserva histórico e exige operação administrativa", () => {
  assert.match(editMigration, /CREATE OR REPLACE FUNCTION public\.editar_pagamento_pdv/);
  assert.match(editMigration, /PERFORM public\.estornar_pagamento_pdv/);
  assert.match(editMigration, /INSERT INTO public\.pdv_pagamentos/);
  assert.match(editMigration, /provedor.*NOT IN \('MANUAL', 'LEGACY'\)/);
  assert.match(edgeFunction, /action === "edit_payment"/);
  assert.match(edgeFunction, /requireCorrectionMethod\(raw\.newMethod\)/);
  assert.match(osModal, /Editar pagamento/);
  assert.match(osModal, /Salvar correção/);
});
