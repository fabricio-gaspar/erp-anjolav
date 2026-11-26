import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, QrCode, RefreshCw, Smartphone, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type RolMessage = {
  id: string;
  telefone: string;
  evento: string;
  status: string;
  last_error_code: string | null;
  created_at: string;
  ordem: { numero: string; operation_type: string } | null;
};

const messageStatuses: Record<string, string> = {
  pendente: "Pendente", processando: "Em envio", enviado: "Enviado ao provedor",
  entregue: "Entregue", lido: "Lido", falhou: "Falhou",
  incerto: "Resultado incerto", dead_letter: "Requer atenção",
};
const messageEvents: Record<string, string> = {
  rol_entrada: "Entrada", rol_pronto_retirada: "Disponibilidade para retirada",
  rol_pronto_delivery: "Disponibilidade para entrega",
};

interface PdvWhatsAppDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GatewayResponse = {
  connected?: boolean;
  status?: string;
  qr_code?: string | null;
  error?: string;
};

function gatewayError(error: unknown, data: GatewayResponse | null, fallback: string) {
  if (typeof data?.error === "string" && data.error.trim()) return new Error(data.error);
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function PdvWhatsAppDeviceModal({ open, onOpenChange }: PdvWhatsAppDeviceModalProps) {
  const { activeTenant, user } = useAuth();
  const { activeArea } = useWorkspace();
  const operation = activeArea === "industrial" ? "industrial" : activeArea === "residencial" ? "domestico" : null;
  const history = useQuery({
    queryKey: ["pdv-whatsapp-history", user?.id, activeTenant?.id, operation],
    enabled: open && Boolean(user?.id && activeTenant?.id && operation),
    refetchOnMount: "always",
    refetchInterval: open ? 30000 : false,
    queryFn: async (): Promise<RolMessage[]> => {
      const { data, error } = await (supabase as unknown as SupabaseClient)
        .from("mensagens_log")
        .select("id,telefone,evento,status,last_error_code,created_at,ordem:ordens_servico!mensagens_log_ordem_servico_id_fkey!inner(numero,operation_type)")
        .eq("tenant_id", activeTenant!.id)
        .in("canal", ["wa-akg", "whatsapp"])
        .in("evento", Object.keys(messageEvents))
        .eq("ordem.operation_type", operation!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as RolMessage[];
    },
  });
  const [connected, setConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState("desconectado");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const invokeGateway = useCallback(async (action: "connect" | "status") => {
    const { data, error } = await supabase.functions.invoke("whatsapp-gateway", {
      body: { action },
    });
    const payload = (data ?? null) as GatewayResponse | null;
    if (error || payload?.error) throw gatewayError(error, payload, "Não foi possível acessar o WhatsApp");
    return payload ?? {};
  }, []);

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await invokeGateway("status");
      const isConnected = data.connected === true;
      setConnected(isConnected);
      setStatus(data.status ?? (isConnected ? "conectado" : "desconectado"));
      setQrCode(isConnected ? null : data.qr_code ?? null);
    } catch (error) {
      setConnected(null);
      setStatus("erro");
      setQrCode(null);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível consultar o dispositivo");
    } finally {
      setIsLoading(false);
    }
  }, [invokeGateway]);

  const connectDevice = useCallback(async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const data = await invokeGateway("connect");
      const isConnected = data.connected === true;
      setConnected(isConnected);
      setStatus(data.status ?? (isConnected ? "conectado" : "aguardando_scan"));
      setQrCode(isConnected ? null : data.qr_code ?? null);
      toast.success(isConnected ? "WhatsApp já está vinculado." : "QR Code gerado. Escaneie com o celular.");
    } catch (error) {
      setConnected(null);
      setStatus("erro");
      setQrCode(null);
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível gerar o QR Code");
    } finally {
      setIsConnecting(false);
    }
  }, [invokeGateway]);

  useEffect(() => {
    if (!open) return;
    setConnected(null);
    setStatus("consultando");
    setQrCode(null);
    void refreshStatus();
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open || connected || !qrCode) return;
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [connected, open, qrCode, refreshStatus]);

  const statusLabel = connected === true
    ? "Vinculado"
    : qrCode
      ? "Aguardando leitura"
      : connected === null
        ? errorMessage ? "Erro" : "Consultando"
        : "Desconectado";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pdv-compact-dialog pdv-whatsapp-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            WhatsApp
          </DialogTitle>
          <DialogDescription>
            Conecte o WhatsApp para enviar os avisos do ROL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              {connected === true ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
              <div>
                <span className="block text-sm font-medium">Estado do dispositivo</span>
                <span className="block text-xs text-muted-foreground">Estado técnico: {status}</span>
              </div>
            </div>
            <Badge variant={connected === true ? "default" : qrCode ? "secondary" : errorMessage ? "destructive" : "outline"}>
              {statusLabel}
            </Badge>
          </div>

          {connected === true ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
              Pronto para enviar avisos de entrada e disponibilidade.
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/20 p-4 text-center">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt="QR Code para vincular o WhatsApp"
                  className="h-64 w-64"
                />
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4" />
                Escaneie este QR Code com o WhatsApp do celular
              </div>
              <p className="max-w-sm text-xs text-muted-foreground">
                No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho e aponte a câmera para a tela.
                O sistema verifica automaticamente quando a vinculação terminar.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Gere um QR Code e escaneie com o WhatsApp do celular.
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {errorMessage}
            </div>
          )}

          <section aria-labelledby="pdv-whatsapp-history-title" className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="pdv-whatsapp-history-title" className="text-sm font-semibold">Histórico de avisos</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => void history.refetch()} disabled={history.isFetching}>
                <RefreshCw className={history.isFetching ? "mr-1 h-4 w-4 animate-spin" : "mr-1 h-4 w-4"} />Atualizar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Últimos 50 avisos deste setor. Enviado indica aceitação pelo provedor; entrega e leitura dependem de confirmação.</p>
            {history.isLoading ? (
              <p className="py-3 text-sm text-muted-foreground">Carregando histórico…</p>
            ) : history.isError ? (
              <p role="alert" className="py-3 text-sm text-destructive">Não foi possível carregar o histórico. Confira sua conexão ou permissão e tente atualizar.</p>
            ) : !history.data?.length ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhum aviso registrado neste setor.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="Avisos recentes">
                {history.data.map((message) => (
                  <div key={message.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>ROL {message.ordem?.numero || "indisponível"}</strong>
                      <Badge variant={message.status === "falhou" || message.status === "dead_letter" ? "destructive" : "outline"}>
                        {messageStatuses[message.status] ?? message.status}
                      </Badge>
                    </div>
                    <p className="mt-1">{messageEvents[message.evento] ?? message.evento} · {message.telefone || "Telefone indisponível"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString("pt-BR")}</p>
                    {message.status === "incerto" && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Confira o WhatsApp antes de reenviar para evitar duplicidade.</p>}
                    {message.last_error_code && message.status !== "incerto" && <p className="mt-1 text-xs text-destructive">Motivo: {message.last_error_code}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter data-pdv-dialog-footer className="flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => void refreshStatus()} disabled={isLoading || isConnecting}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar status
          </Button>
          {connected !== true && (
            <Button type="button" onClick={() => void connectDevice()} disabled={isConnecting || isLoading}>
              {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
              {qrCode ? "Gerar novo QR Code" : "Vincular dispositivo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
