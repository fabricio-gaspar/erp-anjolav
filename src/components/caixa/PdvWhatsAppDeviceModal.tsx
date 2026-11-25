import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, QrCode, RefreshCw, Smartphone, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

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
