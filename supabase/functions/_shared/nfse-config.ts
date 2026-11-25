export type NfseEnvironment = "homologacao" | "producao";

export interface NfseBridgeConfig {
  enabled: boolean;
  ready: boolean;
  baseUrl: string | null;
  token: string | null;
  allowedHosts: Set<string>;
  productionEnabled: boolean;
  issues: string[];
}

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readHosts(value: string | undefined): Set<string> {
  return new Set((value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean));
}

export function readNfseBridgeConfig(
  readEnv: (name: string) => string | undefined,
): NfseBridgeConfig {
  const enabled = isTrue(readEnv("NFSE_ENABLED"));
  const baseUrl = readEnv("NFSE_BRIDGE_BASE_URL")?.trim() || null;
  const token = readEnv("NFSE_BRIDGE_TOKEN")?.trim() || null;
  const allowedHosts = readHosts(readEnv("NFSE_BRIDGE_ALLOWED_HOSTS"));
  const productionEnabled = isTrue(readEnv("NFSE_PRODUCTION_ENABLED"));
  const issues: string[] = [];

  if (!enabled) issues.push("Integração NFS-e está desativada no backend.");
  if (!baseUrl) issues.push("Bridge fiscal não configurado.");
  if (!token || token.length < 24) issues.push("Token do bridge fiscal ausente ou inválido.");
  if (allowedHosts.size === 0) issues.push("Lista de hosts fiscais permitidos não configurada.");

  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.protocol !== "https:") issues.push("Bridge fiscal deve usar HTTPS.");
      if (parsed.username || parsed.password) issues.push("Bridge fiscal não pode conter credenciais na URL.");
      if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
        issues.push("Host do bridge fiscal não está na lista permitida.");
      }
    } catch {
      issues.push("URL do bridge fiscal é inválida.");
    }
  }

  return {
    enabled,
    ready: issues.length === 0,
    baseUrl,
    token,
    allowedHosts,
    productionEnabled,
    issues,
  };
}

export function buildNfseBridgeUrl(config: NfseBridgeConfig, path: string): URL {
  if (!config.ready || !config.baseUrl) throw new Error("Bridge fiscal indisponível");
  const url = new URL(path.replace(/^\/+/, ""), config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`);
  if (url.protocol !== "https:" || !config.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("Destino fiscal não autorizado");
  }
  return url;
}
