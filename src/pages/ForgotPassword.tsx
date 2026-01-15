import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
          {emailSent ? (
            <>
              <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Email Enviado!</CardTitle>
                <CardDescription>
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </CardDescription>
              </CardHeader>

              <CardFooter className="flex flex-col gap-4">
                <Button asChild className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Login
                  </Link>
                </Button>

                <button
                  onClick={() => setEmailSent(false)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Não recebeu? Tentar novamente
                </button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1 text-center">
                <CardTitle className="text-2xl font-bold">Esqueceu a Senha?</CardTitle>
                <CardDescription>
                  Digite seu email e enviaremos instruções para redefinir sua senha
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar Email
                      </>
                    )}
                  </Button>

                  <Link
                    to="/login"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Login
                  </Link>
                </CardFooter>
              </form>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-white/60 mt-6">
          © 2024 AnjoLav. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
