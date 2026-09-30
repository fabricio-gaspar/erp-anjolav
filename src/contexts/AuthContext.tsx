import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  email: string | null;
  avatar_url: string | null;
  departamento: string | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "admin" | "member";
  active: boolean;
}

interface TenantContext {
  activeTenantId: string | null;
  tenants: TenantSummary[];
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  funcionario: Funcionario | null;
  activeTenant: TenantSummary | null;
  tenants: TenantSummary[];
  loading: boolean;
  signIn: (login: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  switchTenant: (tenantId: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext>({ activeTenantId: null, tenants: [] });
  const [loading, setLoading] = useState(true);

  // Fetch funcionario data linked to user
  const fetchFuncionario = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, nome, cargo, email, avatar_url, departamento")
        .eq("user_id", userId)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching funcionario:", error);
        return null;
      }

      return data;
    } catch (err) {
      console.error("Error in fetchFuncionario:", err);
      return null;
    }
  }, []);

  const normalizeTenantContext = useCallback((value: unknown): TenantContext => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { activeTenantId: null, tenants: [] };
    }
    const source = value as Record<string, unknown>;
    const tenants = Array.isArray(source.tenants)
      ? source.tenants.filter((candidate): candidate is TenantSummary => {
          if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
          const tenant = candidate as Record<string, unknown>;
          return typeof tenant.id === "string" && typeof tenant.name === "string" &&
            typeof tenant.slug === "string" && ["owner", "admin", "member"].includes(String(tenant.role));
        }).map((tenant) => ({ ...tenant, active: tenant.active === true }))
      : [];
    return {
      activeTenantId: typeof source.activeTenantId === "string" ? source.activeTenantId : null,
      tenants,
    };
  }, []);

  const fetchTenantContext = useCallback(async (): Promise<TenantContext> => {
    const { data, error } = await supabase.rpc("get_my_tenant_context");
    if (error) throw error;
    const context = normalizeTenantContext(data);
    if (!context.activeTenantId || !context.tenants.some((tenant) => tenant.id === context.activeTenantId)) {
      throw new Error("Usuário sem empresa ativa autorizada");
    }
    return context;
  }, [normalizeTenantContext]);

  const loadUserContext = useCallback(async (userId: string) => {
    const [employee, tenants] = await Promise.all([
      fetchFuncionario(userId),
      fetchTenantContext(),
    ]);
    setFuncionario(employee);
    setTenantContext(tenants);
  }, [fetchFuncionario, fetchTenantContext]);

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          setLoading(true);
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(async () => {
            try {
              await loadUserContext(currentSession.user.id);
            } catch (error) {
              console.error("Não foi possível carregar o contexto da empresa", error);
              setFuncionario(null);
              setTenantContext({ activeTenantId: null, tenants: [] });
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setFuncionario(null);
          setTenantContext({ activeTenantId: null, tenants: [] });
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth
      .getSession()
      .then(async ({ data: { session: existingSession }, error }) => {
        if (error) throw error;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          await loadUserContext(existingSession.user.id);
        } else {
          setFuncionario(null);
          setTenantContext({ activeTenantId: null, tenants: [] });
        }
      })
      .catch(() => {
        console.error("Não foi possível restaurar a sessão do usuário");
        setSession(null);
        setUser(null);
        setFuncionario(null);
        setTenantContext({ activeTenantId: null, tenants: [] });
      })
      .finally(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserContext]);

  const signIn = async (login: string, password: string) => {
    try {
      const { data, error } = await supabase.functions.invoke<{
        data?: { access_token: string; refresh_token: string };
        error?: string;
      }>("sign-in", { body: { login, password } });

      if (error || !data?.data) {
        toast.error("Não foi possível entrar com as credenciais informadas.");
        return { error: new Error(data?.error || "Falha na autenticação") };
      }

      const { error: sessionError } = await supabase.auth.setSession(data.data);
      if (sessionError) throw sessionError;

      toast.success("Login realizado com sucesso!");
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast.error("Não foi possível entrar. Tente novamente mais tarde.");
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
      setFuncionario(null);
      setTenantContext({ activeTenantId: null, tenants: [] });
      toast.success("Logout realizado com sucesso!");
    } catch (err) {
      console.error("Error signing out:", err);
      toast.error("Erro ao fazer logout");
    }
  };

  const switchTenant = async (tenantId: string) => {
    try {
      if (!session?.user || tenantId === tenantContext.activeTenantId) return { error: null };
      const { data, error } = await supabase.rpc("switch_active_tenant", { _tenant_id: tenantId });
      if (error) throw error;
      const nextContext = normalizeTenantContext(data);
      if (nextContext.activeTenantId !== tenantId) throw new Error("A empresa ativa não foi confirmada");

      queryClient.clear();
      setTenantContext(nextContext);
      setFuncionario(await fetchFuncionario(session.user.id));
      toast.success("Empresa alterada com segurança.");
      return { error: null };
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error("Não foi possível alterar a empresa");
      toast.error(error.message);
      return { error };
    }
  };

  const activeTenant = tenantContext.tenants.find(
    (tenant) => tenant.id === tenantContext.activeTenantId,
  ) ?? null;

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error("Erro ao solicitar recuperação de senha:", error);
        toast.error("Não foi possível processar a solicitação. Tente novamente mais tarde.");
        return { error };
      }

      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast.error("Erro inesperado: " + error.message);
      return { error };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      if (password.length < 12 || password.length > 128) {
        const error = new Error("A senha deve ter entre 12 e 128 caracteres.");
        toast.error(error.message);
        return { error };
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        console.error("Erro ao redefinir senha:", error);
        toast.error("Não foi possível redefinir a senha. Solicite um novo link.");
        return { error };
      }

      toast.success("Senha redefinida com sucesso.");
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast.error("Não foi possível redefinir a senha. Solicite um novo link.");
      return { error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        funcionario,
        activeTenant,
        tenants: tenantContext.tenants,
        loading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        switchTenant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// O hook compartilha o contexto no mesmo módulo para manter a API pública existente.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
