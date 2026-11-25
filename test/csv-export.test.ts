import assert from "node:assert/strict";
import test from "node:test";
import { createCsv, escapeCsvCell } from "../src/lib/csvExport.ts";

test("escapeCsvCell quotes separators, quotes and line breaks", () => {
  assert.equal(escapeCsvCell('Produto; "especial"\nLavagem'), '"Produto; ""especial"" Lavagem"');
});

test("escapeCsvCell prevents spreadsheet formula injection", () => {
  assert.equal(escapeCsvCell("=HYPERLINK(\"https://example.com\")"), '"\'=HYPERLINK(""https://example.com"")"');
  assert.equal(escapeCsvCell("+5511999999999"), '"\'+5511999999999"');
});

test("createCsv exports typed rows with a stable header", () => {
  const csv = createCsv(
    [{ name: "Cliente", active: true, total: 10.5 }],
    [
      { header: "Nome", value: (row) => row.name },
      { header: "Ativo", value: (row) => row.active },
      { header: "Total", value: (row) => row.total },
    ],
  );
  assert.equal(csv, '"Nome";"Ativo";"Total"\n"Cliente";"Sim";"10.5"');
});
