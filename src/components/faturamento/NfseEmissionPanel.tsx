import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileCode2, FileText, Loader2, Receipt, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfiguracoesFiscaisOperacionais } from "@/hooks/useConfiguracoesFiscais";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCnpj,
  nfseStatusLabel,
  selectFiscalEmitter,
  type FiscalOperation,
} from "@/lib/nfsePolicy";
import { openExternalHttpsUrl } from "@/lib/safePrint";
import { NATUREZAS_OPERACAO } from "@/lib/validacoesFiscais";

interface NfseEmitterHealth {
  id: string;
  nome: string;
  cnpjFinal: string;
  ambiente: string;
  operationType: FiscalOperation | null;
  credencialStatus: string;
  ready: boolean;
  issues: string[];
}

interface NfseDocument {
  id?: string;
  faturaId?: string;
  status?: string;
  ambiente?: string;
  numero?: string | null;
  chaveAcesso?: string | null;
  protocolo?: string | null;
  tentativas?: number;
  autorizadoEm?: string | null;
  canceladoEm?: string | null;
  erros?: string[];
  emitente?: {
    id?: string;
    nome?: string;
    razaoSocial?: string | null;
    cnpjFinal?: string;
    ambiente?: string;
    operationType?: FiscalOperation | null;
    credencialStatus?: string;
  };
}

interface NfseResponse {
  success?: boolean;
  enabled?: boolean;
  ready?: boolean;
  productionEnabled?: boolean;
  emitters?: NfseEmitterHealth[];
  document?: NfseDocument;
  readiness?: {
    ready?: boolean;
    issues?: string[];
    environment?: string;
    mode?: string;
    credentialStatus?: string;
  };
  xmlUrl?: string;
  danfseUrl?: string;
  error?: string;
  issues?: string[];
}

interface NfseEmissionPanelProps {
  faturaId: string;
  configuracaoFiscalId?: string | null;
  preferredEmitterId?: string | null;
  operationType?: FiscalOperation | null;
  nfseStatus?: string | null;
  descricaoServico?: string;
  naturezaOperacao?: string;
  onEmitterChange?: (id: string) => void;
  onChanged?: () => void | Promise<void>;
}

function asResponse(value: unknown): NfseResponse {
  return value && typeof value === "object" && !Array.isArray(value) ? value as NfseResponse : {};
}

async function edgeErrorMessage(error: unknown): Promise<string> {
  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = asResponse(await context.clone().json());
        if (payload.error) return payload.error;
        if (payload.issues?.length) return payload.issues.join(" ");
      } catch {
        // Mantém a mensagem padrão do cliente quando a resposta não for JSON.
      }
    }
  }
  return error instanceof Error && error.message ? error.message : "O serviço fiscal não respondeu.";
}

async function invokeNfse(body: Record<string, unknown>): Promise<NfseResponse> {
  const { data, error } = await supabase.functions.invoke("nfse-adapter", { body });
  if (error) throw new Error(await edgeErrorMessage(error));
  const response = asResponse(data);
  if (response.error) throw new Error(response.error);
  return response;
}

export function NfseEmissionPanel({
  faturaId,
  configuracaoFiscalId,
  preferredEmitterId,
  operationType,
  nfseStatus,
  descricaoServico,
  naturezaOperacao,
  onEmitterChange,
  onChanged,
}: NfseEmissionPanelProps) {
  const { configuracoes, isLoading: loadingEmitters, error: emittersError } = useConfiguracoesFiscaisOperacionais();
  const activeEmitters = useMemo(() => configuracoes.filter((config) => config.ativo), [configuracoes]);
  const automaticSelection = useMemo(
    () => selectFiscalEmitter(activeEmitters, configuracaoFiscalId || preferredEmitterId, operationType),
    [activeEmitters, configuracaoFiscalId, preferredEmitterId, operationType],
  );
  const [selectedEmitterId, setSelectedEmitterId] = useState("");
  const [health, setHealth] = useState<NfseResponse | null>(null);
  const [document, setDocument] = useState<NfseDocument | null>(null);
  const [readinessIssues, setReadinessIssues] = useState<string[]>([]);
  const [danfseUrl, setDanfseUrl] = useState<string | null>(null);
  const [xmlUrl, setXmlUrl] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<"health" | "prepare" | "issue" | "query" | "cancel" | null>(null);
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [localNatureza, setLocalNatureza] = useState("");
  const [localDescricao, setLocalDescricao] = useState("");
  const naturezaSelecionada = naturezaOperacao ?? localNatureza;
  const descricaoSelecionada = descricaoServico ?? localDescricao;

  useEffect(() => {
    setSelectedEmitterId(configuracaoFiscalId || automaticSelection.emitter?.id || "");
  }, [faturaId, configuracaoFiscalId, automaticSelection.emitter?.id]);

  const selectedEmitter = activeEmitters.find((emitter) => emitter.id === selectedEmitterId) || null;
  const emitterHealth = health?.emitters?.find((emitter) => emitter.id === selectedEmitterId) || null;
  const status = document?.status || nfseStatus || "nao_preparada";
  const authorized = status === "autorizada";
  const cancelled = status === "cancelada";
  const uncertain = status === "processando" || status === "erro_temporario";

  const runHealth = async () => {
    setWorkingAction("health");
    try {
      const result = await invokeNfse({
        action: "health",
        configuracaoFiscalId: selectedEmitterId || undefined,
      });
      setHealth(result);
      const selected = result.emitters?.find((emitter) => emitter.id === selectedEmitterId);
      setReadinessIssues(selected?.issues || []);
    } catch (error) {
      setHealth(null);
      setReadinessIssues([error instanceof Error ? error.message : "Não foi possível validar o ambiente fiscal."]);
    } finally {
      setWorkingAction(null);
    }
  };

  const queryDocument = async (silent = false, reconcile = false) => {
    setWorkingAction("query");
    try {
      const result = await invokeNfse({ action: "query", faturaId, reconcile });
      setDocument(result.document || null);
      setReadinessIssues(result.readiness?.issues || result.document?.erros || []);
      setDanfseUrl(result.danfseUrl || null);
      setXmlUrl(result.xmlUrl || null);
      if (reconcile && result.document?.status === "autorizada") toast.success("Resultado oficial confirmado e registrado.");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Não foi possível consultar a NFS-e.");
    } finally {
      setWorkingAction(null);
    }
  };

  useEffect(() => {
    if (!selectedEmitterId) return;
    void runHealth();
    // A validação precisa acompanhar o CNPJ selecionado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmitterId]);

  useEffect(() => {
    if (nfseStatus && nfseStatus !== "nao_preparada") void queryDocument(true);
    // A consulta ocorre uma vez ao abrir cada fatura já preparada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturaId]);

  const prepare = async () => {
    if (!naturezaSelecionada || !descricaoSelecionada.trim()) {
      toast.error("Informe a natureza e a descrição do serviço antes de validar.");
      return;
    }
    if (!selectedEmitterId) {
      toast.error(automaticSelection.issue || "Selecione o CNPJ emissor.");
      return;
    }
    setWorkingAction("prepare");
    try {
      const result = await invokeNfse({
        action: "prepare",
        faturaId,
        configuracaoFiscalId: selectedEmitterId,
        descricaoServico: descricaoSelecionada,
        naturezaOperacao: naturezaSelecionada,
      });
      setDocument(result.document || null);
      setReadinessIssues(result.readiness?.issues || []);
      await onChanged?.();
      if (result.readiness?.ready) toast.success("Dados fiscais validados. A nota está pronta para confirmação.");
      else toast.warning("Dados preparados, mas a emissão permanece bloqueada até concluir a configuração indicada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar a NFS-e.");
    } finally {
      setWorkingAction(null);
    }
  };

  const issue = async () => {
    setConfirmIssue(false);
    setWorkingAction("issue");
    try {
      const result = await invokeNfse({
        action: "issue",
        faturaId,
        configuracaoFiscalId: selectedEmitterId,
        descricaoServico: descricaoSelecionada,
        naturezaOperacao: naturezaSelecionada,
        confirmation: "EMITIR_NFSE",
      });
      setDanfseUrl(result.danfseUrl || null);
      setXmlUrl(result.xmlUrl || null);
      toast.success("NFS-e autorizada pelo provedor fiscal.");
      await queryDocument(true);
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A NFS-e não foi autorizada.");
      await queryDocument(true);
    } finally {
      setWorkingAction(null);
    }
  };

  const cancel = async () => {
    if (cancelReason.trim().length < 15) {
      toast.error("Informe uma justificativa com pelo menos 15 caracteres.");
      return;
    }
    setConfirmCancel(false);
    setWorkingAction("cancel");
    try {
      await invokeNfse({
        action: "cancel",
        faturaId,
        motivo: cancelReason.trim(),
        confirmation: "CANCELAR_NFSE",
      });
      toast.success("Cancelamento confirmado pelo provedor fiscal.");
      setCancelReason("");
      await queryDocument(true);
      await onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "O cancelamento não foi confirmado.");
    } finally {
      setWorkingAction(null);
    }
  };

  if (loadingEmitters) {
    return <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando emitentes...</div>;
  }

  if (emittersError) {
    return <p role="alert" className="text-sm text-destructive">Não foi possível consultar os CNPJs emissores.</p>;
  }

  if (activeEmitters.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Nenhum CNPJ emissor ativo</div>
        <p>Cadastre os dois emitentes em Configurações &gt; Fiscal. A nota continuará bloqueada até cada credencial ser homologada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /><h3 className="font-semibold">NFS-e Nacional</h3></div>
        <Badge variant={authorized ? "default" : cancelled ? "destructive" : "secondary"}>{nfseStatusLabel(status)}</Badge>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`nfse-emitter-${faturaId}`}>CNPJ emissor</Label>
        <Select
          value={selectedEmitterId || "none"}
          disabled={authorized || cancelled || workingAction === "issue" || workingAction === "cancel"}
          onValueChange={(value) => {
            setSelectedEmitterId(value === "none" ? "" : value);
            onEmitterChange?.(value === "none" ? "" : value);
            setDocument(null);
            setReadinessIssues([]);
          }}
        >
          <SelectTrigger id={`nfse-emitter-${faturaId}`}><SelectValue placeholder="Selecione o emitente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Selecione o CNPJ</SelectItem>
            {activeEmitters.map((emitter) => (
              <SelectItem key={emitter.id} value={emitter.id}>
                {emitter.nome} · {formatCnpj(emitter.cnpj)}
                {emitter.operation_type === "domestico" ? " · doméstico" : emitter.operation_type === "industrial" ? " · industrial" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!selectedEmitterId && automaticSelection.issue && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{automaticSelection.issue}</p>}
        {selectedEmitter && <p className="text-xs text-muted-foreground">Ambiente: {selectedEmitter.ambiente === "producao" ? "Produção" : "Homologação"} · credencial: {selectedEmitter.credencial_status.replace(/_/g, " ")}</p>}
      </div>

      {!authorized && !cancelled && naturezaOperacao === undefined && <div className="space-y-2"><Label>Natureza da operação *</Label><Select value={localNatureza} onValueChange={setLocalNatureza}><SelectTrigger><SelectValue placeholder="Selecione a natureza" /></SelectTrigger><SelectContent>{NATUREZAS_OPERACAO.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>}
      {!authorized && !cancelled && descricaoServico === undefined && <div className="space-y-2"><Label htmlFor={`nfse-description-${faturaId}`}>Descrição do serviço *</Label><Textarea id={`nfse-description-${faturaId}`} value={localDescricao} onChange={(event) => setLocalDescricao(event.target.value)} maxLength={2000} /></div>}

      {workingAction === "health" ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Validando o ambiente fiscal...</p>
      ) : emitterHealth?.ready ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" />Configuração fiscal preenchida; a conexão será confirmada na operação.</p>
      ) : selectedEmitterId ? (
        <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" />A emissão ainda não está liberada para este CNPJ.</p>
      ) : null}

      {readinessIssues.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="mb-1 font-semibold">Pendências para emissão</p>
          <ul className="list-disc space-y-1 pl-4">{[...new Set(readinessIssues)].map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>
      )}

      {document?.numero && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p><strong>Número:</strong> {document.numero}</p>
          {document.protocolo && <p><strong>Protocolo:</strong> {document.protocolo}</p>}
          {document.emitente?.cnpjFinal && <p><strong>CNPJ emissor:</strong> final {document.emitente.cnpjFinal}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!authorized && !cancelled && !uncertain && (
          <Button variant="outline" size="sm" disabled={!selectedEmitterId || workingAction !== null} onClick={() => void prepare()}>
            {workingAction === "prepare" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Validar dados fiscais
          </Button>
        )}
        {!authorized && !cancelled && !uncertain && (
          <Button size="sm" disabled={!document || !emitterHealth?.ready || workingAction !== null} onClick={() => setConfirmIssue(true)}>
            <Receipt className="mr-2 h-4 w-4" />Emitir NFS-e
          </Button>
        )}
        {(document || (nfseStatus && nfseStatus !== "nao_preparada")) && (
          <Button variant="outline" size="sm" disabled={workingAction !== null} onClick={() => void queryDocument()}>
            {workingAction === "query" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}Atualizar status
          </Button>
        )}
        {uncertain && <Button variant="outline" size="sm" disabled={workingAction !== null} onClick={() => void queryDocument(false, true)}><RotateCcw className="mr-2 h-4 w-4" />Consultar resultado oficial</Button>}
        {danfseUrl && <Button variant="outline" size="sm" onClick={() => openExternalHttpsUrl(danfseUrl)}><FileText className="mr-2 h-4 w-4" />DANFSe <ExternalLink className="ml-1 h-3 w-3" /></Button>}
        {xmlUrl && <Button variant="outline" size="sm" onClick={() => openExternalHttpsUrl(xmlUrl)}><FileCode2 className="mr-2 h-4 w-4" />XML <ExternalLink className="ml-1 h-3 w-3" /></Button>}
        {authorized && <Button variant="destructive" size="sm" disabled={workingAction !== null} onClick={() => setConfirmCancel(true)}><XCircle className="mr-2 h-4 w-4" />Cancelar NFS-e</Button>}
      </div>

      <p className="text-xs text-muted-foreground">A emissão exige confirmação manual. Documentos de homologação não têm validade fiscal e permanecem identificados pelo ambiente.</p>

      <AlertDialog open={confirmIssue} onOpenChange={setConfirmIssue}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar emissão da NFS-e?</AlertDialogTitle>
            <AlertDialogDescription>
              A nota será enviada pelo CNPJ {formatCnpj(selectedEmitter?.cnpj)} no ambiente {selectedEmitter?.ambiente === "producao" ? "de PRODUÇÃO" : "de homologação"}. Confira cliente, período, itens e valor antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void issue(); }}>Confirmar emissão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar a NFS-e autorizada?</AlertDialogTitle>
            <AlertDialogDescription>O pedido será enviado ao provedor fiscal e ficará registrado na auditoria. Esta ação exige perfil administrador.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2"><Label htmlFor={`nfse-cancel-${faturaId}`}>Justificativa *</Label><Textarea id={`nfse-cancel-${faturaId}`} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Informe o motivo fiscal do cancelamento (mínimo 15 caracteres)." maxLength={255} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={cancelReason.trim().length < 15} onClick={(event) => { event.preventDefault(); void cancel(); }}>Confirmar cancelamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

