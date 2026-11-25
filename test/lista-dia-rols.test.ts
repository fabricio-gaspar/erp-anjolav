import assert from "node:assert/strict";
import test from "node:test";
import {
  agruparListaDia,
  calcularTotaisListaDia,
  correspondeSituacaoListaDia,
  criarLinhaListaDia,
  usaPeriodoDePrevisao,
  type ListaDiaRolOrigem,
} from "../src/lib/listaDiaRols.ts";

function criarRol(overrides: Partial<ListaDiaRolOrigem> = {}): ListaDiaRolOrigem {
  return {
    id: "rol-1",
    numero: "2026-000001",
    status: "lavagem",
    status_logistica: "nao_iniciada",
    status_pagamento: "pendente",
    data_retirada: "2026-11-18",
    data_previsao_entrega: "2026-11-20",
    valor_total: 100,
    valor_pago: 20,
    cliente: { id: "cliente-1", razao_social: "Cliente de teste", telefone: "11999999999" },
    itens: [
      { quantidade: 5, quantidade_entregue: 2 },
      { quantidade: 3, quantidade_entregue: 0 },
    ],
    ...overrides,
  };
}

test("deriva peças e valores em aberto a partir dos dados reais do ROL", () => {
  const rol = criarLinhaListaDia(criarRol());

  assert.equal(rol.totalPecas, 8);
  assert.equal(rol.pecasAbertas, 6);
  assert.equal(rol.valorTotal, 100);
  assert.equal(rol.valorAberto, 80);
  assert.equal(correspondeSituacaoListaDia(rol, "receber"), true);
  assert.equal(correspondeSituacaoListaDia(rol, "pecas_a_devolver"), true);
});

test("não reporta peça aberta quando o ROL foi entregue mesmo se o legado não atualizou o item", () => {
  const rol = criarLinhaListaDia(criarRol({ status: "entregue", status_logistica: "entregue", valor_pago: 100 }));

  assert.equal(rol.pecasAbertas, 0);
  assert.equal(rol.valorAberto, 0);
  assert.equal(correspondeSituacaoListaDia(rol, "receber_ou_devolver"), false);
});

test("agrupa por entrada nos relatórios operacionais e por cliente no extrato", () => {
  const primeiro = criarLinhaListaDia(criarRol());
  const segundo = criarLinhaListaDia(criarRol({
    id: "rol-2",
    numero: "2026-000002",
    data_retirada: "2026-11-19",
    cliente: { id: "cliente-1", razao_social: "Cliente de teste", telefone: null },
  }));

  assert.equal(agruparListaDia([primeiro, segundo], "entrada").length, 2);
  assert.equal(agruparListaDia([primeiro, segundo], "extrato").length, 1);
  assert.deepEqual(calcularTotaisListaDia([primeiro, segundo]), {
    rols: 2,
    pecas: 16,
    pecasAbertas: 12,
    valorTotal: 200,
    valorAberto: 160,
  });
});

test("usa a previsão apenas nos relatórios cujo fluxo depende da entrega", () => {
  assert.equal(usaPeriodoDePrevisao("entrada"), false);
  assert.equal(usaPeriodoDePrevisao("cliente"), false);
  assert.equal(usaPeriodoDePrevisao("previsao"), true);
  assert.equal(usaPeriodoDePrevisao("entrega"), true);
  assert.equal(usaPeriodoDePrevisao("passadoria"), true);
  assert.equal(usaPeriodoDePrevisao("coleta"), true);
});
