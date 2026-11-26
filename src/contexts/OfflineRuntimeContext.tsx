import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudUpload, Download, Loader2, Printer, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { createPdvSaleRequest } from "@/hooks/usePdvPayments";
import { cn } from "@/lib/utils";
import { refreshOfflinePdvPackage, type OfflinePdvPackageStatus } from "@/lib/offlinePdvBootstrap";
import {
  checkOfflineStorageAvailable,
  enqueueOfflinePdvSale,
  getOfflineDeviceId,
  listOfflinePdvQueue,
  pruneSyncedOfflinePdvQueue,
  resetInterruptedOfflineSync,
  updateOfflinePdvQueueItem,
  type OfflinePdvQueueItem,
  type OfflinePdvReceipt,
} from "@/lib/offlineStore";
import {
  classifyOfflineSyncFailure,
  isDatabaseStatementTimeout,
  isOfflineLikeError,
  isOfflineReferenceFresh,
  OFFLINE_REFERENCE_REFRESH_MS,
} from "@/lib/offlinePolicy";
import { subscribeOfflineQueryCache } from "@/lib/offlineQueryCache";
import { printOfflinePdvReceipt } from "@/lib/offlineReceipt";
import type { PdvSaleRequest } from "@/lib/pdvSale";
import { dispararNotificacaoAutomatica } from "@/services/notificacaoService";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface QueueSaleInput {
  request: PdvSaleRequest;
  receipt: OfflinePdvReceipt;
}

interface OfflineRuntimeContextValue {
  isOnline: boolean;
  backendAvailable: boolean | null;
  isOperationalOnline: boolean;
  storageAvailable: boolean;
  packageStatus: OfflinePdvPackageStatus | null;
  canQueueOffline: boolean;
  offlineBlockReason: string | null;
  queueItems: OfflinePdvQueueItem[];
  pendingCount: number;
  reviewCount: number;
  isSyncing: boolean;
  queueSale: (input: QueueSaleInput) => Promise<OfflinePdvQueueItem>;
  syncNow: () => Promise<void>;
  retryQueueItem: (id: string) => Promise<void>;
  refreshReferencePackage: (force?: boolean) => Promise<void>;
  reportBackendFailure: (error: unknown) => void;
  reportBackendSuccess: () => void;
  openQueue: () => void;
}

const OfflineRuntimeContext = createContext<OfflineRuntimeContextValue | null>(null);

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const STATUS_LABEL: Record<OfflinePdvQueueItem["status"], string> = {
  pending: "Aguardando sincronização",
  syncing: "Sincronizando",
  review: "Requer revisão",
  synced: "Sincronizado",
};

export function OfflineRuntimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { session, activeTenant } = useAuth();
  const { activeArea } = useWorkspace();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(() => navigator.onLine ? null : false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [packageStatus, setPackageStatus] = useState<OfflinePdvPackageStatus | null>(null);
  const [queueItems, setQueueItems] = useState<OfflinePdvQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const referencePromiseRef = useRef<Promise<void> | null>(null);

  const userId = session?.user.id ?? null;
  const tenantId = activeTenant?.id ?? null;
  const pdvArea = activeArea === "industrial" || activeArea === "residencial" ? activeArea : null;
  const isOperationalOnline = isOnline && backendAvailable !== false;

  const readPackageStatus = useCallback(() => {
    if (!userId || !tenantId || !pdvArea) {
      setPackageStatus(null);
      return null;
    }
    const status = queryClient.getQueryData<OfflinePdvPackageStatus>([
      "offline-pdv-package",
      userId,
      tenantId,
      pdvArea,
    ]) ?? null;
    setPackageStatus(status);
    return status;
  }, [pdvArea, queryClient, tenantId, userId]);

  const refreshQueue = useCallback(async () => {
    if (!userId || !tenantId) {
      setQueueItems([]);
      return [];
    }
    try {
      const items = await listOfflinePdvQueue(userId, tenantId);
      setQueueItems(items);
      return items;
    } catch (error) {
      setStorageAvailable(false);
      console.error("Não foi possível consultar a fila offline", error);
      return [];
    }
  }, [tenantId, userId]);

  const reportBackendFailure = useCallback((error: unknown) => {
    if (isOfflineLikeError(error)) setBackendAvailable(false);
  }, []);

  const reportBackendSuccess = useCallback(() => {
    if (navigator.onLine) setBackendAvailable(true);
  }, []);

  const refreshReferencePackage = useCallback(async (force = false) => {
    if (!navigator.onLine || !userId || !tenantId || !pdvArea) return;
    if (referencePromiseRef.current) return referencePromiseRef.current;
    const current = readPackageStatus();
    if (!force && current && Date.now() - Date.parse(current.generatedAt) < OFFLINE_REFERENCE_REFRESH_MS) return;

    const task = refreshOfflinePdvPackage({ queryClient, userId, tenantId, area: pdvArea })
      .then((status) => {
        setPackageStatus(status);
        setBackendAvailable(true);
      })
      .catch((error) => {
        if (navigator.onLine && isDatabaseStatementTimeout(error)) setBackendAvailable(true);
        else reportBackendFailure(error);
        console.warn("Não foi possível atualizar o pacote offline do PDV", error);
        if (force) toast.error(error instanceof Error ? error.message : "Não foi possível atualizar os dados offline");
      })
      .finally(() => {
        referencePromiseRef.current = null;
      });
    referencePromiseRef.current = task;
    return task;
  }, [pdvArea, queryClient, readPackageStatus, reportBackendFailure, tenantId, userId]);

  const syncNow = useCallback(async () => {
    if (syncPromiseRef.current) return syncPromiseRef.current;
    if (!navigator.onLine || !userId || !tenantId) return;

    const task = (async () => {
      setIsSyncing(true);
      let items = await refreshQueue();
      for (const item of items.filter((candidate) => candidate.status === "pending" || candidate.status === "syncing")) {
        await updateOfflinePdvQueueItem(item.id, { status: "syncing", incrementAttempts: true, lastError: null });
        await refreshQueue();
        try {
          const result = await createPdvSaleRequest(item.request);
          await updateOfflinePdvQueueItem(item.id, { status: "synced", result, lastError: null });
          setBackendAvailable(true);
          toast.success(`ROL ${result.order.number} sincronizado com sucesso.`);
          void dispararNotificacaoAutomatica(
            "rol_entrada",
            result.order.id,
            `rol:${result.order.id}:entrada`,
          );
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["ordens_servico"] }),
            queryClient.invalidateQueries({ queryKey: ["order-directory"] }),
            queryClient.invalidateQueries({ queryKey: ["consulta-os"] }),
            queryClient.invalidateQueries({ queryKey: ["lancamentos"] }),
            queryClient.invalidateQueries({ queryKey: ["faturas"] }),
            queryClient.invalidateQueries({ queryKey: ["pdv-capacity"] }),
          ]);
        } catch (error) {
          const failure = classifyOfflineSyncFailure(error);
          await updateOfflinePdvQueueItem(item.id, {
            status: failure.retryable ? "pending" : "review",
            lastError: failure.message,
          });
          if (failure.retryable) {
            setBackendAvailable(false);
            break;
          }
          toast.error(`O ROL ${item.receipt.localReference} precisa de revisão: ${failure.message}`);
        }
      }
      items = await refreshQueue();
      await pruneSyncedOfflinePdvQueue(userId, tenantId);
      if (items.some((item) => item.status === "review")) setQueueOpen(true);
      if (navigator.onLine) void refreshReferencePackage();
    })().finally(() => {
      setIsSyncing(false);
      syncPromiseRef.current = null;
    });

    syncPromiseRef.current = task;
    return task;
  }, [queryClient, refreshQueue, refreshReferencePackage, tenantId, userId]);

  const queueSale = useCallback(async ({ request, receipt }: QueueSaleInput) => {
    if (!userId || !tenantId || !pdvArea) throw new Error("Sessão, empresa e operação são obrigatórias para salvar offline");
    if (!storageAvailable) throw new Error("O armazenamento offline não está disponível neste navegador");
    if (!isOfflineReferenceFresh(packageStatus?.generatedAt)) {
      throw new Error("Os dados locais do PDV estão vencidos. Reconecte para atualizá-los antes de continuar.");
    }
    getOfflineDeviceId();
    const item = await enqueueOfflinePdvSale({ userId, tenantId, area: pdvArea, request, receipt });
    await refreshQueue();
    return item;
  }, [packageStatus?.generatedAt, pdvArea, refreshQueue, storageAvailable, tenantId, userId]);

  const retryQueueItem = useCallback(async (id: string) => {
    const item = queueItems.find((candidate) => candidate.id === id);
    if (!item || item.status !== "review") return;
    await updateOfflinePdvQueueItem(id, { status: "pending", lastError: null });
    await refreshQueue();
    if (navigator.onLine) void syncNow();
  }, [queueItems, refreshQueue, syncNow]);

  useEffect(() => {
    void checkOfflineStorageAvailable().then(setStorageAvailable);
    const online = () => {
      setIsOnline(true);
      setBackendAvailable(null);
    };
    const offline = () => {
      setIsOnline(false);
      setBackendAvailable(false);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeOfflineQueryCache(queryClient, userId);
  }, [queryClient, userId]);

  useEffect(() => {
    readPackageStatus();
  }, [readPackageStatus]);

  useEffect(() => {
    if (!userId || !tenantId) {
      setQueueItems([]);
      return;
    }
    void (async () => {
      await resetInterruptedOfflineSync(userId, tenantId);
      await pruneSyncedOfflinePdvQueue(userId, tenantId);
      await refreshQueue();
    })();
  }, [refreshQueue, tenantId, userId]);

  useEffect(() => {
    if (!isOnline || !userId || !tenantId || !pdvArea) return;
    void refreshReferencePackage();
    const timer = window.setInterval(() => void refreshReferencePackage(), OFFLINE_REFERENCE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOnline, pdvArea, refreshReferencePackage, tenantId, userId]);

  const pendingCount = queueItems.filter((item) => item.status === "pending" || item.status === "syncing").length;
  const reviewCount = queueItems.filter((item) => item.status === "review").length;

  useEffect(() => {
    if (!isOperationalOnline || pendingCount === 0 || isSyncing) return;
    const timer = window.setTimeout(() => void syncNow(), 800);
    return () => window.clearTimeout(timer);
  }, [isOperationalOnline, isSyncing, pendingCount, syncNow]);

  const canQueueOffline = Boolean(
    storageAvailable && userId && tenantId && pdvArea && isOfflineReferenceFresh(packageStatus?.generatedAt),
  );
  const offlineBlockReason = !storageAvailable
    ? "O navegador não liberou o armazenamento seguro necessário ao modo offline."
    : !packageStatus
      ? "Este PDV ainda não preparou os dados locais. Conecte-se e aguarde a atualização offline."
      : !isOfflineReferenceFresh(packageStatus.generatedAt)
        ? "Os dados locais do PDV venceram. Reconecte para atualizá-los antes de lançar novos ROLs."
        : null;

  const contextValue = useMemo<OfflineRuntimeContextValue>(() => ({
    isOnline,
    backendAvailable,
    isOperationalOnline,
    storageAvailable,
    packageStatus,
    canQueueOffline,
    offlineBlockReason,
    queueItems,
    pendingCount,
    reviewCount,
    isSyncing,
    queueSale,
    syncNow,
    retryQueueItem,
    refreshReferencePackage,
    reportBackendFailure,
    reportBackendSuccess,
    openQueue: () => setQueueOpen(true),
  }), [
    backendAvailable,
    canQueueOffline,
    isOnline,
    isOperationalOnline,
    isSyncing,
    offlineBlockReason,
    packageStatus,
    pendingCount,
    queueItems,
    queueSale,
    refreshReferencePackage,
    reportBackendFailure,
    reportBackendSuccess,
    reviewCount,
    retryQueueItem,
    storageAvailable,
    syncNow,
  ]);

  const showStatus = !isOperationalOnline || pendingCount > 0 || reviewCount > 0;

  return (
    <OfflineRuntimeContext.Provider value={contextValue}>
      {children}

      {showStatus && (
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          className={cn(
            "fixed bottom-3 left-1/2 z-[90] flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-2xl backdrop-blur",
            reviewCount > 0
              ? "border-red-300 bg-red-700 text-white"
              : !isOperationalOnline
                ? "border-amber-300 bg-amber-600 text-white"
                : "border-blue-300 bg-blue-700 text-white",
          )}
          aria-label="Abrir Central de sincronização"
        >
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : !isOperationalOnline ? <WifiOff className="h-4 w-4" /> : <CloudUpload className="h-4 w-4" />}
          <span className="truncate">
            {reviewCount > 0
              ? `${reviewCount} ROL${reviewCount > 1 ? "s" : ""} requer${reviewCount === 1 ? "" : "em"} revisão`
              : !isOperationalOnline
                ? `Modo offline${pendingCount ? ` · ${pendingCount} pendente${pendingCount > 1 ? "s" : ""}` : ""}`
                : isSyncing
                  ? "Sincronizando ROLs pendentes…"
                  : `${pendingCount} ROL${pendingCount > 1 ? "s" : ""} aguardando envio`}
          </span>
        </button>
      )}

      <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Central de sincronização do PDV</DialogTitle>
            <DialogDescription>
              ROLs offline ficam criptografados neste computador e são enviados na ordem em que foram criados.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Conexão</p><p className="flex items-center gap-2 font-bold">{isOperationalOnline ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}{isOperationalOnline ? "Online" : "Offline ou instável"}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Pendentes</p><p className="font-bold">{pendingCount}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Dados locais</p><p className="font-bold">{packageStatus ? formatDateTime(packageStatus.generatedAt) : "Não preparados"}</p></div>
          </div>

          {!storageAvailable && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">O armazenamento offline está indisponível neste navegador. Não feche a página durante uma queda de conexão.</p>}

          <div className="space-y-3">
            {queueItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum ROL está aguardando sincronização neste computador.</div>
            ) : queueItems.map((item) => (
              <article key={item.id} className={cn("rounded-xl border p-4", item.status === "review" && "border-red-300 bg-red-50/60 dark:bg-red-950/20")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.receipt.localReference} · {item.receipt.clientName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)} · {item.receipt.items.length} item(ns) · {formatMoney(item.receipt.total)}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-bold",
                    item.status === "synced" ? "bg-emerald-100 text-emerald-800" : item.status === "review" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800",
                  )}>{STATUS_LABEL[item.status]}</span>
                </div>
                {item.result?.order.number && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Número oficial: {item.result.order.number}</p>}
                {item.lastError && <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{item.lastError}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void printOfflinePdvReceipt(item.receipt)}><Printer className="mr-2 h-4 w-4" /> Imprimir provisório</Button>
                  {item.status === "review" && <Button type="button" size="sm" variant="outline" disabled={!isOnline} onClick={() => void retryQueueItem(item.id)}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>}
                </div>
              </article>
            ))}
          </div>

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {installPrompt && (
                <Button type="button" variant="outline" onClick={() => void (async () => {
                  await installPrompt.prompt();
                  const choice = await installPrompt.userChoice;
                  if (choice.outcome === "accepted") setInstallPrompt(null);
                })()}><Download className="mr-2 h-4 w-4" /> Instalar neste computador</Button>
              )}
              <Button type="button" variant="outline" disabled={!isOnline} onClick={() => void refreshReferencePackage(true)}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar dados locais</Button>
            </div>
            <Button type="button" disabled={!isOnline || pendingCount === 0 || isSyncing} onClick={() => void syncNow()}>{isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudUpload className="mr-2 h-4 w-4" />}Sincronizar agora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OfflineRuntimeContext.Provider>
  );
}

export function useOfflineRuntime(): OfflineRuntimeContextValue {
  const context = useContext(OfflineRuntimeContext);
  if (!context) throw new Error("useOfflineRuntime deve ser usado dentro de OfflineRuntimeProvider");
  return context;
}
