import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clipboard, Loader2, QrCode, RefreshCw, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCancelPdvPix, useCreatePdvPix, usePdvPixStatus } from "@/hooks/usePdvPayments";
import type { PdvPaymentMoment, PdvPixPayment } from "@/lib/pdvPayment";
import { isPixConfirmed, isPixTerminal } from "@/lib/pdvPayment";

interface PixPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  amount: number;
  cashRegisterId: string;
  moment: PdvPaymentMoment;
  idempotencyKey: string;
  initialPix?: PdvPixPayment | null;
  initialError?: string | null;
  onFinished: (confirmed: boolean) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

export function PixPagamentoModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  amount,
  cashRegisterId,
  moment,
  idempotencyKey,
  initialPix,
  initialError,
  onFinished,
}: PixPagamentoModalProps) {
  const [pix, setPix] = useState<PdvPixPayment | null>(initialPix ?? null);
  const [message, setMessage] = useState<string | null>(initialError ?? null);
  const completionReported = useRef(false);
  const createPix = useCreatePdvPix();
  const getStatus = usePdvPixStatus();
  const cancelPix = useCancelPdvPix();

  useEffect(() => {
    if (!open) return;
    setPix(initialPix ?? null);
    setMessage(initialError ?? null);
    completionReported.current = false;
  }, [open, initialPix, initialError]);

  const generate = async () => {
    setMessage(null);
    try {
      const created = await createPix.mutateAsync({
        orderId,
        cashRegisterId,
        moment,
        idempotencyKey,
      });
      setPix(created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o PIX");
    }
  };

  useEffect(() => {
    if (!open || pix || createPix.isPending) return;
    void generate();
    // A geração é deliberadamente executada uma vez por abertura/identificador.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idempotencyKey]);

  useEffect(() => {
    if (!open || !pix?.paymentId || isPixTerminal(pix.paymentStatus)) return;
    const interval = window.setInterval(async () => {
      if (getStatus.isPending) return;
      try {
        const status = await getStatus.mutateAsync(pix.paymentId);
        const paymentStatus = String(status.paymentStatus ?? pix.paymentStatus);
        const providerStatus = status.providerStatus ? String(status.providerStatus) : pix.providerStatus;
        setPix((current) => current ? { ...current, paymentStatus, providerStatus } : current);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Não foi possível consultar o PIX");
      }
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [open, pix?.paymentId, pix?.paymentStatus, pix?.providerStatus, getStatus]);

  useEffect(() => {
    if (!isPixConfirmed(pix?.paymentStatus) || completionReported.current) return;
    completionReported.current = true;
    toast.success("PIX confirmado pelo provedor e registrado no caixa");
    onFinished(true);
  }, [pix?.paymentStatus, onFinished]);

  const copyCode = async () => {
    if (!pix?.copyPaste) return;
    await navigator.clipboard.writeText(pix.copyPaste);
    toast.success("PIX Copia e Cola copiado");
  };

  const cancel = async () => {
    if (!pix?.paymentId) return;
    try {
      await cancelPix.mutateAsync(pix.paymentId);
      toast.success("Cobrança PIX cancelada; a OS permanece pendente");
      onFinished(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar o PIX");
    }
  };

  const closeAsPending = () => {
    if (!completionReported.current) onFinished(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => next ? onOpenChange(true) : closeAsPending()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            PIX da OS {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">Valor exato da cobrança</p>
            <p className="text-3xl font-black text-primary">{formatCurrency(pix?.amount ?? amount)}</p>
          </div>

          {(createPix.isPending || (!pix && !message)) && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p>Gerando QR Code dinâmico…</p>
            </div>
          )}

          {pix?.copyPaste && !isPixTerminal(pix.paymentStatus) && (
            <>
              <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white p-4 shadow-sm">
                {pix.qrCode ? (
                  <img
                    src={`data:image/png;base64,${pix.qrCode}`}
                    alt={`QR Code PIX da OS ${orderNumber}`}
                    className="h-56 w-56"
                  />
                ) : (
                  <QRCodeSVG value={pix.copyPaste} size={224} level="M" />
                )}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={copyCode}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copiar PIX Copia e Cola
              </Button>
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Aguardando confirmação do banco</span>
                <Badge variant="secondary">{pix.providerStatus ?? "PENDING"}</Badge>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                A OS só será marcada como paga e lançada no caixa após a confirmação real do provedor.
              </p>
            </>
          )}

          {isPixConfirmed(pix?.paymentStatus) && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-6 text-success">
              <CheckCircle2 className="h-12 w-12" />
              <p className="font-bold">PIX confirmado</p>
            </div>
          )}

          {pix && isPixTerminal(pix.paymentStatus) && !isPixConfirmed(pix.paymentStatus) && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-destructive">
              <TriangleAlert className="h-10 w-10" />
              <p className="font-bold">Esta cobrança PIX não está mais ativa</p>
              <p className="text-center text-sm">
                Status: {pix.providerStatus ?? pix.paymentStatus}. Feche esta tela e gere uma nova cobrança para a OS.
              </p>
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
              {!pix && (
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={generate} disabled={createPix.isPending}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tentar gerar novamente
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {pix?.paymentId && !isPixTerminal(pix.paymentStatus) && (
            <Button type="button" variant="destructive" onClick={cancel} disabled={cancelPix.isPending}>
              {cancelPix.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancelar cobrança PIX
            </Button>
          )}
          <Button type="button" variant="outline" onClick={closeAsPending}>
            {pix && isPixTerminal(pix.paymentStatus) ? "Fechar" : "Concluir depois (manter pendente)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
