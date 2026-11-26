import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  ContactRound,
  FileText,
  Home,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useClienteById,
  useReviewClientDuplicates,
  useSaveClientIdentity,
} from "@/hooks/useClientes";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { clearScopedDraft, readScopedDraft, scopedDraftKey, writeScopedDraft } from "@/lib/scopedDraft";
import { buscarCnpj, type BrasilApiCnpjResponse } from "@/services/apiServices";
import {
  CLIENT_DUPLICATE_REASON_LABELS,
  clientIdentityFingerprint,
  hasNameAndPhoneMatch,
  hasClientDuplicateSignal,
  validateClientIdentity,
  type ClientClassification,
  type ClientDuplicateCandidate,
  type ClientIdentityDraft,
  type ClientIdentityErrors,
  type ClientPersonType,
} from "@/lib/clientIdentity";
import { cn } from "@/lib/utils";
import { normalizeClientClassification } from "@/lib/operations";
import { toast } from "sonner";

interface ClienteDadosBasicosProps {
  clienteId: string | null;
  onNext: () => void;
  onClienteSaved: (clienteId: string) => void;
  onSaved?: (clienteId: string) => void;
  onOpenExistingClient: (clienteId: string) => void;
  onCnpjDataLoaded?: (data: BrasilApiCnpjResponse) => void;
}

type RegimeTributario =
  | "simples_nacional"
  | "simples_excesso"
  | "normal"
  | "mei"
  | "nao_contribuinte";

type FormValues = {
  cpf_cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  telefone2: string;
  contato: string;
  observacoes: string;
};

const EMPTY_FORM: FormValues = {
  cpf_cnpj: "",
  razao_social: "",
  nome_fantasia: "",
  email: "",
  telefone: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  telefone2: "",
  contato: "",
  observacoes: "",
};

interface ClientFormDraft {
  formData: FormValues;
  personType: ClientPersonType;
  classification: ClientClassification;
  classificationConfirmed: boolean;
  taxRegime: RegimeTributario;
}

const TAX_REGIMES: Array<{ value: RegimeTributario; label: string }> = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "simples_excesso", label: "Simples (excesso)" },
  { value: "normal", label: "Regime normal" },
  { value: "mei", label: "MEI" },
  { value: "nao_contribuinte", label: "Não contribuinte" },
];

function FormField({
  id,
  label,
  className,
  optional,
  error,
  helper,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  optional?: boolean;
  error?: string;
  helper?: string;
  children: ReactNode;
}) {
  const descriptionId = error
    ? `${id}-error`
    : helper
      ? `${id}-helper`
      : undefined;
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        {optional && (
          <span className="text-xs text-muted-foreground">Opcional</span>
        )}
      </div>
      <div aria-describedby={descriptionId}>{children}</div>
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1 text-xs font-medium text-destructive"
        >
          <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : helper ? (
        <p
          id={`${id}-helper`}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function reviewSignature(candidates: ClientDuplicateCandidate[]) {
  return JSON.stringify(
    candidates
      .map((candidate) => [
        candidate.id,
        candidate.documentConflict,
        [...candidate.matches].sort(),
      ])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação";
}

export const ClienteDadosBasicos = ({
  clienteId,
  onNext,
  onClienteSaved,
  onSaved,
  onOpenExistingClient,
  onCnpjDataLoaded,
}: ClienteDadosBasicosProps) => {
  const location = useLocation();
  const { activeArea } = useWorkspace();
  const { user, activeTenant } = useAuth();
  const formDraftKey = scopedDraftKey(user?.id, activeTenant?.id, `cliente:${activeArea}:${clienteId ?? "novo"}`);
  const isPdvClientWorkspace = location.pathname.startsWith("/pdv/");
  const {
    data: clienteExistente,
    isLoading: isLoadingCliente,
    isError: hasClientLoadError,
    error: clientLoadError,
    refetch: refetchClient,
  } = useClienteById(clienteId);
  const {
    mutateAsync: reviewDuplicateCandidates,
    reset: resetDuplicateReview,
    isPending: isReviewPending,
    isError: hasReviewError,
    error: reviewError,
  } = useReviewClientDuplicates();
  const saveIdentity = useSaveClientIdentity();

  const [tipoPessoa, setTipoPessoa] = useState<ClientPersonType>("cnpj");
  const [classificacao, setClassificacao] = useState<ClientClassification>(
    activeArea === "industrial" ? "industrial" : "domestico",
  );
  const [classificationConfirmed, setClassificationConfirmed] = useState(activeArea !== "central");
  const [regimeTributario, setRegimeTributario] =
    useState<RegimeTributario>("nao_contribuinte");
  const [formData, setFormData] = useState<FormValues>(EMPTY_FORM);
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [errors, setErrors] = useState<ClientIdentityErrors>({});
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(isPdvClientWorkspace);
  const [reviewedFingerprint, setReviewedFingerprint] = useState<string | null>(
    null,
  );
  const [duplicateCandidates, setDuplicateCandidates] = useState<
    ClientDuplicateCandidate[]
  >([]);
  const [acknowledgedReview, setAcknowledgedReview] = useState<string | null>(
    null,
  );

  const clearDuplicateReview = useCallback(() => {
    setReviewedFingerprint(null);
    setDuplicateCandidates([]);
    setAcknowledgedReview(null);
    resetDuplicateReview();
  }, [resetDuplicateReview]);

  useEffect(() => {
    if (!clienteExistente) return;
    const saved = readScopedDraft<ClientFormDraft>(formDraftKey);
    setTipoPessoa(saved?.personType ?? clienteExistente.tipo_pessoa);
    setClassificacao(saved?.classification ?? normalizeClientClassification(clienteExistente.classificacao) ?? "domestico");
    setClassificationConfirmed(saved?.classificationConfirmed ?? true);
    setRegimeTributario(saved?.taxRegime ?? (clienteExistente.regime_tributario as RegimeTributario | null) ?? "nao_contribuinte");
    setFormData(saved?.formData ?? {
      cpf_cnpj: clienteExistente.cpf_cnpj ?? "",
      razao_social: clienteExistente.razao_social ?? "",
      nome_fantasia: clienteExistente.nome_fantasia ?? "",
      email: clienteExistente.email ?? "",
      telefone: clienteExistente.telefone ?? "",
      inscricao_estadual: clienteExistente.inscricao_estadual ?? "",
      inscricao_municipal: clienteExistente.inscricao_municipal ?? "",
      telefone2: clienteExistente.telefone2 ?? "",
      contato: clienteExistente.contato ?? "",
      observacoes: clienteExistente.observacoes ?? "",
    });
    setDraftDirty(Boolean(saved));
    setLoadedDraftKey(formDraftKey);
    setErrors({});
    setReviewedFingerprint(null);
    setDuplicateCandidates([]);
    setAcknowledgedReview(null);
  }, [clienteExistente, formDraftKey]);

  useEffect(() => {
    if (clienteId) return;
    const saved = readScopedDraft<ClientFormDraft>(formDraftKey);
    setTipoPessoa(saved?.personType ?? "cnpj");
    setClassificacao(saved?.classification ?? (activeArea === "industrial" ? "industrial" : "domestico"));
    setClassificationConfirmed(saved?.classificationConfirmed ?? activeArea !== "central");
    setRegimeTributario(saved?.taxRegime ?? "nao_contribuinte");
    setFormData(saved?.formData ?? EMPTY_FORM);
    setDraftDirty(Boolean(saved));
    setLoadedDraftKey(formDraftKey);
    setErrors({});
    setReviewedFingerprint(null);
    setDuplicateCandidates([]);
    setAcknowledgedReview(null);
    resetDuplicateReview();
  }, [activeArea, clienteId, formDraftKey, resetDuplicateReview]);

  useEffect(() => {
    if (!formDraftKey || loadedDraftKey !== formDraftKey) return;
    if (!draftDirty) {
      clearScopedDraft(formDraftKey);
      return;
    }
    writeScopedDraft(formDraftKey, { formData, personType: tipoPessoa, classification: classificacao, classificationConfirmed, taxRegime: regimeTributario } satisfies ClientFormDraft);
  }, [formDraftKey, loadedDraftKey, draftDirty, formData, tipoPessoa, classificacao, classificationConfirmed, regimeTributario]);

  const effectiveClassification: ClientClassification =
    activeArea === "central" ? classificacao : normalizeClientClassification(activeArea) ?? classificacao;

  const draft = useMemo<ClientIdentityDraft>(
    () => ({
      clientId: clienteId,
      personType: tipoPessoa,
      classification: effectiveClassification,
      document: formData.cpf_cnpj,
      legalName: formData.razao_social,
      tradeName: formData.nome_fantasia,
      email: formData.email,
      phone: formData.telefone,
      secondaryPhone: formData.telefone2,
      contact: formData.contato,
      stateRegistration: formData.inscricao_estadual,
      municipalRegistration: formData.inscricao_municipal,
      taxRegime: regimeTributario,
      notes: formData.observacoes,
    }),
    [
      clienteId,
      effectiveClassification,
      formData,
      regimeTributario,
      tipoPessoa,
    ],
  );

  const fingerprint = clientIdentityFingerprint(draft);
  const reviewIsCurrent = reviewedFingerprint === fingerprint;
  const currentCandidates = reviewIsCurrent ? duplicateCandidates : [];
  const currentReviewSignature = reviewSignature(currentCandidates);
  const documentConflict = currentCandidates.find(
    (candidate) => candidate.documentConflict,
  );
  const namePhoneConflict = currentCandidates.find(hasNameAndPhoneMatch);
  const blockingConflict = Boolean(documentConflict || namePhoneConflict);
  const reviewAcknowledged =
    currentCandidates.length === 0 ||
    acknowledgedReview === currentReviewSignature;
  const isBusy =
    saveIdentity.isPending || isReviewPending || isSearchingCnpj;

  const handleChange = (field: keyof FormValues, value: string) => {
    setDraftDirty(true);
    setFormData((previous) => ({ ...previous, [field]: value }));
    const identityFieldMap: Partial<
      Record<keyof FormValues, keyof ClientIdentityErrors>
    > = {
      cpf_cnpj: "document",
      razao_social: "legalName",
      nome_fantasia: "tradeName",
      email: "email",
      telefone: "phone",
      telefone2: "secondaryPhone",
      contato: "contact",
      inscricao_estadual: "stateRegistration",
      inscricao_municipal: "municipalRegistration",
      observacoes: "notes",
    };
    const errorField = identityFieldMap[field];
    if (errorField)
      setErrors((previous) => ({ ...previous, [errorField]: undefined }));
    if (
      ["cpf_cnpj", "razao_social", "email", "telefone", "telefone2"].includes(
        field,
      )
    ) {
      clearDuplicateReview();
    }
  };

  const changePersonType = (nextType: ClientPersonType) => {
    if (nextType === tipoPessoa) return;
    setTipoPessoa(nextType);
    setDraftDirty(true);
    setFormData((previous) => ({ ...previous, cpf_cnpj: "" }));
    setErrors((previous) => ({ ...previous, document: undefined }));
    clearDuplicateReview();
  };

  const changeClassification = (nextClassification: ClientClassification) => {
    setDraftDirty(true);
    setClassificacao(nextClassification);
    setClassificationConfirmed(true);
    clearDuplicateReview();
  };

  const discardDraft = () => {
    clearScopedDraft(formDraftKey);
    setDraftDirty(false);
    setFormData(clienteExistente ? {
      cpf_cnpj: clienteExistente.cpf_cnpj ?? "",
      razao_social: clienteExistente.razao_social ?? "",
      nome_fantasia: clienteExistente.nome_fantasia ?? "",
      email: clienteExistente.email ?? "",
      telefone: clienteExistente.telefone ?? "",
      inscricao_estadual: clienteExistente.inscricao_estadual ?? "",
      inscricao_municipal: clienteExistente.inscricao_municipal ?? "",
      telefone2: clienteExistente.telefone2 ?? "",
      contato: clienteExistente.contato ?? "",
      observacoes: clienteExistente.observacoes ?? "",
    } : EMPTY_FORM);
    setTipoPessoa(clienteExistente?.tipo_pessoa ?? "cnpj");
    setClassificacao(normalizeClientClassification(clienteExistente?.classificacao) ?? (activeArea === "industrial" ? "industrial" : "domestico"));
    setClassificationConfirmed(Boolean(clienteExistente) || activeArea !== "central");
    setRegimeTributario((clienteExistente?.regime_tributario as RegimeTributario | null) ?? "nao_contribuinte");
    setErrors({});
    clearDuplicateReview();
  };

  const runDuplicateReview = useCallback(
    async (snapshot: ClientIdentityDraft) => {
      const snapshotFingerprint = clientIdentityFingerprint(snapshot);
      if (!hasClientDuplicateSignal(snapshot)) {
        setReviewedFingerprint(snapshotFingerprint);
        setDuplicateCandidates([]);
        setAcknowledgedReview(null);
        return [];
      }

      const candidates = await reviewDuplicateCandidates(snapshot);
      setReviewedFingerprint(snapshotFingerprint);
      setDuplicateCandidates(candidates);
      if (candidates.length === 0) setAcknowledgedReview(null);
      return candidates;
    },
    [reviewDuplicateCandidates],
  );

  const reviewOnBlur = () => {
    if (
      (activeArea === "central" && !classificationConfirmed) ||
      !hasClientDuplicateSignal(draft) ||
      isReviewPending ||
      saveIdentity.isPending
    )
      return;
    void runDuplicateReview(draft).catch(() => undefined);
  };

  const handleCnpjSearch = useCallback(async () => {
    const cnpj = formData.cpf_cnpj.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("CNPJ deve conter 14 dígitos");
      return;
    }

    setIsSearchingCnpj(true);
    try {
      const data = await buscarCnpj(cnpj);
      if (!data) {
        toast.error("CNPJ não encontrado na base de dados");
        return;
      }
      if (data.situacao_cadastral !== "ATIVA") {
        toast.warning(
          `Atenção: situação cadastral ${data.descricao_situacao_cadastral}`,
        );
      }
      setFormData((previous) => ({
        ...previous,
        razao_social: data.razao_social || previous.razao_social,
        nome_fantasia: data.nome_fantasia || previous.nome_fantasia,
        email: data.email || previous.email,
        telefone: data.ddd_telefone_1 || previous.telefone,
        telefone2: data.ddd_telefone_2 || previous.telefone2,
      }));
      setDraftDirty(true);
      if (data.opcao_pelo_mei) setRegimeTributario("mei");
      else if (data.opcao_pelo_simples) setRegimeTributario("simples_nacional");
      else setRegimeTributario("normal");
      clearDuplicateReview();
      onCnpjDataLoaded?.(data);
      toast.success("Dados do CNPJ carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast.error("Erro ao buscar CNPJ. Confira o número e tente novamente.");
    } finally {
      setIsSearchingCnpj(false);
    }
  }, [clearDuplicateReview, formData.cpf_cnpj, onCnpjDataLoaded]);

  const handleSave = async (goNext: boolean) => {
    if (activeArea === "central" && !classificationConfirmed) {
      toast.error("Escolha a operação responsável pelo cliente antes de salvar");
      return;
    }
    const snapshot = draft;
    const validationErrors = validateClientIdentity(snapshot);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Revise os campos destacados antes de salvar");
      return;
    }

    let candidates: ClientDuplicateCandidate[];
    try {
      candidates = await runDuplicateReview(snapshot);
    } catch {
      toast.error(
        "Não foi possível revisar cadastros semelhantes. Tente novamente.",
      );
      return;
    }

    const conflict = candidates.find((candidate) => candidate.documentConflict || hasNameAndPhoneMatch(candidate));
    if (conflict) {
      toast.error(conflict.documentConflict ? "Este CPF/CNPJ já pertence a outro cliente" : "Este nome e telefone já pertencem a outro cliente. Abra o cadastro existente.");
      return;
    }

    const signature = reviewSignature(candidates);
    if (candidates.length > 0 && acknowledgedReview !== signature) {
      toast.warning("Confira os cadastros semelhantes e confirme a revisão");
      return;
    }

    try {
      const savedClient = await saveIdentity.mutateAsync(snapshot);
      clearScopedDraft(formDraftKey);
      setDraftDirty(false);
      onClienteSaved(savedClient.id);
      if (goNext) onNext();
      else onSaved?.(savedClient.id);
    } catch {
      // O hook apresenta a causa e o estado local é mantido para uma nova tentativa.
    }
  };

  if (isLoadingCliente && clienteId) {
    return (
      <div
        className="content-panel flex min-h-64 items-center justify-center"
        aria-live="polite"
      >
        <Loader2
          className="h-5 w-5 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="ml-2 text-sm text-muted-foreground">
          Carregando dados do cliente...
        </span>
      </div>
    );
  }

  if (hasClientLoadError || (clienteId && !clienteExistente)) {
    return (
      <Alert variant="destructive" className="surface-panel">
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>Não foi possível abrir o cadastro</AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p>{errorMessage(clientLoadError)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetchClient()}
          >
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const canSearchCnpj =
    tipoPessoa === "cnpj" && formData.cpf_cnpj.replace(/\D/g, "").length === 14;

  return (
    <form
      className={cn("pdv-client-form space-y-5", `pdv-client-form--${tipoPessoa}`)}
      data-testid="client-identity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave(false);
      }}
      noValidate
    >
      <div className="pdv-client-form__workspace">
        <div className="pdv-client-form__primary">
      <section className="pdv-client-form__identity surface-panel overflow-hidden">
        <div className="border-b bg-muted/20 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">
                  Identificação do cliente
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Comece pelos dados essenciais. Campos fiscais e observações
                  ficam em detalhes avançados.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="w-fit bg-background text-muted-foreground"
            >
              <ShieldCheck
                className="mr-1 h-3.5 w-3.5 text-primary"
                aria-hidden="true"
              />
              Revisão de duplicidade ativa
            </Badge>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-semibold text-foreground">
                Tipo de cadastro
              </legend>
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label="Tipo de cadastro"
              >
                <Button
                  type="button"
                  variant={tipoPessoa === "cpf" ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={tipoPessoa === "cpf"}
                  onClick={() => changePersonType("cpf")}
                  disabled={isBusy}
                >
                  <UserRound className="h-4 w-4" /> Pessoa física
                </Button>
                <Button
                  type="button"
                  variant={tipoPessoa === "cnpj" ? "default" : "outline"}
                  className="h-11"
                  aria-pressed={tipoPessoa === "cnpj"}
                  onClick={() => changePersonType("cnpj")}
                  disabled={isBusy}
                >
                  <Building2 className="h-4 w-4" /> Pessoa jurídica
                </Button>
              </div>
            </fieldset>

            <fieldset className="min-w-0 space-y-2">
              <legend className="text-sm font-semibold text-foreground">
                Operação responsável
              </legend>
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label="Operação responsável"
              >
                <Button
                  type="button"
                  variant={
                    classificationConfirmed && effectiveClassification === "domestico"
                      ? "default"
                      : "outline"
                  }
                  className="h-11"
                  aria-pressed={classificationConfirmed && effectiveClassification === "domestico"}
                  onClick={() => changeClassification("domestico")}
                  disabled={activeArea !== "central" || isBusy}
                >
                  <Home className="h-4 w-4" /> Doméstico
                </Button>
                <Button
                  type="button"
                  variant={
                    classificationConfirmed && effectiveClassification === "industrial"
                      ? "default"
                      : "outline"
                  }
                  className="h-11"
                  aria-pressed={classificationConfirmed && effectiveClassification === "industrial"}
                  onClick={() => changeClassification("industrial")}
                  disabled={activeArea !== "central" || isBusy}
                >
                  <Building2 className="h-4 w-4" /> Industrial
                </Button>
              </div>
              {activeArea === "central" && !classificationConfirmed && (
                <p className="text-xs font-medium text-amber-700">Selecione a operação antes de salvar. Ela define onde o cliente aparecerá no PDV.</p>
              )}
              {activeArea !== "central" && (
                <p className="text-xs text-muted-foreground">
                  A operação segue o painel atual e não pode ser alterada neste
                  cadastro.
                </p>
              )}
            </fieldset>
          </div>

          <div className={cn("pdv-client-identification-grid grid gap-5", `pdv-client-identification-grid--${tipoPessoa}`)}>
            <FormField
              id="client-document"
              className="pdv-client-field--document"
              label={tipoPessoa === "cnpj" ? "CNPJ" : "CPF"}
              optional
              error={errors.document}
              helper="Usado para evitar cadastros repetidos e facilitar a identificação."
            >
              <div className="flex gap-2">
                <Input
                  id="client-document"
                  value={formData.cpf_cnpj}
                  placeholder={
                    tipoPessoa === "cnpj"
                      ? "00.000.000/0000-00"
                      : "000.000.000-00"
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={tipoPessoa === "cnpj" ? 18 : 14}
                  aria-invalid={Boolean(errors.document)}
                  className="h-11 min-w-0"
                  onChange={(event) =>
                    handleChange("cpf_cnpj", event.target.value)
                  }
                  onBlur={reviewOnBlur}
                  disabled={isBusy}
                />
                {tipoPessoa === "cnpj" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 shrink-0"
                    onClick={() => void handleCnpjSearch()}
                    disabled={!canSearchCnpj || isBusy}
                    aria-label="Buscar dados públicos do CNPJ"
                    title="Buscar dados públicos do CNPJ"
                  >
                    {isSearchingCnpj ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </FormField>

            <FormField
              id="client-legal-name"
              className="pdv-client-field--legal-name"
              label={tipoPessoa === "cpf" ? "Nome completo" : "Razão social"}
              error={errors.legalName}
              helper="Campo obrigatório."
            >
              <Input
                id="client-legal-name"
                value={formData.razao_social}
                placeholder={
                  tipoPessoa === "cpf" ? "Nome e sobrenome" : "Nome empresarial"
                }
                autoComplete="organization"
                maxLength={160}
                aria-required="true"
                aria-invalid={Boolean(errors.legalName)}
                className="h-11"
                onChange={(event) =>
                  handleChange("razao_social", event.target.value)
                }
                onBlur={reviewOnBlur}
                disabled={isBusy}
              />
            </FormField>
            {tipoPessoa === "cnpj" && (
              <FormField
                id="client-trade-name"
                className="pdv-client-field--trade-name"
                label="Nome fantasia"
                optional
                error={errors.tradeName}
              >
                <Input
                  id="client-trade-name"
                  value={formData.nome_fantasia}
                  placeholder="Como o cliente é conhecido"
                  maxLength={160}
                  aria-invalid={Boolean(errors.tradeName)}
                  className="h-11"
                  onChange={(event) =>
                    handleChange("nome_fantasia", event.target.value)
                  }
                  disabled={isBusy}
                />
              </FormField>
            )}
          </div>
        </div>
      </section>

      <section className="pdv-client-form__contact surface-panel overflow-hidden">
        <div className="flex items-start gap-3 border-b bg-muted/20 px-4 py-4 sm:px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ContactRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Contato principal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe ao menos um canal quando estiver disponível.
            </p>
          </div>
        </div>
        <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          <FormField
            id="client-email"
            className="pdv-client-field--email"
            label="E-mail"
            optional
            error={errors.email}
          >
            <Input
              id="client-email"
              type="email"
              value={formData.email}
              placeholder="financeiro@cliente.com.br"
              autoComplete="email"
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              className="h-11"
              onChange={(event) => handleChange("email", event.target.value)}
              onBlur={reviewOnBlur}
              disabled={isBusy}
            />
          </FormField>
          <FormField
            id="client-phone"
            className="pdv-client-field--phone"
            label="Celular / WhatsApp 1"
            optional
            error={errors.phone}
          >
            <Input
              id="client-phone"
              value={formData.telefone}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              aria-invalid={Boolean(errors.phone)}
              className="h-11"
              onChange={(event) => handleChange("telefone", event.target.value)}
              onBlur={reviewOnBlur}
              disabled={isBusy}
            />
          </FormField>
          {tipoPessoa === "cnpj" && (
            <FormField
              id="client-contact"
              className="pdv-client-field--contact"
              label="Contato ou responsável"
              optional
              error={errors.contact}
            >
              <Input
                id="client-contact"
                value={formData.contato}
                placeholder="Nome de quem atende"
                maxLength={160}
                aria-invalid={Boolean(errors.contact)}
                className="h-11"
                onChange={(event) => handleChange("contato", event.target.value)}
                disabled={isBusy}
              />
            </FormField>
          )}
        </div>
      </section>

      {(isReviewPending || hasReviewError || currentCandidates.length > 0) && (
        <section
          className={cn(
            "pdv-client-form__message surface-panel border-l-4 p-4 sm:p-5",
            blockingConflict ? "border-l-destructive" : "border-l-amber-500",
          )}
          data-testid="duplicate-review"
          aria-live="polite"
        >
          {isReviewPending ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Revisando cadastros semelhantes...
            </div>
          ) : hasReviewError ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div>
                  <h3 className="font-semibold text-foreground">
                    A revisão não pôde ser concluída
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {errorMessage(reviewError)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runDuplicateReview(draft)}
              >
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    blockingConflict ? "text-destructive" : "text-amber-600",
                  )}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold text-foreground">
                    {blockingConflict
                      ? documentConflict ? "CPF/CNPJ já cadastrado" : "Nome e telefone já cadastrados"
                      : `${currentCandidates.length} cadastro${currentCandidates.length > 1 ? "s" : ""} semelhante${currentCandidates.length > 1 ? "s" : ""}`}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {blockingConflict
                      ? "Abra o cadastro existente para evitar históricos separados para o mesmo cliente."
                      : "Compare os dados abaixo antes de criar um novo cadastro."}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {currentCandidates.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="rounded-lg border bg-background p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate font-semibold text-foreground">
                            {candidate.name}
                          </h4>
                          <Badge variant="outline" className="bg-muted/30">
                            {candidate.classification === "industrial"
                              ? "Industrial"
                              : "Doméstico"}
                          </Badge>
                          {!candidate.active && (
                            <Badge variant="secondary">Arquivado</Badge>
                          )}
                        </div>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                          Coincidência:{" "}
                          {candidate.matches
                            .map(
                              (reason) =>
                                CLIENT_DUPLICATE_REASON_LABELS[reason],
                            )
                            .join(", ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {candidate.maskedDocument && (
                            <span>Documento {candidate.maskedDocument}</span>
                          )}
                          {candidate.maskedPhone && (
                            <span>Telefone {candidate.maskedPhone}</span>
                          )}
                          {candidate.maskedEmail && (
                            <span>{candidate.maskedEmail}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 shrink-0"
                        onClick={() => onOpenExistingClient(candidate.id)}
                        disabled={isPdvClientWorkspace && (!candidate.active || candidate.classification !== activeArea)}
                      >
                        Abrir cadastro
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              {!blockingConflict && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <Checkbox
                    id="duplicate-review-confirmation"
                    checked={reviewAcknowledged}
                    onCheckedChange={(checked) =>
                      setAcknowledgedReview(
                        checked === true ? currentReviewSignature : null,
                      )
                    }
                    className="mt-0.5 h-5 w-5"
                  />
                  <Label
                    htmlFor="duplicate-review-confirmation"
                    className="cursor-pointer text-sm leading-relaxed"
                  >
                    Revisei os cadastros semelhantes e confirmo que este é um
                    cliente diferente.
                  </Label>
                </div>
              )}
            </div>
          )}
        </section>
      )}
        </div>

      <details
        className="pdv-client-form__details surface-panel group overflow-hidden"
        open={isDetailsOpen}
        onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold text-foreground">
                {tipoPessoa === "cpf"
                  ? "Detalhes adicionais"
                  : "Detalhes fiscais e observações"}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Preenchimento opcional
              </span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-5 border-t p-4 sm:p-5">
          {tipoPessoa === "cnpj" && (
            <>
              <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">
              Regime tributário
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {TAX_REGIMES.map((regime) => (
                <Button
                  key={regime.value}
                  type="button"
                  variant={
                    regimeTributario === regime.value ? "default" : "outline"
                  }
                  className="h-11 min-w-0 whitespace-normal px-3 text-center leading-tight"
                  aria-pressed={regimeTributario === regime.value}
                  onClick={() => { setRegimeTributario(regime.value); setDraftDirty(true); }}
                  disabled={isBusy}
                >
                  {regime.label}
                </Button>
              ))}
            </div>
              </fieldset>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              id="client-state-registration"
              label="Inscrição estadual"
              optional
              error={errors.stateRegistration}
            >
              <Input
                id="client-state-registration"
                value={formData.inscricao_estadual}
                placeholder="Número ou ISENTO"
                maxLength={40}
                aria-invalid={Boolean(errors.stateRegistration)}
                className="h-11"
                onChange={(event) =>
                  handleChange("inscricao_estadual", event.target.value)
                }
                disabled={isBusy}
              />
            </FormField>
            <FormField
              id="client-municipal-registration"
              label="Inscrição municipal"
              optional
              error={errors.municipalRegistration}
            >
              <Input
                id="client-municipal-registration"
                value={formData.inscricao_municipal}
                placeholder="Número da inscrição"
                maxLength={40}
                aria-invalid={Boolean(errors.municipalRegistration)}
                className="h-11"
                onChange={(event) =>
                  handleChange("inscricao_municipal", event.target.value)
                }
                disabled={isBusy}
              />
            </FormField>
              </div>
            </>
          )}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <FormField
              id="client-secondary-phone"
              label="Celular / WhatsApp 2"
              optional
              error={errors.secondaryPhone}
            >
              <Input
                id="client-secondary-phone"
                value={formData.telefone2}
                placeholder="(11) 3333-4444"
                inputMode="tel"
                maxLength={20}
                aria-invalid={Boolean(errors.secondaryPhone)}
                className="h-11"
                onChange={(event) =>
                  handleChange("telefone2", event.target.value)
                }
                onBlur={reviewOnBlur}
                disabled={isBusy}
              />
            </FormField>
          </div>
          <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-3">Quando os dois números estiverem preenchidos, os avisos de entrada e disponibilidade do ROL serão enviados para ambos.</p>
          <FormField
            id="client-notes"
            label="Observações"
            optional
            error={errors.notes}
          >
            <Textarea
              id="client-notes"
              value={formData.observacoes}
              placeholder="Informações úteis para atendimento, retirada ou faturamento"
              rows={4}
              maxLength={4_000}
              aria-invalid={Boolean(errors.notes)}
              onChange={(event) =>
                handleChange("observacoes", event.target.value)
              }
              disabled={isBusy}
            />
          </FormField>
        </div>
      </details>
      </div>

      {saveIdentity.isError && (
        <Alert variant="destructive" className="pdv-client-form__message">
          <CircleAlert className="h-4 w-4" />
          <AlertTitle>O cliente não foi salvo</AlertTitle>
          <AlertDescription className="mt-1">
            {errorMessage(saveIdentity.error)}. Os dados foram mantidos para
            você corrigir ou tentar novamente.
          </AlertDescription>
        </Alert>
      )}

      <footer className="pdv-client-form__footer surface-panel flex flex-col-reverse gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <p className="text-center text-xs text-muted-foreground sm:text-left">
          {clienteId
            ? "As alterações afetam somente este cadastro."
            : "Endereço e demais configurações vêm nas próximas etapas."}
        </p>
        <div className="grid gap-2 sm:flex sm:justify-end">
          {draftDirty && (
            <Button type="button" variant="ghost" className="h-11" onClick={discardDraft} disabled={isBusy}>
              Descartar rascunho
            </Button>
          )}
          <Button
            type="submit"
            variant="outline"
            className="h-11 sm:min-w-40"
            disabled={isBusy || blockingConflict}
          >
            {saveIdentity.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {clienteId ? "Salvar alterações" : "Salvar cliente"}
          </Button>
          <Button
            type="button"
            className="h-11 sm:min-w-44"
            onClick={() => void handleSave(true)}
            disabled={isBusy || blockingConflict}
          >
            Salvar e continuar
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </footer>
    </form>
  );
};
