import { supabase } from "@/integrations/supabase/client";

export type LoginLookupResult =
  | { ok: true; email: string; ativo: boolean }
  | { ok: false; reason: "not_found" | "inactive" | "no_email" | "lookup_error"; message: string };

/**
 * Resolve um login (username) para o email do funcionário usando a RPC
 * `get_employee_email_by_login`. Esta função usa SECURITY DEFINER para
 * contornar o RLS da tabela `funcionarios` antes do usuário estar autenticado.
 *
 * IMPORTANTE: nunca consultar `funcionarios` direto via REST aqui — isso
 * é bloqueado por RLS para usuários não autenticados.
 */
export async function resolveLoginToEmail(login: string): Promise<LoginLookupResult> {
  const trimmed = login.trim();
  if (!trimmed) {
    return { ok: false, reason: "not_found", message: "Informe seu login" };
  }

  const { data, error } = await supabase
    .rpc("get_employee_email_by_login", { p_login: trimmed })
    .maybeSingle();

  if (error) {
    console.error("[authByLogin] RPC error:", error);
    return {
      ok: false,
      reason: "lookup_error",
      message: "Não foi possível verificar o login. Tente novamente.",
    };
  }

  if (!data) {
    return { ok: false, reason: "not_found", message: "Login não encontrado" };
  }

  if (!data.ativo) {
    return {
      ok: false,
      reason: "inactive",
      message: "Funcionário inativo. Contate o administrador.",
    };
  }

  if (!data.email) {
    return {
      ok: false,
      reason: "no_email",
      message: "Funcionário sem email cadastrado. Contate o administrador.",
    };
  }

  return { ok: true, email: data.email, ativo: data.ativo };
}
