import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  email: string | null;
  avatar_url: string | null;
  departamento: string | null;
}

export const getSession = async (): Promise<Session | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const getFuncionario = async (userId: string): Promise<Funcionario | null> => {
  const { data } = await supabase
    .from("funcionarios")
    .select("id, nome, cargo, email, avatar_url, departamento")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
};

export const hasRole = async (userId: string, role: "admin" | "operador" | "producao"): Promise<boolean> => {
  const { data } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: role
  });
  return !!data;
};

export const hasAreaAccess = async (userId: string, area: string): Promise<boolean> => {
  // Simplified area access check until the RPC is available in the schema
  // Admins have access to everything. 
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  
  const isAdmin = roles?.some(r => r.role === "admin");
  if (isAdmin) return true;

  // Placeholder logic for Phase 1
  return true;
};
