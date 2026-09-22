import type { SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { jsonResponse } from "./http.ts";

type Authorized = { ok: true; user: User };
type Rejected = { ok: false; response: Response };
export type AuthorizationResult = Authorized | Rejected;

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireUser(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthorizationResult> {
  const token = bearerToken(req);
  if (!token) return { ok: false, response: jsonResponse(req, { error: "Não autorizado" }, 401) };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: jsonResponse(req, { error: "Não autorizado" }, 401) };
  }

  return { ok: true, user: data.user };
}

export async function requireAdmin(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthorizationResult> {
  const authorization = await requireUser(req, supabase);
  if (!authorization.ok) return authorization;

  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: authorization.user.id,
    _role: "admin",
  });

  if (error) {
    console.error("Falha ao validar perfil administrativo", { userId: authorization.user.id });
    return {
      ok: false,
      response: jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500),
    };
  }

  if (isAdmin !== true) {
    return { ok: false, response: jsonResponse(req, { error: "Acesso negado" }, 403) };
  }

  const { data: activeEmployee, error: employeeError } = await supabase
    .from("funcionarios")
    .select("id")
    .eq("user_id", authorization.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (employeeError) {
    return {
      ok: false,
      response: jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500),
    };
  }
  if (!activeEmployee) {
    return { ok: false, response: jsonResponse(req, { error: "Acesso negado" }, 403) };
  }

  return authorization;
}

export async function requireModule(
  req: Request,
  supabase: SupabaseClient,
  moduleKey: string,
): Promise<AuthorizationResult> {
  const authorization = await requireUser(req, supabase);
  if (!authorization.ok) return authorization;

  const { data: employee, error: employeeError } = await supabase
    .from("funcionarios")
    .select("id, ativo")
    .eq("user_id", authorization.user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (employeeError) {
    return {
      ok: false,
      response: jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500),
    };
  }
  if (!employee) return { ok: false, response: jsonResponse(req, { error: "Acesso negado" }, 403) };

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: authorization.user.id,
    _role: "admin",
  });
  if (roleError) {
    return {
      ok: false,
      response: jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500),
    };
  }
  if (isAdmin === true) return authorization;

  const { data: permission, error: permissionError } = await supabase
    .from("modulo_permissoes")
    .select("tem_acesso")
    .eq("funcionario_id", employee.id)
    .eq("modulo_key", moduleKey)
    .eq("tem_acesso", true)
    .maybeSingle();

  if (permissionError) {
    return {
      ok: false,
      response: jsonResponse(req, { error: "Não foi possível validar a autorização" }, 500),
    };
  }

  if (!permission) return { ok: false, response: jsonResponse(req, { error: "Acesso negado" }, 403) };
  return authorization;
}
