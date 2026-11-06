import { useCallback, useEffect, useState } from "react";
import type { Factor } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MfaCodeInput } from "@/components/auth/MfaCodeInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  beginTotpEnrollment,
  loadMfaState,
  type MfaState,
  type TotpEnrollment,
  removeTotpFactor,
  verifyTotpFactor,
} from "@/lib/mfaSecurity";

function factorLabel(factor: Factor<"totp">): string {
  return factor.friendly_name?.trim() || "Aplicativo autenticador";
}

function formatFactorDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data não disponível"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function ConfiguracoesSeguranca() {
  const {
    user,
    activeTenant,
    security,
    refreshSecurityContext,
    revokeOtherSessions,
    signOutAllSessions,
  } = useAuth();
  const [mfaState, setMfaState] = useState<MfaState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [isPreparingEnrollment, setIsPreparingEnrollment] = useState(false);
  const [policyTarget, setPolicyTarget] = useState<boolean | null>(null);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [factorToRemove, setFactorToRemove] = useState<Factor<"totp", "verified"> | null>(null);
  const [isRemovingFactor, setIsRemovingFactor] = useState(false);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  const refreshFactors = useCallback(async () => {
    const state = await loadMfaState();
    setMfaState(state);
    return state;
  }, []);

  const loadSecurity = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      await refreshFactors();
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [refreshFactors]);

  useEffect(() => {
    void loadSecurity();
  }, [loadSecurity]);

  const startEnrollment = async () => {
    setEnrollmentOpen(true);
    setEnrollment(null);
    setEnrollmentCode("");
    setIsPreparingEnrollment(true);
    try {
      setEnrollment(await beginTotpEnrollment());
    } catch {
      setEnrollmentOpen(false);
      toast.error("Não foi possível iniciar o cadastro do autenticador.");
    } finally {
      setIsPreparingEnrollment(false);
    }
  };

  const closeEnrollment = () => {
    if (isVerifying) return;
    setEnrollmentOpen(false);
    setEnrollment(null);
    setEnrollmentCode("");
  };

  const verifyEnrollment = async () => {
    if (!enrollment) return;
    setIsVerifying(true);
    try {
      await verifyTotpFactor(enrollment.factorId, enrollmentCode);
      await Promise.all([refreshFactors(), refreshSecurityContext()]);
      setEnrollmentOpen(false);
      setEnrollment(null);
      setEnrollmentCode("");
      toast.success("Autenticador configurado. As sessões antigas foram revogadas.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Código inválido ou expirado.");
    } finally {
      setIsVerifying(false);
    }
  };

  const stepUp = async () => {
    const factor = mfaState?.verifiedFactors[0];
    if (!factor) return;
    setIsVerifying(true);
    try {
      await verifyTotpFactor(factor.id, code);
      await Promise.all([refreshFactors(), refreshSecurityContext()]);
      setCode("");
      toast.success("Sessão confirmada com nível AAL2.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Código inválido ou expirado.");
    } finally {
      setIsVerifying(false);
    }
  };

  const savePolicy = async () => {
    if (policyTarget === null) return;
    setIsSavingPolicy(true);
    try {
      const { error } = await supabase.rpc("set_admin_mfa_requirement", { _enabled: policyTarget });
      if (error) throw error;
      await refreshSecurityContext();
      toast.success(
        policyTarget
          ? "MFA obrigatório ativado para administradores."
          : "MFA obrigatório desativado para administradores.",
      );
      setPolicyTarget(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível atualizar a política.";
      toast.error(message.includes("MFA_REQUIRED") ? "Confirme sua identidade em AAL2 antes de alterar a política." : message);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const removeFactor = async () => {
    if (!factorToRemove) return;
    setIsRemovingFactor(true);
    try {
      await removeTotpFactor(factorToRemove.id);
      await Promise.all([refreshFactors(), refreshSecurityContext()]);
      setFactorToRemove(null);
      toast.success("Fator de autenticação removido.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Não foi possível remover o fator.");
    } finally {
      setIsRemovingFactor(false);
    }
  };

  const revokeOthers = async () => {
    setIsRevokingSessions(true);
    await revokeOtherSessions();
    setIsRevokingSessions(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-52 items-center justify-center gap-2 pt-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando controles de segurança…
        </CardContent>
      </Card>
    );
  }

  if (loadError || !mfaState) {
    return (
      <Card>
        <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 pt-5 text-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm font-semibold">Não foi possível consultar a segurança da conta</p>
            <p className="mt-1 text-xs text-muted-foreground">Nenhuma configuração foi alterada. Tente novamente.</p>
          </div>
          <Button variant="outline" onClick={() => void loadSecurity()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const verifiedFactors = mfaState.verifiedFactors;
  const aal2 = mfaState.currentLevel === "aal2";
  const blocksLastFactorRemoval = security.requireMfaForAdmins && verifiedFactors.length <= 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card>
          <CardHeader className="border-b bg-muted/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Autenticação em duas etapas
                </CardTitle>
                <CardDescription className="mt-1">
                  Proteja sua conta com códigos temporários de um aplicativo autenticador.
                </CardDescription>
              </div>
              <Badge variant={aal2 ? "default" : "outline"} className={aal2 ? "bg-emerald-600" : ""}>
                {aal2 ? "AAL2 verificado" : "AAL1 padrão"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-lg border bg-muted/20 px-4 py-3">
              <p className="text-sm font-medium">{user?.email || "Conta autenticada"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {verifiedFactors.length === 0
                  ? "Nenhum autenticador verificado."
                  : `${verifiedFactors.length} autenticador(es) verificado(s).`}
              </p>
            </div>

            {verifiedFactors.map((factor) => (
              <div key={factor.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{factorLabel(factor)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Adicionado em {formatFactorDate(factor.created_at)}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={!aal2 || blocksLastFactorRemoval}
                  onClick={() => setFactorToRemove(factor)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              </div>
            ))}

            {verifiedFactors.length === 0 && (
              <Alert>
                <KeyRound className="h-4 w-4" />
                <AlertTitle>Recomendação de segurança</AlertTitle>
                <AlertDescription>
                  Cadastre um autenticador antes de ativar a exigência de MFA para administradores.
                </AlertDescription>
              </Alert>
            )}

            {verifiedFactors.length > 0 && !aal2 && (
              <div className="space-y-4 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:bg-amber-950/20">
                <div>
                  <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">Confirmar identidade nesta sessão</p>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                    Necessário para alterar a política ou remover fatores verificados.
                  </p>
                </div>
                <MfaCodeInput value={code} onChange={setCode} disabled={isVerifying} />
                <Button size="sm" disabled={code.length !== 6 || isVerifying} onClick={() => void stepUp()}>
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar em AAL2
                </Button>
              </div>
            )}

            {blocksLastFactorRemoval && (
              <p className="text-xs text-muted-foreground">
                O último autenticador não pode ser removido enquanto a política obrigatória estiver ativa.
              </p>
            )}

            <Button variant="outline" onClick={() => void startEnrollment()} disabled={isPreparingEnrollment}>
              {isPreparingEnrollment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Adicionar autenticador
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="flex items-center gap-2">
              <Laptop className="h-5 w-5 text-primary" />
              Sessões da conta
            </CardTitle>
            <CardDescription>Revogue acessos sem precisar trocar sua senha.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Sessão atual ativa
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                O logout normal encerra somente este navegador. Use os controles abaixo para os demais dispositivos.
              </p>
            </div>
            <Button variant="outline" className="w-full justify-start" onClick={() => void revokeOthers()} disabled={isRevokingSessions}>
              {isRevokingSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Encerrar outras sessões
            </Button>
            <Button variant="destructive" className="w-full justify-start" onClick={() => void signOutAllSessions()}>
              <LogOut className="mr-2 h-4 w-4" />
              Encerrar todas as sessões
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                Política administrativa da empresa
              </CardTitle>
              <CardDescription className="mt-1">
                Aplica MFA no servidor a regras de banco e funções administrativas de {activeTenant?.name || "esta empresa"}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
              <span className="text-sm font-medium">Exigir MFA</span>
              <Switch
                aria-label="Exigir MFA para administradores"
                checked={security.requireMfaForAdmins}
                disabled={!aal2 || verifiedFactors.length === 0 || isSavingPolicy}
                onCheckedChange={(checked) => setPolicyTarget(checked)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <Alert className={security.requireMfaForAdmins ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20" : ""}>
            {security.requireMfaForAdmins ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4" />}
            <AlertTitle>{security.requireMfaForAdmins ? "Proteção obrigatória ativa" : "Proteção disponível, ainda opcional"}</AlertTitle>
            <AlertDescription>
              {security.requireMfaForAdmins
                ? "Administradores em AAL1 são direcionados ao desafio e operações privilegiadas recusam a requisição no servidor."
                : "Os usuários atuais continuam acessando normalmente até um administrador AAL2 ativar esta política."}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Dialog open={enrollmentOpen} onOpenChange={(open) => open ? setEnrollmentOpen(true) : closeEnrollment()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar aplicativo autenticador</DialogTitle>
            <DialogDescription>Leia o QR code e confirme um código para concluir.</DialogDescription>
          </DialogHeader>
          {isPreparingEnrollment || !enrollment ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando chave protegida…
            </div>
          ) : (
            <div className="space-y-5">
              <div className="mx-auto w-fit rounded-xl border bg-white p-3">
                <QRCodeSVG value={enrollment.uri} size={190} level="M" />
              </div>
              <div className="space-y-2">
                <p className="text-center text-xs text-muted-foreground">Chave para configuração manual</p>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                  <code className="min-w-0 flex-1 break-all text-xs font-semibold">{enrollment.secret}</code>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Copiar chave do autenticador"
                    onClick={() => navigator.clipboard.writeText(enrollment.secret)
                      .then(() => toast.success("Chave copiada."))
                      .catch(() => toast.error("Não foi possível copiar a chave."))}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <MfaCodeInput value={enrollmentCode} onChange={setEnrollmentCode} disabled={isVerifying} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEnrollment} disabled={isVerifying}>Cancelar</Button>
            <Button disabled={!enrollment || enrollmentCode.length !== 6 || isVerifying} onClick={() => void verifyEnrollment()}>
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar e ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={policyTarget !== null} onOpenChange={(open) => !open && !isSavingPolicy && setPolicyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{policyTarget ? "Exigir MFA dos administradores?" : "Desativar MFA obrigatório?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {policyTarget
                ? "A partir da confirmação, sessões administrativas AAL1 precisarão validar ou cadastrar um autenticador antes de acessar o sistema."
                : "Os fatores cadastrados serão preservados, mas a validação AAL2 deixará de ser obrigatória para operações administrativas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingPolicy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void savePolicy(); }} disabled={isSavingPolicy}>
              {isSavingPolicy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(factorToRemove)} onOpenChange={(open) => !open && !isRemovingFactor && setFactorToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover autenticador?</AlertDialogTitle>
            <AlertDialogDescription>
              O dispositivo deixará de gerar códigos válidos para esta conta. Esta ação exige uma sessão AAL2.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingFactor}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => { event.preventDefault(); void removeFactor(); }}
              disabled={isRemovingFactor}
            >
              {isRemovingFactor && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover fator
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
