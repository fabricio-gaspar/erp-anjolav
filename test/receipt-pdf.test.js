import test from "node:test";
import assert from "node:assert/strict";
import { TextDecoder } from "node:util";
import { buildReceiptPdf } from "../supabase/functions/_shared/receipt-pdf.ts";

const item = { description: "COBERTOR", details: "MARCA AZUL ".repeat(20), operation: "LAVAGEM", quantity: "1", unitPrice: "50,00", total: "50,00" };
const receipt = { kind: "entrada", companyName: "LAVANDERIA EXEMPLO", number: "2026-000001", entryDate: "24/11/2026", clientName: "CLIENTE EXEMPLO", items: [item], totalPieces: "1", grossValue: "R$ 50,00", totalValue: "R$ 50,00", receivedValue: "R$ 30,00", amountDue: "R$ 20,00", payments: [{ method: "DINHEIRO", value: "R$ 30,00" }] };
test("gera PDF com detalhes completos e pagamentos registrados", () => {
  const text = new TextDecoder().decode(buildReceiptPdf(receipt));
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /PAGAMENTOS REGISTRADOS/);
  assert.match(text, /DINHEIRO: R\$ 30,00/);
  assert.equal((text.match(/MARCA AZUL/g) || []).length, 20);
  assert.match(text, /%%EOF/);
});
test("pedidos longos produzem várias páginas com todos os itens", () => {
  const text = new TextDecoder().decode(buildReceiptPdf({ ...receipt, items: Array.from({ length: 30 }, (_, i) => ({ ...item, description: `PECA ${i + 1}` })) }));
  assert.match(text, /PECA 30/);
  assert.ok(Number(text.match(/\/Count (\d+)/)?.[1]) > 1);
});
