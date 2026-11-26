// Checagem local de sintaxe e imports relativos. O typecheck remoto do Deno
// continua sendo uma etapa separada quando houver acesso ao registry.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import console from "node:console";
import ts from "typescript";

import { projectPath } from "./local-checks.mjs";

const functionsRoot = projectPath("supabase", "functions");
const entries = readdirSync(functionsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => resolve(functionsRoot, entry.name, "index.ts"));
if (entries.length === 0) throw new Error("Nenhuma Edge Function encontrada");

const checked = new Set();
function checkFile(file) {
  if (!existsSync(file)) throw new Error(`Arquivo da Edge Function ausente: ${relative(functionsRoot, file)}`);
  if (checked.has(file)) return;
  checked.add(file);

  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) {
    const details = source.parseDiagnostics.map((diagnostic) =>
      `${source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`
    ).join("; ");
    throw new Error(`${relative(functionsRoot, file)}: ${details}`);
  }

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith(".")) continue;
    const dependency = resolve(dirname(file), specifier.text);
    const pathFromRoot = relative(functionsRoot, dependency);
    if (pathFromRoot.startsWith("..") || isAbsolute(pathFromRoot)) {
      throw new Error(`Import relativo fora de supabase/functions: ${specifier.text}`);
    }
    checkFile(extname(dependency) ? dependency : `${dependency}.ts`);
  }
}

entries.forEach(checkFile);
console.log(`Edge local: ${entries.length} funções e ${checked.size} arquivos TS com sintaxe/imports válidos (sem rede).`);
