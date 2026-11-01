import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) return;

    setIsLoading(true);
    const { error } = await resetPassword(email);
    setIsLoading(false);

    if (!error) {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <AuthShell
        badge="Recuperação de senha"
        title="Confira seu e-mail"
        subtitle="Enviamos as instruções para redefinir sua senha, caso exista uma conta válida para o endereço informado."
      >
        <div className="space-y-5 text-center" role="status" aria-live="polite">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-light">
            <CheckCircle className="h-7 w-7 text-success" />
          </span>
          <p className="text-sm leading-6 text-muted-foreground">
            Verifique também a pasta de spam. Por segurança, o link possui validade limitada.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao login
            </Link>
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setEmailSent(false)}>
            Não recebeu? Tentar novamente
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge="Recuperação de senha"
      title="Recupere seu acesso"
      subtitle="Informe o e-mail da conta. Se ele estiver cadastrado, enviaremos um link seguro para criar uma nova senha."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail da conta</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isLoading}
            className="text-base md:text-sm"
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          {isLoading ? "Enviando…" : "Enviar link de recuperação"}
        </Button>

        <Button asChild variant="ghost" className="w-full">
          <Link to="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao login
          </Link>
        </Button>
      </form>
    </AuthShell>
  );
};

export default ForgotPassword;
