export interface NfseRuntimeConfig {
  enabled: boolean;
  ready: boolean;
  provider: string | null;
  municipalityIbge: string | null;
  environment: "homologation" | "production" | null;
  issues: string[];
}

type EnvReader = (name: string) => string | undefined;

const SUPPORTED_PROVIDERS = new Set<string>();

function isSafeHttpsUrl(value: string, allowedHosts: Set<string>): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      allowedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function readNfseRuntimeConfig(read: EnvReader): NfseRuntimeConfig {
  const enabled = read("NFSE_ENABLED") === "true";
  const provider = read("NFSE_PROVIDER")?.trim().toLowerCase() || null;
  const municipalityIbge = read("NFSE_MUNICIPALITY_IBGE")?.trim() || null;
  const environmentValue = read("NFSE_ENVIRONMENT")?.trim().toLowerCase();
  const environment = environmentValue === "homologation" || environmentValue === "production"
    ? environmentValue
    : null;
  const baseUrl = read("NFSE_API_BASE_URL")?.trim() || "";
  const token = read("NFSE_API_TOKEN")?.trim() || "";
  const certificateSecret = read("NFSE_CERTIFICATE_SECRET")?.trim() || "";
  const allowedHosts = new Set(
    (read("NFSE_ALLOWED_HOSTS") ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
  const issues: string[] = [];

  if (!enabled) issues.push("disabled");
  if (!provider) issues.push("provider-missing");
  else if (!SUPPORTED_PROVIDERS.has(provider)) issues.push("provider-adapter-not-installed");
  if (!municipalityIbge || !/^\d{7}$/.test(municipalityIbge)) issues.push("municipality-missing");
  if (!environment) issues.push("environment-invalid");
  if (!baseUrl || !isSafeHttpsUrl(baseUrl, allowedHosts)) issues.push("endpoint-not-allowlisted");
  if (token.length < 20) issues.push("credential-missing");
  if (certificateSecret.length < 16) issues.push("certificate-secret-missing");

  return {
    enabled,
    ready: enabled && issues.length === 0,
    provider,
    municipalityIbge,
    environment,
    issues,
  };
}
