import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Copy, KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { MfaCodeInput } from "@/components/auth/MfaCodeInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  beginTotpEnrollment,
  loadMfaState,
  type MfaState,
  type TotpEnrollment,
  verifyTotpFactor,
} from "@/lib/mfaSecurity";

interface MfaLocationState {
  from?: { pathname?: string; search?: string };
}

function destinationFromState(state: unknown): string {
  const candidate = (state as MfaLocationState | null)?.from;
  if (!candidate?.pathname || candidate.pathname === "/mfa") return "/";
  return `${candidate.pathname}${candidate.search ?? ""}`;
}

export default function MfaChallenge() {
  const { session, loading, mfaChallengeRequired, refreshSecurityContext, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destination = destinationFromState(location.state);
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [isLoadingFactors, setIsLoadingFactors] = useState(true);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    const nextState = await loadMfaState();
    setMfaState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    if (!session) return;
    setIsLoadingFactors(true);
    refreshFactors()
      .catch(() => setError("Não foi possível consultar seus fatores de segurança."))
      .finally(() => setIsLoadingFactors(false));
  }, [refreshFactors, session]);

  useEffect(() => {
    if (!loading && session && !mfaChallengeRequired) {
      navigate(destination, { replace: true });
    }
  }, [destination, loading, mfaChallengeRequired, navigate, session]);

  if (!loading && !session) {
    return <Navigate to="/login" replace />;
  }

  const verifiedFactor = mfaState?.verifiedFactors[0] ?? null;
  const factorId = enrollment?.factorId ?? verifiedFactor?.id ?? null;

  const startEnrollment = async () => {
    setIsPreparing(true);
    setError(null);
    try {
      setEnrollment(await beginTotpEnrollment());
      setCode("");
    } catch {
      setError("Não foi possível iniciar a configuração do autenticador.");
    } finally {
      setIsPreparing(false);
    }
  };

  const retryFactorLoad = async () => {
    setIsLoadingFactors(true);
    setError(null);
    try {
      await refreshFactors();
    } catch {
      setError("Não foi possível consultar seus fatores de segurança.");
    } finally {
      setIsLoadingFactors(false);
    }
  };

  const verify = async () => {
    if (!factorId) return;
    setIsVerifying(true);
    setError(null);
    try {
      await verifyTotpFactor(factorId, code);
      await refreshFactors();
      const security = await refreshSecurityContext();
      if (!security.mfaSatisfied) throw new Error("A sessão ainda não foi validada em AAL2.");
      toast.success("Identidade confirmada com autenticação em duas etapas.");
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Código inválido ou expirado.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AuthShell
      badge="Verificação adicional"
      title="Confirme que é você"
      subtitle="A política de segurança desta empresa exige autenticação em duas etapas para administradores."
    >
      <div className="space-y-5">
        <Alert className="border-primary/25 bg-primary/5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <AlertTitle>Acesso administrativo protegido</AlertTitle>
          <AlertDescription>
            Use um aplicativo autenticador compatível com TOTP. O código muda a cada 30 segundos.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível confirmar</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoadingFactors ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando segurança da conta…
          </div>
        ) : !mfaState ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">A verificação permanece bloqueada até a consulta ser concluída.</p>
            <Button variant="outline" className="w-full" onClick={() => void retryFactorLoad()}>
              Tentar novamente
            </Button>
          </div>
        ) : !verifiedFactor && !enrollment ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Configure seu primeiro autenticador</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Nenhum fator verificado foi encontrado nesta conta.
              </p>
            </div>
            <Button className="w-full" onClick={() => void startEnrollment()} disabled={isPreparing}>
              {isPreparing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Configurar aplicativo autenticador
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {enrollment && (
              <div className="space-y-4 rounded-xl border bg-muted/25 p-4 text-center">
                <p className="text-sm font-semibold">1. Leia o QR code no autenticador</p>
                <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                  <QRCodeSVG value={enrollment.uri} size={180} level="M" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ou informe esta chave manualmente:</p>
                  <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
                    <code className="min-w-0 flex-1 break-all text-xs font-semibold">{enrollment.secret}</code>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Copiar chave do autenticador"
                      onClick={() => {
                        navigator.clipboard.writeText(enrollment.secret)
                          .then(() => toast.success("Chave copiada."))
                          .catch(() => toast.error("Não foi possível copiar a chave."));
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 text-center">
              <div>
                <p className="text-sm font-semibold">
                  {enrollment ? "2. Digite o código exibido" : "Digite o código do autenticador"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">O código possui 6 números.</p>
              </div>
              <MfaCodeInput value={code} onChange={setCode} disabled={isVerifying} autoFocus />
              <Button
                className="w-full"
                disabled={code.length !== 6 || isVerifying}
                onClick={() => void verify()}
              >
                {isVerifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Confirmar e continuar
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair desta sessão
        </Button>
      </div>
    </AuthShell>
  );
}
