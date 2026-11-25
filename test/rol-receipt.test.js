import assert from "node:assert/strict";
import test from "node:test";
import { buildRolReceiptPng } from "../supabase/functions/_shared/rol-receipt.ts";

function uint32(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0)
    + (bytes[offset + 1] << 16)
    + (bytes[offset + 2] << 8)
    + bytes[offset + 3];
}

const fixture = {
  kind: "entrada",
  companyName: "ANJOLAV",
  companyAddress: "AVENIDA BRASIL, 615 · LOJAO · JARDIM CARAMBE",
  companyPhone: "(11) 99930-2386",
  companyEmail: "comercial@anjolav.com.br",
  companyCnpj: "23.727.028/0001-06",
  number: "26357",
  entryDate: "13/10/2026",
  entryTime: "12:30",
  forecastDate: "15/10/2026",
  forecastTime: "15:00",
  attendant: "DANIELA",
  block: "C",
  clientName: "FABRICIO GASPAR",
  clientCode: "1551",
  clientStreet: "AVENIDA BRASIL",
  clientNumber: "615",
  clientComplement: "LOJAO",
  clientDistrict: "JARDIM CARAMBE",
  clientCity: "SAO ROQUE - SP",
  clientPhone: "(11) 99974-1875",
  productionNotes: "COBERTOR ALTERNBURG CINZA COM PONTOS ESCUROS E AMARELADOS",
  items: [{
    description: "COBERTOR CASAL",
    details: "ALTERNBURG, CINZA",
    operation: "L/P",
    quantity: "1",
    unitPrice: "43,00",
    total: "43,00",
  }],
  totalPieces: "1",
  grossValue: "R$ 43,00",
  discountValue: "R$ 0,00",
  totalValue: "R$ 43,00",
  receivedValue: "R$ 0,00",
  amountDue: "R$ 43,00",
  dueDate: "13/10/2026",
  footer: "ANJOLAV ERP · COMPROVANTE DO ROL",
};

test("gera PNG térmico determinístico em 604 × 1398", async () => {
  const first = await buildRolReceiptPng(fixture);
  const second = await buildRolReceiptPng(fixture);

  assert.deepEqual(Array.from(first.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(uint32(first, 16), 604);
  assert.equal(uint32(first, 20), 1398);
  assert.ok(first.length > 8_000);
  assert.deepEqual(first, second);
});

test("aumenta a altura sem cortar ROLs com vários itens", async () => {
  const png = await buildRolReceiptPng({
    ...fixture,
    items: [...fixture.items, { ...fixture.items[0], description: "EDREDOM CASAL" }],
  });
  assert.equal(uint32(png, 20), 1442);
});

test("normaliza espaços monetários do Intl sem desenhar caractere extra", async () => {
  const regular = await buildRolReceiptPng(fixture);
  const localized = await buildRolReceiptPng({
    ...fixture,
    grossValue: "R$\u00a043,00",
    discountValue: "R$\u202f0,00",
    totalValue: "R$\u00a043,00",
    receivedValue: "R$\u202f0,00",
    amountDue: "R$\u00a043,00",
  });

  assert.deepEqual(localized, regular);
});

