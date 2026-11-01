import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReviewClientDuplicates, useSaveClientIdentity } from "@/hooks/useClientes";
import {
  hasClientDuplicateSignal,
  validateClientIdentity,
  type ClientClassification,
  type ClientDuplicateCandidate,
  type ClientIdentityDraft,
  type ClientPersonType,
} from "@/lib/clientIdentity";

interface CadastroRapidoClienteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classification: ClientClassification;
  onCreated: (clientId: string) => void;
  onUseExisting: (clientId: string) => void;
}

const emptyDraft = (classification: ClientClassification): ClientIdentityDraft => ({
  personType: "cpf",
  classification,
  document: "",
  legalName: "",
  tradeName: "",
  email: "",
  phone: "",
  secondaryPhone: "",
  contact: "",
  stateRegistration: "",
  municipalRegistration: "",
  taxRegime: "",
  notes: "",
});

export function CadastroRapidoClienteModal({
  open,
  onOpenChange,
  classification,
  onCreated,
  onUseExisting,
}: CadastroRapidoClienteModalProps) {
  const { mutateAsync: saveClientIdentity, isPending: isSavingClient } = useSaveClientIdentity();
  const {
    mutateAsync: reviewDuplicateCandidates,
    reset: resetDuplicateReview,
    isPending: isReviewingDuplicates,
  } = useReviewClientDuplicates();
  const [draft, setDraft] = useState<ClientIdentityDraft>(() => emptyDraft(classification));
  const [candidates, setCandidates] = useState<ClientDuplicateCandidate[]>([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(classification));
    setCandidates([]);
    setAllowDuplicate(false);
    resetDuplicateReview();
  }, [classification, open, resetDuplicateReview]);

  const errors = useMemo(() => validateClientIdentity(draft), [draft]);
  const saving = isSavingClient || isReviewingDuplicates;
  const hasBlockingDuplicates = candidates.length > 0 && !allowDuplicate;

  const update = <K extends keyof ClientIdentityDraft>(key: K, value: ClientIdentityDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key !== "classification") {
      setCandidates([]);
      setAllowDuplicate(false);
    }
  };

  const submit = async () => {
    if (Object.keys(errors).length > 0) return;
    if (hasClientDuplicateSignal(draft) && candidates.length === 0) {
      const found = await reviewDuplicateCandidates(draft);
      setCandidates(found);
      if (found.length > 0) return;
    }
    if (hasBlockingDuplicates) return;
    const client = await saveClientIdentity(draft);
    onOpenChange(false);
    onCreated(client.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" />Cadastrar cliente no atendimento</DialogTitle>
          <DialogDescription>Cadastro mínimo para continuar o ROL sem abandonar o PDV. Endereço e condições comerciais podem ser completados no cadastro do cliente.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pdv-quick-client-person">Tipo</Label>
            <Select value={draft.personType} onValueChange={(personType) => update("personType", personType as ClientPersonType)}>
              <SelectTrigger id="pdv-quick-client-person"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">Pessoa física</SelectItem>
                <SelectItem value="cnpj">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-quick-client-document">{draft.personType.toUpperCase()} <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="pdv-quick-client-document" value={draft.document} onChange={(event) => update("document", event.target.value)} aria-invalid={Boolean(errors.document)} />
            {errors.document && <p className="text-xs text-destructive">{errors.document}</p>}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pdv-quick-client-name">Nome ou razão social *</Label>
            <Input id="pdv-quick-client-name" autoFocus value={draft.legalName} onChange={(event) => update("legalName", event.target.value)} aria-invalid={Boolean(errors.legalName)} />
            {errors.legalName && <p className="text-xs text-destructive">{errors.legalName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-quick-client-phone">Telefone <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="pdv-quick-client-phone" inputMode="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdv-quick-client-email">E-mail <span className="text-muted-foreground">(opcional)</span></Label>
            <Input id="pdv-quick-client-email" type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} aria-invalid={Boolean(errors.email)} />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>

        {candidates.length > 0 && (
          <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <div className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><p className="font-semibold">Encontramos clientes semelhantes. Use um cadastro existente para evitar duplicidade.</p></div>
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{candidate.name}</p>
                    <p className="text-xs text-muted-foreground">{candidate.matches.join(", ")}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => { onOpenChange(false); onUseExisting(candidate.id); }}>Usar este</Button>
                </div>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={allowDuplicate} onChange={(event) => setAllowDuplicate(event.target.checked)} className="mt-0.5" />
              Confirmo que revisei os cadastros e preciso criar um novo cliente.
            </label>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={() => void submit().catch(() => undefined)} disabled={saving || Object.keys(errors).length > 0 || hasBlockingDuplicates}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar e selecionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
