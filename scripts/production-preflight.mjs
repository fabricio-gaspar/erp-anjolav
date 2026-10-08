import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_RELEASE_GATES = [
  "tenantRls",
  "databaseRecovery",
  "criticalFlows",
  "asaasWebhookQueue",
  "fiscalProvider",
  "whatsappAndN8n",
  "transactionalEmail",
  "observability",
  "securityReview",
  "legalCommercial",
];

const PLACEHOLDER_PATTERN = /(^|[-_\s])(?:seu|sua|substitua|preencha|placeholder|change[-_ ]?me|example|exemplo|seudominio|yourdomain|todo|tbd)(?:$|[-_\s])|^<.+>$|^__.+__$/i;
const PROJECT_ID_PATTERN = /^[a-z0-9]{20}$/;
const HOST_PATTERN = /^(?!-)[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i;

export function parseDotEnv(source) {
  const values = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalized = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const separator = normalized.indexOf("=");
    if (separator < 1) continue;

    const key = normalized.slice(0, separator).trim();
    let value = normalized.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) continue;

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function isConfigured(value) {
  return typeof value === "string" && value.trim().length > 0 && !PLACEHOLDER_PATTERN.test(value.trim());
}

function validHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

function addRequiredConfigured(errors, values, key, label = key) {
  if (!isConfigured(values[key])) {
    errors.push(`${label} não foi configurado ou ainda contém um placeholder.`);
  }
}

function validateOrigins(errors, value) {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    errors.push("ALLOWED_ORIGINS deve conter ao menos um domínio HTTPS de produção.");
    return;
  }

  for (const origin of origins) {
    const url = validHttpsUrl(origin);
    if (!url || url.origin !== origin) {
      errors.push(`ALLOWED_ORIGINS contém uma origem inválida: ${origin}. Use somente origem HTTPS, sem caminho, query ou barra final.`);
      continue;
    }
    if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) {
      errors.push("ALLOWED_ORIGINS não pode usar localhost em produção.");
    }
  }
}

function validateHostAllowlist(errors, values, key) {
  const rawValue = values[key] ?? "";
  const hosts = rawValue.split(",").map((host) => host.trim()).filter(Boolean);
  if (hosts.length === 0) {
    errors.push(`${key} deve conter ao menos um hostname HTTPS autorizado.`);
    return;
  }

  for (const host of hosts) {
    if (!HOST_PATTERN.test(host) || host.includes("/") || host.includes(":")) {
      errors.push(`${key} contém hostname inválido: ${host}. Use apenas host, sem protocolo, porta ou caminho.`);
      continue;
    }
    if (host === "localhost" || host.endsWith(".localhost")) {
      errors.push(`${key} não pode usar localhost em produção.`);
    }
  }
}

function validateEvidence(errors, evidence, projectId) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    errors.push("O arquivo de evidências de release está ausente ou é inválido.");
    return;
  }

  if (evidence.environment !== "production") {
    errors.push("O arquivo de evidências deve declarar environment como production.");
  }
  if (evidence.projectRef !== projectId) {
    errors.push("O projectRef das evidências não corresponde ao project_id de supabase/config.toml.");
  }
  if (typeof evidence.releaseCommit !== "string" || !/^[0-9a-f]{40}$/i.test(evidence.releaseCommit)) {
    errors.push("releaseCommit deve ser o SHA completo de 40 caracteres do commit que será liberado.");
  }
  if (!isConfigured(evidence.approvedBy)) {
    errors.push("approvedBy deve identificar quem aprovou a liberação.");
  }
  if (!isConfigured(evidence.approvedAt)) {
    errors.push("approvedAt deve registrar a data/hora da aprovação em ISO 8601.");
  }

  const gates = evidence.gates;
  if (!gates || typeof gates !== "object" || Array.isArray(gates)) {
    errors.push("O arquivo de evidências não contém a seção gates.");
    return;
  }

  for (const gate of REQUIRED_RELEASE_GATES) {
    const result = gates[gate];
    if (!result || result.passed !== true || !isConfigured(result.evidence)) {
      errors.push(`Gate de release pendente: ${gate}.`);
    }
  }
}

export function validateProductionConfig({ frontend, functions, evidence, projectId }) {
  const errors = [];
  const warnings = [];

  if (!PROJECT_ID_PATTERN.test(projectId)) {
    errors.push("project_id de supabase/config.toml é inválido.");
  }

  for (const key of [
    "VITE_SUPABASE_PROJECT_ID",
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]) {
    addRequiredConfigured(errors, frontend, key);
  }

  if (isConfigured(frontend.VITE_SUPABASE_PROJECT_ID) && frontend.VITE_SUPABASE_PROJECT_ID !== projectId) {
    errors.push("VITE_SUPABASE_PROJECT_ID não corresponde ao project_id de supabase/config.toml.");
  }

  if (isConfigured(frontend.VITE_SUPABASE_URL)) {
    const url = validHttpsUrl(frontend.VITE_SUPABASE_URL);
    if (!url || url.pathname !== "/" || url.search || url.hash) {
      errors.push("VITE_SUPABASE_URL deve ser a URL HTTPS base do projeto Supabase, sem caminho, query ou fragmento.");
    } else if (projectId && !url.hostname.startsWith(`${projectId}.`)) {
      warnings.push("VITE_SUPABASE_URL não usa o hostname padrão do project_id. Confirme se há domínio customizado configurado no Supabase.");
    }
  }

  for (const key of Object.keys(frontend)) {
    if (
      /^VITE_.*(?:SERVICE_ROLE|SECRET|ASAAS|EVOLUTION|N8N|WEBHOOK_TOKEN|PRIVATE)/i.test(key) ||
      key === "VITE_SUPABASE_DB_URL"
    ) {
      errors.push(`${key} não pode ser exposto ao frontend.`);
    }
  }

  for (const key of [
    "ALLOWED_ORIGINS",
    "ASAAS_ENVIRONMENT",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
    "ASAAS_WEBHOOK_PUBLIC_URL",
    "EVOLUTION_API_KEY",
    "EVOLUTION_ALLOWED_HOSTS",
    "N8N_ALLOWED_HOSTS",
    "N8N_WEBHOOK_TOKEN",
    "NFSE_ENABLED",
    "ENABLE_DESTRUCTIVE_DATA_ADMIN",
  ]) {
    addRequiredConfigured(errors, functions, key);
  }

  if (isConfigured(functions.ALLOWED_ORIGINS)) validateOrigins(errors, functions.ALLOWED_ORIGINS);
  if (functions.ASAAS_ENVIRONMENT !== "production") {
    errors.push("ASAAS_ENVIRONMENT deve ser production no arquivo de produção.");
  }
  if (isConfigured(functions.ASAAS_API_KEY) && functions.ASAAS_API_KEY.length < 20) {
    errors.push("ASAAS_API_KEY parece curto demais.");
  }
  if (isConfigured(functions.ASAAS_WEBHOOK_TOKEN) && functions.ASAAS_WEBHOOK_TOKEN.length < 32) {
    errors.push("ASAAS_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres aleatórios.");
  }
  if (isConfigured(functions.N8N_WEBHOOK_TOKEN) && functions.N8N_WEBHOOK_TOKEN.length < 32) {
    errors.push("N8N_WEBHOOK_TOKEN deve ter pelo menos 32 caracteres aleatórios.");
  }
  if (isConfigured(functions.ASAAS_WEBHOOK_PUBLIC_URL)) {
    const webhookUrl = validHttpsUrl(functions.ASAAS_WEBHOOK_PUBLIC_URL);
    if (!webhookUrl || webhookUrl.pathname !== "/functions/v1/asaas-webhook" || webhookUrl.search || webhookUrl.hash) {
      errors.push("ASAAS_WEBHOOK_PUBLIC_URL deve ser a URL HTTPS exata de /functions/v1/asaas-webhook, sem query ou fragmento.");
    }
  }
  if (isConfigured(functions.EVOLUTION_ALLOWED_HOSTS)) {
    validateHostAllowlist(errors, functions, "EVOLUTION_ALLOWED_HOSTS");
  }
  if (isConfigured(functions.N8N_ALLOWED_HOSTS)) {
    validateHostAllowlist(errors, functions, "N8N_ALLOWED_HOSTS");
  }
  if (!['true', 'false'].includes(functions.NFSE_ENABLED)) {
    errors.push("NFSE_ENABLED deve ser true ou false.");
  } else if (functions.NFSE_ENABLED === "false") {
    warnings.push("NFS-e está desativada por segurança. Não anuncie emissão fiscal até instalar e homologar um adaptador específico.");
  } else {
    for (const key of [
      "NFSE_PROVIDER",
      "NFSE_MUNICIPALITY_IBGE",
      "NFSE_ENVIRONMENT",
      "NFSE_API_BASE_URL",
      "NFSE_ALLOWED_HOSTS",
      "NFSE_API_TOKEN",
      "NFSE_CERTIFICATE_SECRET",
    ]) {
      addRequiredConfigured(errors, functions, key);
    }
    if (functions.NFSE_ENVIRONMENT !== "production") {
      errors.push("NFSE_ENVIRONMENT deve ser production quando NFSE_ENABLED=true no arquivo de produção.");
    }
    if (isConfigured(functions.NFSE_MUNICIPALITY_IBGE) && !/^\d{7}$/.test(functions.NFSE_MUNICIPALITY_IBGE)) {
      errors.push("NFSE_MUNICIPALITY_IBGE deve conter os 7 dígitos do código IBGE.");
    }
    if (isConfigured(functions.NFSE_ALLOWED_HOSTS)) {
      validateHostAllowlist(errors, functions, "NFSE_ALLOWED_HOSTS");
    }
    if (isConfigured(functions.NFSE_API_BASE_URL)) {
      const nfseUrl = validHttpsUrl(functions.NFSE_API_BASE_URL);
      const allowedHosts = new Set((functions.NFSE_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean));
      if (!nfseUrl || !allowedHosts.has(nfseUrl.hostname)) {
        errors.push("NFSE_API_BASE_URL deve usar HTTPS e um hostname presente em NFSE_ALLOWED_HOSTS.");
      }
    }
    if (isConfigured(functions.NFSE_API_TOKEN) && functions.NFSE_API_TOKEN.length < 20) {
      errors.push("NFSE_API_TOKEN parece curto demais.");
    }
    if (isConfigured(functions.NFSE_CERTIFICATE_SECRET) && functions.NFSE_CERTIFICATE_SECRET.length < 16) {
      errors.push("NFSE_CERTIFICATE_SECRET parece curto demais.");
    }
  }
  if (functions.ENABLE_DESTRUCTIVE_DATA_ADMIN !== "false") {
    errors.push("ENABLE_DESTRUCTIVE_DATA_ADMIN deve permanecer false em produção.");
  }

  for (const key of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (isConfigured(functions[key])) {
      warnings.push(`${key} não precisa constar no arquivo de secrets: a plataforma Supabase o injeta nas Edge Functions hospedadas.`);
    }
  }

  validateEvidence(errors, evidence, projectId);
  return { errors, warnings, ready: errors.length === 0 };
}

function readEnvFile(filePath, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} não encontrado: ${filePath}`);
    return {};
  }
  return parseDotEnv(fs.readFileSync(filePath, "utf8"));
}

function readJsonFile(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`Arquivo de evidências não encontrado: ${filePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    errors.push(`Arquivo de evidências não contém JSON válido: ${filePath}`);
    return null;
  }
}

function getProjectId(configPath, errors) {
  if (!fs.existsSync(configPath)) {
    errors.push(`Configuração Supabase não encontrada: ${configPath}`);
    return "";
  }
  const match = /^project_id\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(configPath, "utf8"));
  if (!match) {
    errors.push("project_id não encontrado em supabase/config.toml.");
    return "";
  }
  return match[1];
}

function checkGitReleaseState(evidence, errors) {
  try {
    const dirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
    if (dirty) errors.push("O repositório tem alterações não commitadas; faça um commit de release antes da implantação.");

    const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    if (evidence?.releaseCommit && evidence.releaseCommit !== currentCommit) {
      errors.push("releaseCommit não corresponde ao HEAD atual.");
    }
  } catch {
    errors.push("Não foi possível verificar o estado Git para a liberação.");
  }
}

function parseArgs(argv) {
  const args = {
    frontendEnv: ".env.production",
    functionsEnv: "supabase/.env.production",
    evidence: "ops/release-evidence.json",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new Error(`Valor ausente para ${value}.`);
    if (value === "--frontend-env") args.frontendEnv = next;
    else if (value === "--functions-env") args.functionsEnv = next;
    else if (value === "--release-evidence") args.evidence = next;
    else throw new Error(`Argumento desconhecido: ${value}.`);
    index += 1;
  }

  return args;
}

function printUsage() {
  console.log("Uso: node scripts/production-preflight.mjs [--frontend-env .env.production] [--functions-env supabase/.env.production] [--release-evidence ops/release-evidence.json]");
  console.log("A checagem não chama Supabase, Asaas, Evolution, n8n ou qualquer provedor externo e nunca exibe valores de secrets.");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Argumentos inválidos.");
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (args.help) {
    printUsage();
    return;
  }

  const inputErrors = [];
  const frontend = readEnvFile(args.frontendEnv, "Arquivo de ambiente do frontend", inputErrors);
  const functions = readEnvFile(args.functionsEnv, "Arquivo de secrets das Edge Functions", inputErrors);
  const evidence = readJsonFile(args.evidence, inputErrors);
  const projectId = getProjectId("supabase/config.toml", inputErrors);
  const result = validateProductionConfig({ frontend, functions, evidence, projectId });
  const errors = [...inputErrors, ...result.errors];
  checkGitReleaseState(evidence, errors);

  console.log("Preflight de produção do AnjoLav ERP");
  console.log(`Project ref esperado: ${projectId || "indisponível"}`);
  for (const warning of result.warnings) console.warn(`AVISO: ${warning}`);
  for (const error of errors) console.error(`BLOQUEIO: ${error}`);

  if (errors.length > 0) {
    console.error(`Resultado: BLOQUEADO (${errors.length} item(ns) pendente(s)).`);
    process.exitCode = 1;
  } else {
    console.log("Resultado: CONFIGURAÇÃO E EVIDÊNCIAS APROVADAS. Execute os smoke tests pós-deploy antes de abrir o sistema ao público.");
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) main();
