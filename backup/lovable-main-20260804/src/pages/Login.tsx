import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { resolveLoginToEmail } from "@/lib/authByLogin";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/AuthShell";
import { Loader2, LogIn, Eye, EyeOff, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 md:text-sm";

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
      setLoginError("Informe seu login ou e-mail");
      return;
    }
    if (!password) {
      setPasswordError("Informe sua senha");
      return;
    }

    setIsLoading(true);

    try {
      const lookup = await resolveLoginToEmail(trimmedLogin);

      if (lookup.ok === false) {
        if (lookup.reason === "lookup_error") {
          setFormError(lookup.message);
        } else {
          setLoginError(lookup.message);
        }
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(lookup.email, password);
      if (error) {
        setPasswordError("Login ou senha incorretos");
        setIsLoading(false);
        return;
      }

      navigate(from, { replace: true });
    } catch (err) {
      console.error("[Login] erro inesperado:", err);
      setFormError("Erro inesperado ao fazer login. Tente novamente.");
    }

    setIsLoading(false);
  };

  return (
    <AuthShell 
      badge="Acesso ao Sistema" 
      title="Entrar no AnjoLav ERP" 
      subtitle="Use seu login ou e-mail corporativo e a senha cadastrada pelo administrador."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="login" className="text-xs font-semibold text-slate-700">Login ou e-mail</Label>
          <input
            id="login"
            name="username"
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="nome.sobrenome ou email@empresa.com.br"
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
            <p className="text-[11px] text-destructive font-medium flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {loginError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Senha</Label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Esqueci minha senha
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
              placeholder="Digite sua senha"
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
              className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordError && (
            <p className="text-[11px] text-destructive font-medium flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {passwordError}
            </p>
          )}
          {capsLock && (
            <p className="text-[11px] text-warning font-medium flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Caps Lock está ativado
            </p>
          )}
        </div>

        <Button type="submit" className="w-full h-9 font-semibold" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Acessando...
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </>
          )}
        </Button>

        <div className="mt-5 text-center text-xs text-slate-500 font-medium">
          Novos acessos, perfis e permissões são gerenciados pelo administrador do sistema.
        </div>
      </form>
    </AuthShell>
  );
};

export default Login;
