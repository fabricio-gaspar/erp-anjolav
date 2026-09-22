import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
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

interface AuthContextType {
  session: Session | null;
  user: User | null;
  funcionario: Funcionario | null;
  loading: boolean;
  signIn: (login: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch funcionario data linked to user
  const fetchFuncionario = async (userId: string) => {
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
  };

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
            const func = await fetchFuncionario(currentSession.user.id);
            setFuncionario(func);
            setLoading(false);
          }, 0);
        } else {
          setFuncionario(null);
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
          const func = await fetchFuncionario(existingSession.user.id);
          setFuncionario(func);
        } else {
          setFuncionario(null);
        }
      })
      .catch(() => {
        console.error("Não foi possível restaurar a sessão do usuário");
        setSession(null);
        setUser(null);
        setFuncionario(null);
      })
      .finally(() => setLoading(false));

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      setFuncionario(null);
      toast.success("Logout realizado com sucesso!");
    } catch (err) {
      console.error("Error signing out:", err);
      toast.error("Erro ao fazer logout");
    }
  };

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
        loading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
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
