import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRolItemDetails } from "../src/lib/rolItemDetails.ts";
import { generateROLHTMLWithData, generateROLDisponibilidadeHTMLWithData } from "../src/lib/rolPrint.ts";

test("entry and availability receipts show all item details and ROL notes safely", () => {
  const details = formatRolItemDetails({ cor_item: "Azul", marca_item: "Marca", avarias: "Mancha <gola>", observacoes: "Lacre 123\nÚltima informação" });
  const data = {
    numero: "2026-000001", clienteNome: "Cliente teste", valorTotal: 100, dataEmissao: new Date("2026-11-26T12:00:00Z"),
    observacoes: "Embalar separado\nNão dobrar", itens: [{ nome: "Tapete", quantidade: 1, precoUnitario: 100, subtotal: 100, detalhes: details }],
  };
  for (const html of [generateROLHTMLWithData({}, data), generateROLDisponibilidadeHTMLWithData({}, data)]) {
    for (const expected of ["Cor: Azul", "Marca: Marca", "Mancha &lt;gola&gt;", "Lacre 123", "Última informação", "Embalar separado", "Não dobrar"]) {
      assert.ok(html.includes(expected), `missing ${expected}`);
    }
    assert.match(html, /white-space:\s*pre-wrap/);
  }
});
