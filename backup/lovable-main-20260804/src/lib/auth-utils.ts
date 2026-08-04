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
  const { data, error } = await supabase.rpc("has_area_access", {
    _user_id: userId,
    _area: area
  });
  
  if (error) {
    console.error("Error checking area access:", error);
    return false;
  }
  
  return !!data;
};
