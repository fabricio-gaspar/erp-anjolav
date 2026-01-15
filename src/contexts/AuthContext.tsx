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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(async () => {
            const func = await fetchFuncionario(currentSession.user.id);
            setFuncionario(func);
          }, 0);
        } else {
          setFuncionario(null);
        }

        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        const func = await fetchFuncionario(existingSession.user.id);
        setFuncionario(func);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        toast.error("Erro ao fazer login: " + error.message);
        return { error };
      }

      toast.success("Login realizado com sucesso!");
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast.error("Erro inesperado: " + error.message);
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast.error("Erro ao criar conta: " + error.message);
        return { error };
      }

      toast.success("Conta criada com sucesso! Você já pode fazer login.");
      return { error: null };
    } catch (err) {
      const error = err as Error;
      toast.error("Erro inesperado: " + error.message);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
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
        toast.error("Erro ao enviar email de recuperação: " + error.message);
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

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        funcionario,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
