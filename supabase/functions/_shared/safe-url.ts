export function requireAllowlistedHttpsUrl(rawValue: string, allowlistEnv: string): URL {
  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("URL de integração inválida");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("A integração deve usar HTTPS e não pode conter credenciais na URL");
  }

  const allowedHosts = new Set(
    (Deno.env.get(allowlistEnv) ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

  if (allowedHosts.size === 0) {
    throw new Error(`Allowlist ${allowlistEnv} não configurada`);
  }

  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error("Host da integração não autorizado");
  }

  return url;
}
