import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { projectPath, readProjectFile, stringArrayConstant } from "./local-checks.mjs";

const tables = stringArrayConstant(readProjectFile("supabase", "functions", "data-administration", "index.ts"), "TABLES");
const contract = {
  formatVersion: 1,
  scope: "tenant-operational-partial",
  tables,
  pageSize: 500,
  maxRowsPerTable: 100_000,
  exclusions: ["outras tabelas", "auth e Storage"],
  consistency: "leituras sequenciais",
};

function loadExports(respond) {
  const file = projectPath("src", "hooks", "useDataManagement.ts");
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exported = {};
  runInNewContext(code, {
    exports: exported,
    require(specifier) {
      if (specifier === "@tanstack/react-query") return { useQuery() { throw new Error("useQuery não deve rodar neste teste"); } };
      if (specifier === "@/integrations/supabase/client") {
        return { supabase: { functions: { invoke: async (_name, { body }) => ({ data: { data: await respond(body) }, error: null }) } } };
      }
      throw new Error(`Import inesperado: ${specifier}`);
    },
  }, { filename: file });
  return exported;
}

test("exportação parcial inclui manifesto e todas as tabelas permitidas", async () => {
  const calls = [];
  const { exportAllData } = loadExports((body) => {
    calls.push(body);
    return body.operation === "export-manifest" ? contract : { rows: [], count: 0 };
  });
  const result = await exportAllData();
  assert.equal(result.__manifest.scope, "tenant-operational-partial");
  assert.equal(result.__manifest.tables.length, tables.length);
  assert.equal(result.__manifest.recordCounts[tables[0]], 0);
  assert.equal(calls.filter((call) => call.operation === "export-page").length, tables.length);
  assert.equal(Object.keys(result).length, tables.length + 1);
});

test("exportação aceita exatamente 100.000 registros", async () => {
  const rows = Array.from({ length: 500 }, (_, id) => ({ id }));
  const { exportEntityData } = loadExports(() => ({ rows, count: 100_000 }));
  assert.equal((await exportEntityData(tables[0])).length, 100_000);
});

test("exportação falha se a página for truncada ou ultrapassar o limite", async () => {
  const truncated = loadExports(() => ({ rows: Array.from({ length: 499 }, (_, id) => ({ id })), count: 501 }));
  await assert.rejects(truncated.exportEntityData(tables[0]), /Página incompleta/);
  const oversized = loadExports(() => ({ rows: [], count: 100_001 }));
  await assert.rejects(oversized.exportEntityData(tables[0]), /excede 100000 registros/);
});
