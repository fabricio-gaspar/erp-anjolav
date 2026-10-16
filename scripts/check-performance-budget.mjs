import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const DEFAULT_MAIN_BUDGET_KB = 100;
const DEFAULT_CHUNK_BUDGET_KB = 96;

// These async chunks are intentionally split by Vite. Their larger budget has
// a named purpose; every unlisted chunk must remain below the default limit.
const CHUNK_ALLOWLIST = new Map([
  ["charts", { budgetKb: 140, reason: "biblioteca de gráficos carregada sob demanda" }],
  ["maps", { budgetKb: 120, reason: "biblioteca de mapas carregada sob demanda" }],
]);

function usage() {
  console.log(`Uso: node scripts/check-performance-budget.mjs [opções]

Opções:
  --manifest <arquivo>       Manifesto Vite (padrão: dist/.vite/manifest.json)
  --assets-dir <diretório>  Diretório raiz do build (padrão: dist)
  --main-budget-kb <n>      Orçamento gzip do entrypoint (padrão: ${DEFAULT_MAIN_BUDGET_KB})
  --chunk-budget-kb <n>     Orçamento gzip para chunks não permitidos (padrão: ${DEFAULT_CHUNK_BUDGET_KB})
  --help                    Exibe esta ajuda`);
}

function readArguments(argv) {
  const options = {
    manifest: "dist/.vite/manifest.json",
    assetsDir: "dist",
    mainBudgetKb: DEFAULT_MAIN_BUDGET_KB,
    chunkBudgetKb: DEFAULT_CHUNK_BUDGET_KB,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help") {
      options.help = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Valor ausente para ${argument}`);
    if (argument === "--manifest") options.manifest = value;
    else if (argument === "--assets-dir") options.assetsDir = value;
    else if (argument === "--main-budget-kb") options.mainBudgetKb = Number(value);
    else if (argument === "--chunk-budget-kb") options.chunkBudgetKb = Number(value);
    else throw new Error(`Opção desconhecida: ${argument}`);
    index += 1;
  }

  for (const [name, value] of Object.entries({
    "--main-budget-kb": options.mainBudgetKb,
    "--chunk-budget-kb": options.chunkBudgetKb,
  })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} deve ser um número positivo`);
  }

  return options;
}

function formatKilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function logicalChunkName(file) {
  const name = basename(file, ".js");
  return name.match(/^(.*)-[A-Za-z0-9_-]{8}$/)?.[1] ?? name;
}

function isJavaScriptAsset(file) {
  return typeof file === "string" && file.endsWith(".js");
}

function resolveAssetPath(rootDirectory, assetFile) {
  const root = resolve(rootDirectory);
  const assetPath = resolve(root, assetFile);
  const assetRelativePath = relative(root, assetPath);
  if (assetRelativePath.startsWith("..") || isAbsolute(assetRelativePath)) {
    throw new Error(`Asset fora do diretório de build: ${assetFile}`);
  }
  return assetPath;
}

async function checkBudget(options) {
  const manifest = JSON.parse(await readFile(options.manifest, "utf8"));
  const entries = Object.entries(manifest).filter(([, value]) => (
    value && typeof value === "object" && isJavaScriptAsset(value.file)
  ));
  const entry = entries.find(([key, value]) => key === "index.html" || value.isEntry);
  if (!entry) throw new Error("Manifesto Vite não contém um entrypoint JavaScript");

  const mainFile = entry[1].file;
  const assetFiles = [...new Set(entries.map(([, value]) => value.file))];
  const failures = [];

  for (const assetFile of assetFiles) {
    const compressed = gzipSync(await readFile(resolveAssetPath(options.assetsDir, assetFile))).byteLength;
    const isMain = assetFile === mainFile;
    const chunkName = logicalChunkName(assetFile);
    const allowance = isMain
      ? { budgetKb: options.mainBudgetKb, reason: "entrypoint principal" }
      : CHUNK_ALLOWLIST.get(chunkName) ?? { budgetKb: options.chunkBudgetKb, reason: "limite padrão" };
    const budgetBytes = allowance.budgetKb * 1024;
    const label = isMain ? "entrypoint" : `chunk ${chunkName}`;

    if (isMain || CHUNK_ALLOWLIST.has(chunkName)) {
      console.log(`${label}: ${formatKilobytes(compressed)} gzip / ${allowance.budgetKb} KiB (${allowance.reason})`);
    }
    if (compressed > budgetBytes) {
      failures.push(`${assetFile} excede o orçamento gzip de ${allowance.budgetKb} KiB (${formatKilobytes(compressed)})`);
    }
  }

  if (failures.length > 0) throw new Error(failures.join("\n"));
  console.log(`Orçamento aprovado para ${assetFiles.length} assets JavaScript.`);
}

try {
  const options = readArguments(process.argv.slice(2));
  if (options.help) usage();
  else await checkBudget(options);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha ao verificar o orçamento de desempenho");
  process.exitCode = 1;
}
