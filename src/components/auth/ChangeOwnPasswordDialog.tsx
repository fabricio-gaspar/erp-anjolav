import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface ChangeOwnPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeOwnPasswordDialog({ open, onOpenChange }: ChangeOwnPasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [nonceSent, setNonceSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (isSubmitting) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    setNonce("");
    setNonceSent(false);
    setError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!nonceSent && !currentPassword) {
      setError("Informe sua senha atual.");
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 128) {
      setError("A nova senha deve ter entre 6 e 128 caracteres.");
      return;
    }
    if (!nonceSent && newPassword === currentPassword) {
      setError("Escolha uma senha diferente da atual.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    if (nonceSent && !nonce.trim()) {
      setError("Informe o código recebido por e-mail.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error("Sua sessão precisa ser renovada. Entre novamente no PDV.");

      if (!nonceSent) {
        // A confirmação usa um cliente sem sessão persistida para não substituir
        // a sessão do caixa nem depender da configuração opcional do Auth.
        const verifier = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
        );
        try {
          const { data, error: verificationError } = await verifier.auth.signInWithPassword({
            email: user.email,
            password: currentPassword,
          });
          if (verificationError) {
            throw new Error(verificationError.code === "invalid_credentials"
              ? "A senha atual está incorreta."
              : "Não foi possível confirmar a senha atual. Tente novamente.");
          }
          if (data.user?.id !== user.id) throw new Error("A conta verificada não corresponde à sessão atual.");
        } finally {
          await verifier.auth.signOut({ scope: "local" });
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        ...(nonceSent ? { nonce: nonce.trim() } : {}),
      });
      if (updateError?.code === "reauthentication_needed" && !nonceSent) {
        const { error: reauthError } = await supabase.auth.reauthenticate();
        if (reauthError) throw new Error("Não foi possível enviar o código de confirmação. Tente novamente mais tarde.");
        setCurrentPassword("");
        setNonceSent(true);
        return;
      }
      if (updateError) {
        throw new Error(updateError.code === "weak_password"
          ? "A senha não atende aos requisitos de segurança. Escolha outra senha."
          : nonceSent
            ? "Não foi possível confirmar o código ou alterar a senha. Confira o código e tente novamente."
            : "Não foi possível alterar a senha. Tente novamente.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setNonce("");
      setNonceSent(false);
      onOpenChange(false);
      toast.success("Senha alterada. Use a nova senha no próximo acesso.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a senha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Alterar minha senha</DialogTitle>
          <DialogDescription>Confirme sua senha atual e escolha uma nova senha para entrar no PDV.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {nonceSent ? (
            <>
              <p role="status" className="text-sm text-muted-foreground">O serviço enviou um código de confirmação para o e-mail da sua conta.</p>
              <div className="space-y-1.5">
                <Label htmlFor="pdv-password-nonce">Código de confirmação</Label>
                <Input id="pdv-password-nonce" autoComplete="one-time-code" inputMode="numeric" value={nonce} onChange={(event) => setNonce(event.target.value)} disabled={isSubmitting} required />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="pdv-current-password">Senha atual</Label>
              <Input id="pdv-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isSubmitting} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pdv-new-password">Nova senha</Label>
            <Input id="pdv-new-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isSubmitting} required />
            <p className="text-xs text-muted-foreground">Entre 6 e 128 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pdv-confirm-password">Confirmar nova senha</Label>
            <Input id="pdv-confirm-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isSubmitting} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nonceSent ? "Confirmar código e alterar" : "Alterar senha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
