import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn, Eye, EyeOff, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const Login = () => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsLock(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setPasswordError(null);
    setFormError(null);

    const trimmedLogin = login.trim();
    if (!trimmedLogin) {
      setLoginError("Informe seu login");
      return;
    }
    if (!password) {
      setPasswordError("Informe sua senha");
      return;
    }

    setIsLoading(true);

    try {
      const { data: funcionario, error: fetchError } = await supabase
        .from("funcionarios")
        .select("email, ativo")
        .ilike("login", trimmedLogin)
        .maybeSingle();

      if (fetchError) {
        setFormError("Não foi possível verificar o login. Tente novamente.");
        setIsLoading(false);
        return;
      }

      if (!funcionario) {
        setLoginError("Login não encontrado");
        setIsLoading(false);
        return;
      }

      if (!funcionario.ativo) {
        setLoginError("Funcionário inativo. Contate o administrador.");
        setIsLoading(false);
        return;
      }

      if (!funcionario.email) {
        setLoginError("Funcionário sem email cadastrado. Contate o administrador.");
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(funcionario.email, password);
      if (error) {
        setPasswordError("Senha incorreta");
        setIsLoading(false);
        return;
      }

      navigate(from, { replace: true });
    } catch {
      setFormError("Erro inesperado ao fazer login. Tente novamente.");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sidebar via-sidebar/95 to-sidebar/90 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-black flex items-center justify-center">
              <span className="text-white font-bold text-2xl">A</span>
            </div>
            <span className="font-bold text-2xl text-white">AnjoLav</span>
          </div>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
            <CardDescription>
              Digite seu login e senha para acessar o sistema
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit} noValidate>
            <CardContent className="space-y-4">
              {formError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="login">Login</Label>
                <input
                  id="login"
                  name="username"
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="seu.login"
                  value={login}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  disabled={isLoading}
                  className={cn(
                    inputClass,
                    loginError && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {loginError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {loginError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    onKeyDown={(e) => {
                      if (typeof e.getModifierState === "function") {
                        setCapsLock(e.getModifierState("CapsLock"));
                      }
                    }}
                    disabled={isLoading}
                    className={cn(
                      inputClass,
                      "pr-10",
                      passwordError && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {passwordError}
                  </p>
                )}
                {capsLock && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Caps Lock está ativado
                  </p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Criar conta
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-white/60 mt-6">
          © 2024 AnjoLav. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
