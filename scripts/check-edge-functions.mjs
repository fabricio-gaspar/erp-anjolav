import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve("supabase/functions");
const entries = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => resolve(root, entry.name, "index.ts"));

if (entries.length === 0) {
  throw new Error("Nenhuma Edge Function encontrada para checagem");
}

const deno = process.platform === "win32"
  ? resolve("node_modules/deno/deno.exe")
  : resolve("node_modules/.bin/deno");
execFileSync(deno, ["check", ...entries], { stdio: "inherit", env: process.env });
