// Orçamento aproximado do build local, medido em bytes gzip dos assets.
import { spawnSync } from "node:child_process";
import console from "node:console";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import process from "node:process";

import { assert, projectPath } from "./local-checks.mjs";

const build = spawnSync(process.execPath, [
  projectPath("node_modules", "vite", "bin", "vite.js"), "build", "--configLoader", "runner",
], { cwd: projectPath(), stdio: "inherit" });
if (build.error) throw build.error;
assert(build.status === 0, `Build local falhou (código ${build.status})`);

const manifestFile = projectPath("dist", ".vite", "manifest.json");
assert(existsSync(manifestFile), "Build local não produziu o manifesto do Vite");
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const entry = manifest["index.html"];
assert(entry?.isEntry && entry.file, "Manifesto do Vite sem entrada index.html");

const maxJsGzip = 320 * 1024;
const maxCssGzip = 100 * 1024;
const maxInitialGzip = 500 * 1024;
const sizes = new Map();
function assetBytes(file) {
  if (!sizes.has(file)) {
    assert(/^assets\/[\w.-]+\.(js|css)$/.test(file), `Asset inesperado: ${file}`);
    const path = projectPath("dist", file);
    assert(existsSync(path) && statSync(path).isFile(), `Asset ausente: ${file}`);
    sizes.set(file, gzipSync(readFileSync(path)).byteLength);
  }
  return sizes.get(file);
}

for (const item of Object.values(manifest)) {
  if (!item.file || !/\.(js|css)$/.test(item.file)) continue;
  const bytes = assetBytes(item.file);
  const limit = item.file.endsWith(".js") ? maxJsGzip : maxCssGzip;
  assert(bytes <= limit, `${item.file}: ${bytes} bytes gzip excedem ${limit}`);
  for (const css of item.css ?? []) assert(assetBytes(css) <= maxCssGzip, `${css} excede ${maxCssGzip} bytes gzip`);
}

const initialFiles = new Set();
const visited = new Set();
function visit(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const item = manifest[key];
  assert(item?.file, `Import estático ausente do manifesto: ${key}`);
  initialFiles.add(item.file);
  for (const css of item.css ?? []) initialFiles.add(css);
  for (const dependency of item.imports ?? []) visit(dependency);
}
visit("index.html");
const initialBytes = [...initialFiles].reduce((sum, file) => sum + assetBytes(file), 0);
assert(initialBytes <= maxInitialGzip, `Entrada inicial: ${initialBytes} bytes gzip excedem ${maxInitialGzip}`);
console.log(`Performance local: ${initialFiles.size} assets iniciais, ${(initialBytes / 1024).toFixed(1)} KiB gzip (limite ${maxInitialGzip / 1024} KiB).`);
