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
    const { data: employees, error: employeeError } = await adminClient
      .from("funcionarios")
      .select("id, user_id, email, ativo")
      .eq(loginIsEmail ? "email" : "login", login)
      .limit(2);

    if (employeeError) {
      console.error("Falha ao localizar vínculo de autenticação", { errorCode: employeeError.code });
      return jsonResponse(req, { error: "Serviço temporariamente indisponível" }, 503);
    }

    const employee = employees?.length === 1 ? employees[0] : null;
    const email = employee?.ativo && employee.email
      ? employee.email
      : "invalid-login-attempt@example.invalid";
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });

    if (
      authError ||
      !employee?.ativo ||
      !employee.user_id ||
      !authData.session ||
      authData.user.id !== employee.user_id
    ) {
      return jsonResponse(req, { error: GENERIC_ERROR }, 401);
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
