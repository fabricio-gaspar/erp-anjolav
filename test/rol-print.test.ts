import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRolOrderDetails, generateROLHTMLWithData, generateROLCommercialHTML,
  getRolCommercialSummary, type PrintOSData,
} from "../src/lib/rolPrint.ts";
import type { ROLPreviewConfig } from "../src/components/configuracoes/ROLPreview.tsx";

const config: ROLPreviewConfig = {
  nomeCurto: "Lavanderia", slogan: "", nomeCompleto: "Lavanderia Teste",
  corPrimaria: "#000000", corSecundaria: "#000000", telefone: "", email: "",
  cnpj: "", endereco: "", exibirLogo: false, logoUrl: "", larguraPapel: "80mm",
  fontePrincipal: "courier", tamanhoNome: 14, tamanhoItem: 11, tamanhoTotal: 14,
  previsaoEntrega: true, bloco: false, observacoes: true, assinaturaCliente: false,
  tipoPreco: true, linhaDesconto: true, exibirFidelidade: false,
  textoRodape: "Obrigado", margemSuperior: 10, margemLateral: 8,
};

function order(overrides: Partial<PrintOSData> = {}): PrintOSData {
  return {
    numero: "OS-123", clienteNome: "Indústria Exemplo", dataEmissao: new Date("2026-10-26T12:00:00Z"),
    itens: [{ nome: "Roupa industrial", unidade: "kg", quantidade: 12.5, precoUnitario: 8, subtotal: 100 }],
    valorTotal: 100, valorPago: 0, statusPagamento: "pendente", origem: "industrial",
    condicaoPagamento: "faturado",
    condicoesComerciais: { tipo_faturamento: "mensal", forma_pagamento: "boleto", dia_fechamento: 16, dia_vencimento: 20, tabela_preco_tipo: "personalizada" },
    ...overrides,
  };
}

test("ROL industrial usa condição e tabela do snapshot, com preços persistidos e unidades", () => {
  const data = order({ tabelaPrecoAtual: "padrao" });
  const details = buildRolOrderDetails({
    valor_total: 100, condicao_pagamento: data.condicaoPagamento,
    condicoes_comerciais: data.condicoesComerciais, origem: "industrial",
    valor_pago: 0, status_pagamento: "pendente",
  }, data.itens, "padrao");
  const html = generateROLHTMLWithData(config, { ...data, ...details });
  assert.match(html, /Atendimento:<\/strong> Industrial/);
  assert.match(html, /Condição da OS:<\/strong> Faturado/);
  assert.match(html, /Personalizada \(registrada na OS\)/);
  assert.doesNotMatch(html, /Padrão/);
  assert.match(html, /12,5 kg/);
  assert.match(html, /class="item-unit">8\.00/);
  assert.match(html, /R\$ 100\.00/);
  assert.match(html, /Mensal · Fechamento: dia 16 · Vencimento: dia 20/);
});

test("faturado pendente não sugere recebimento individual nem representa quitação", () => {
  const html = generateROLHTMLWithData(config, order());
  assert.match(html, /Faturado — não pago/);
  assert.match(html, /Pagamento pelo fechamento da fatura/);
  assert.match(html, /Saldo vinculado ao faturamento: R\$ 100\.00/);
  assert.match(html, /não é cobrança individual da OS/);
  assert.doesNotMatch(html, /Receber OS|Pagar agora|Pagamento registrado|RECIBO DE LAVANDERIA/i);
});

test("condição nula antiga é retirada mesmo com mensal ou faturado no JSON", () => {
  for (const condition of [undefined, null, "legado"]) {
    const data = order({ condicaoPagamento: condition, condicoesComerciais: { condicao_pagamento: "faturado", tipo_faturamento: "mensal" } });
    const info = getRolCommercialSummary(data);
    assert.equal(info.condition, "Pagamento na retirada");
    assert.equal(info.billed, false);
    const html = generateROLCommercialHTML(data);
    assert.doesNotMatch(html, /Periodicidade|fechamento da fatura|Faturado/);
    assert.match(html, /Pagamento pendente/);
  }
});

test("snapshot de pagamento prevalece sobre outro valor de condição no próprio JSON", () => {
  const data = order({ condicaoPagamento: "entrada", condicoesComerciais: { condicao_pagamento: "faturado", tipo_faturamento: "mensal", forma_pagamento: "pix" } });
  const html = generateROLCommercialHTML(data);
  assert.match(html, /Pagamento na entrada/);
  assert.match(html, /PIX \(não comprova pagamento\)/);
  assert.match(html, /Pagamento pendente/);
  assert.doesNotMatch(html, /Periodicidade|Pagamento registrado/);
});

test("JSON ausente ou inválido é seguro e não inventa tabela histórica", () => {
  for (const snapshot of [undefined, null, "mensal", [], 1, { tabela_preco_tipo: "especial", forma_pagamento: "constructor" }, { tipo_faturamento: { toString: null }, dia_fechamento: "16" }]) {
    const data = order({ condicoesComerciais: snapshot, tabelaPrecoAtual: "personalizada" });
    const info = getRolCommercialSummary(data);
    assert.equal(info.table, "Personalizada (cadastro atual; tabela da OS não registrada)");
    assert.equal(info.preferredMethod, null);
    assert.equal(info.frequency, null);
  }
  assert.equal(getRolCommercialSummary(order({ condicoesComerciais: null })).table, "Não registrada na OS");
});

test("tabela padrão do snapshot não muda quando cadastro atual passa a personalizada", () => {
  const snapshot = Object.freeze({ tabela_preco_tipo: "padrao", tipo_faturamento: "quinzenal", dia_fechamento: 7 });
  const data = order({ condicoesComerciais: snapshot, tabelaPrecoAtual: "personalizada" });
  assert.equal(getRolCommercialSummary(data).table, "Padrão (registrada na OS)");
  assert.equal(getRolCommercialSummary(data).frequency, "Quinzenal");
  assert.equal(getRolCommercialSummary(data).closingDay, 7);
  assert.deepEqual(snapshot, { tabela_preco_tipo: "padrao", tipo_faturamento: "quinzenal", dia_fechamento: 7 });
});

test("total persistido da OS preserva desconto e urgência em vez de imprimir a soma bruta", () => {
  const items = order().itens;
  const details = buildRolOrderDetails({ valor_total: 117, valor_desconto: 10, urgente: true, percentual_urgencia: 30, origem: "residencial" }, items);
  assert.equal(details.valorTotal, 117);
  assert.equal(details.valorDesconto, 10);
  assert.equal(details.valorUrgencia, 27);
  const html = generateROLHTMLWithData(config, order({ ...details }));
  assert.match(html, /Atendimento:<\/strong> Residencial/);
  assert.match(html, /Subtotal:<\/span><span>R\$ 100\.00/);
  assert.match(html, /Desconto:<\/span><span>- R\$ 10\.00/);
  assert.match(html, /Urgência:<\/span><span>\+ R\$ 27\.00/);
  assert.match(html, /<span>TOTAL:<\/span>\s*<span>R\$ 117\.00/);
  assert.equal(buildRolOrderDetails({ valor_total: 0 }, items).valorTotal, 0);
  assert.equal(buildRolOrderDetails({ valor_total: null }, items).valorTotal, 100);
});

test("faturado pago ou parcialmente pago continua direcionado à fatura", () => {
  const paid = generateROLCommercialHTML(order({ valorPago: 100, statusPagamento: "pago" }));
  assert.match(paid, /Situação:<\/strong> Pagamento registrado/);
  assert.match(paid, /fechamento da fatura/);
  assert.doesNotMatch(paid, /Saldo vinculado|não pago/);
  const partial = generateROLCommercialHTML(order({ valorPago: 30 }));
  assert.match(partial, /Pagamento parcial registrado/);
  assert.match(partial, /Saldo vinculado ao faturamento: R\$ 70\.00/);
  assert.doesNotMatch(partial, /Receber OS|Pagar agora/i);
});

test("cancelamento não apresenta saldo como cobrança", () => {
  const html = generateROLCommercialHTML(order({ statusOS: "cancelada" }));
  assert.match(html, /OS cancelada/);
  assert.doesNotMatch(html, /Saldo vinculado|Saldo pendente|Faturado — não pago/);
});

test("ocultar preços conserva condição e situação sem vazar valores financeiros", () => {
  const html = generateROLHTMLWithData({ ...config, tipoPreco: false }, order());
  assert.match(html, /Faturado — não pago/);
  assert.match(html, /Personalizada/);
  assert.doesNotMatch(html, /R\$|100\.00|8\.00/);
});

test("conteúdo dinâmico do ROL é escapado, inclusive unidade industrial", () => {
  const html = generateROLHTMLWithData(config, order({
    clienteNome: '<img src=x onerror="alert(1)">',
    itens: [{ nome: "<script>produto</script>", quantidade: 1.25, unidade: '<img src=x>', precoUnitario: 80, subtotal: 100 }],
    condicoesComerciais: { forma_pagamento: "<script>pix</script>", tabela_preco_tipo: "<img src=x>" },
  }));
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;produto/);
  assert.match(html, /1,25 &lt;img src=x&gt;/);
});

test("origem loja histórica continua residencial sem inferir crédito pela área", () => {
  const info = getRolCommercialSummary(order({ origem: "loja", condicaoPagamento: null }));
  assert.equal(info.area, "Residencial");
  assert.equal(info.condition, "Pagamento na retirada");
});

test("quantidade industrial não perde casas decimais ao formatar a unidade", () => {
  const data = order({ itens: [{ nome: "Tecido", unidade: "kg", quantidade: 1.2345, precoUnitario: 8, subtotal: 9.88 }], valorTotal: 9.88 });
  assert.match(generateROLHTMLWithData(config, data), /1,2345 kg/);
});
