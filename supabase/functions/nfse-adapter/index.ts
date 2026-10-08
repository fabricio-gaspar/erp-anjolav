import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { requireAdmin } from "../_shared/auth.ts";
import { handlePreflight, jsonResponse, readJsonBody, requireJsonPost } from "../_shared/http.ts";
import { readNfseRuntimeConfig } from "../_shared/nfse-config.ts";

type NfseAction = "health" | "issue" | "query" | "cancel";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(req, { error: "Serviço fiscal indisponível" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = await requireAdmin(req, supabase);
  if (!authorization.ok) return authorization.response;

  const parsed = await readJsonBody(req, 65_536);
  if (!parsed.ok) return parsed.response;
  if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return jsonResponse(req, { error: "Payload fiscal inválido" }, 400);
  }
  const action = (parsed.value as Record<string, unknown>).action as NfseAction | undefined;
  const runtime = readNfseRuntimeConfig((name) => Deno.env.get(name));

  if (action === "health") {
    return jsonResponse(req, {
      success: true,
      enabled: runtime.enabled,
      ready: runtime.ready,
      provider: runtime.provider,
      municipalityIbge: runtime.municipalityIbge,
      environment: runtime.environment,
      issues: runtime.issues,
    });
  }

  if (!runtime.ready) {
    console.warn("NFS-e bloqueada por configuração incompleta", {
      tenantId: authorization.tenantId,
      issues: runtime.issues,
    });
    return jsonResponse(req, {
      error: "Emissão NFS-e desativada até a homologação do município, provedor e certificado",
      code: "NFSE_NOT_READY",
      issues: runtime.issues,
    }, 503);
  }

  // A chamada externa só será implementada no adaptador específico do provedor
  // escolhido. Nunca encaminhamos payload fiscal para uma URL genérica.
  return jsonResponse(req, {
    error: "Adaptador do provedor fiscal ainda não instalado",
    code: "NFSE_PROVIDER_ADAPTER_MISSING",
  }, 503);
});
