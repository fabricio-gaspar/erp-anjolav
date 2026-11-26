// Executa somente verificações locais. Não consulta serviços nem faz deploy.
import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";

import { projectPath } from "./local-checks.mjs";

const steps = [
  ["contrato de banco", [projectPath("scripts", "check-supabase-integration.mjs")]],
  ["fluxo MFA", [projectPath("scripts", "check-local-mfa.mjs")]],
  ["Edge local", [projectPath("scripts", "check-edge-functions.mjs")]],
  ["tipos do app", [projectPath("node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.app.json"]],
  ["tipos do build", [projectPath("node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.node.json"]],
  ["testes", ["--test"]],
  ["lint", [projectPath("node_modules", "eslint", "bin", "eslint.js"), ".", "--quiet"]],
  ["build e orçamento", [projectPath("scripts", "check-performance-budget.mjs")]],
];

for (const [label, args] of steps) {
  console.log(`\nPreflight local: ${label}`);
  const result = spawnSync(process.execPath, args, { cwd: projectPath(), stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} falhou (código ${result.status})`);
}

console.log("\nPreflight local concluído. Credenciais, banco e Edge remoto exigem validação separada.");
