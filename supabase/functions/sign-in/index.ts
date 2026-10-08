import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import {
  handlePreflight,
  jsonResponse,
  readJsonBody,
  requireJsonPost,
} from "../_shared/http.ts";

interface SignInRequest {
  login?: string;
  password?: string;
}

const GENERIC_ERROR = "Não foi possível entrar com as credenciais informadas";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const invalidRequest = requireJsonPost(req);
  if (invalidRequest) return invalidRequest;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }

  const parsedBody = await readJsonBody(req, 16_384);
  if (!parsedBody.ok) return parsedBody.response;
  if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
    return jsonResponse(req, { error: "Requisição inválida" }, 400);
  }
  const body = parsedBody.value as SignInRequest;

  const login = typeof body.login === "string" ? body.login.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const loginIsEmail = login.includes("@");
  const loginFormatValid = loginIsEmail
    ? /^[^\s@,()%]+@[^\s@,()%]+\.[^\s@,()%]+$/.test(login)
    : /^[a-z0-9._-]{2,64}$/.test(login);
  if (!loginFormatValid || login.length > 254 || !password || password.length > 128) {
    return jsonResponse(req, { error: GENERIC_ERROR }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let email = loginIsEmail ? login : "invalid-login-attempt@example.invalid";
    if (!loginIsEmail) {
      const { data: employees, error: employeeError } = await adminClient
        .from("funcionarios")
        .select("email")
        .eq("login", login)
        .eq("ativo", true)
        .limit(2);
      if (employeeError) {
        console.error("Falha ao localizar vínculo de autenticação", { errorCode: employeeError.code });
        return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
      }
      // Em SaaS o mesmo apelido pode existir em empresas diferentes. Nessa
      // situação o e-mail corporativo é o identificador não ambíguo.
      if (employees?.length === 1 && employees[0].email) email = employees[0].email;
    }
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session || !authData.user) {
      return jsonResponse(req, { error: GENERIC_ERROR }, 401);
    }

    const { data: memberships, error: membershipError } = await adminClient
      .from("tenant_memberships")
      .select("tenant_id, is_active, tenant:tenants!inner(status)")
      .eq("user_id", authData.user.id)
      .eq("enabled", true)
      .eq("tenant.status", "active");
    if (membershipError) throw membershipError;
    const tenantIds = (memberships ?? []).map((membership) => membership.tenant_id);
    const { data: employees, error: employeeError } = tenantIds.length > 0
      ? await adminClient
          .from("funcionarios")
          .select("id, tenant_id")
          .in("tenant_id", tenantIds)
          .eq("user_id", authData.user.id)
          .eq("ativo", true)
      : { data: [], error: null };
    if (employeeError) throw employeeError;
    const eligibleTenantIds = new Set((employees ?? []).map((employee) => employee.tenant_id));
    const selectedMembership = (memberships ?? []).find((membership) =>
      membership.is_active && eligibleTenantIds.has(membership.tenant_id)
    ) ?? (memberships ?? []).find((membership) => eligibleTenantIds.has(membership.tenant_id));
    if (!selectedMembership) {
      await authClient.auth.signOut();
      return jsonResponse(req, { error: GENERIC_ERROR }, 401);
    }
    if (!selectedMembership.is_active) {
      const { error: clearActiveError } = await adminClient.from("tenant_memberships")
        .update({ is_active: false })
        .eq("user_id", authData.user.id)
        .eq("is_active", true);
      if (clearActiveError) throw clearActiveError;
      const { error: selectTenantError } = await adminClient.from("tenant_memberships")
        .update({ is_active: true })
        .eq("user_id", authData.user.id)
        .eq("tenant_id", selectedMembership.tenant_id);
      if (selectTenantError) throw selectTenantError;
    }

    return jsonResponse(req, {
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    });
  } catch {
    console.error("Falha inesperada no fluxo de autenticação");
    return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
  }
});
