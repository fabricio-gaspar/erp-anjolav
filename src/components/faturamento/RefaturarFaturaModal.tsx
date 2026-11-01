import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, FileClock, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  criarChaveOperacaoFatura,
  useFaturas,
  usePreviaRefaturamentoFatura,
  type Fatura,
  type PreviaRefaturamentoOrigem,
} from "@/hooks/useFaturas";

interface RefaturarFaturaModalProps {
  fatura: Fatura | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
}).format(value);

const parseSignedValue = (rawValue: string) => {
  const compact = rawValue.trim().replace(/\s|R\$/gi, "");
  if (!compact) return 0;
  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  const normalized = commaIndex > dotIndex
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(/,/g, "");
  return Number(normalized);
};

const isMonetaryValue = (value: number) => Number.isFinite(value)
  && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

const getOriginAdjustmentError = (origin: PreviaRefaturamentoOrigem, rawValue: string) => {
  if (!rawValue.trim()) return null;
  const value = parseSignedValue(rawValue);
  if (!isMonetaryValue(value)) return "Use um valor monetário com até 2 casas decimais.";
  if (value === 0) return null;
  if (Number(origin.valor) + value < 0) return "O desconto não pode deixar o ROL com valor negativo.";
  return null;
};

export function RefaturarFaturaModal({
  fatura,
  open,
  onOpenChange,
}: RefaturarFaturaModalProps) {
  const preview = usePreviaRefaturamentoFatura(fatura?.id ?? null, open);
  const { refaturarFatura } = useFaturas(undefined, undefined, false);
  const idempotencyKey = useRef(criarChaveOperacaoFatura("invoice-rebill"));
  const [motivo, setMotivo] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setAdjustments({});
    idempotencyKey.current = criarChaveOperacaoFatura("invoice-rebill");
  }, [fatura?.id, open]);

  const adjustmentSummary = useMemo(() => {
    const origins = preview.data?.origens ?? [];
    return origins.reduce((summary, origin) => {
      const rawValue = adjustments[origin.id] ?? "";
      const parsedValue = parseSignedValue(rawValue);
      const error = getOriginAdjustmentError(origin, rawValue);
      return {
        total: summary.total + (Number.isFinite(parsedValue) ? parsedValue : 0),
        hasError: summary.hasError || !!error,
      };
    }, { total: 0, hasError: false });
  }, [adjustments, preview.data?.origens]);

  const replacementTotal = Number(preview.data?.valorAtual ?? 0) + adjustmentSummary.total;
  const canSubmit = !!fatura
    && preview.data?.elegivel === true
    && motivo.trim().length >= 5
    && !adjustmentSummary.hasError
    && replacementTotal >= 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fatura || !preview.data || !canSubmit) return;

    const requestedAdjustments = preview.data.origens.flatMap((origin) => {
      const value = parseSignedValue(adjustments[origin.id] ?? "");
      if (!Number.isFinite(value) || value === 0) return [];
      return [{
        lancamentoId: origin.id,
        valorAjuste: value,
        motivo: motivo.trim(),
      }];
    });

    try {
      await refaturarFatura.mutateAsync({
        id: fatura.id,
        motivo: motivo.trim(),
        ajustes: requestedAdjustments,
        idempotencyKey: idempotencyKey.current,
      });
      onOpenChange(false);
    } catch {
      // The mutation keeps the same key and displays the server response for a safe retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[94vh] overflow-y-auto sm:max-w-3xl"
        data-testid="industrial-rebilling-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Refaturar com rastreabilidade
          </DialogTitle>
          <DialogDescription>
            A fatura cancelada permanece imutável. Uma nova fatura pendente será ligada às mesmas origens e a todo ajuste autorizado.
          </DialogDescription>
        </DialogHeader>

        {preview.isLoading && (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Conferindo origens e permissões…
          </div>
        )}

        {preview.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível preparar o refaturamento</AlertTitle>
            <AlertDescription>{preview.error.message}</AlertDescription>
          </Alert>
        )}

        {preview.data && (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">Fatura cancelada</span>
                <strong className="mt-1 block text-lg">{formatCurrency(Number(preview.data.fatura.valorOriginal))}</strong>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">Origens atuais</span>
                <strong className="mt-1 block text-lg">{formatCurrency(Number(preview.data.valorAtual))}</strong>
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <span className="text-xs text-muted-foreground">Nova fatura</span>
                <strong className="mt-1 block text-lg text-primary" data-testid="rebilling-total">
                  {formatCurrency(replacementTotal)}
                </strong>
              </div>
            </div>

            {!preview.data.elegivel && (
              <Alert variant="destructive">
                <FileClock className="h-4 w-4" />
                <AlertTitle>Refaturamento bloqueado</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {preview.data.motivosBloqueio.map((blocker) => <li key={blocker}>{blocker}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <section className="space-y-3" aria-labelledby="rebilling-origins-title">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 id="rebilling-origins-title" className="font-semibold">Origens recuperadas do cancelamento</h3>
                  <p className="text-xs text-muted-foreground">Cada ROL será vinculado uma única vez à fatura substituta.</p>
                </div>
                {preview.data.podeAjustar ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <ShieldCheck className="h-3.5 w-3.5" /> Ajuste comercial autorizado
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Seu acesso permite refaturar sem alterar valores.</span>
                )}
              </div>

              <div className="space-y-3">
                {preview.data.origens.map((origin) => {
                  const adjustment = adjustments[origin.id] ?? "";
                  const adjustmentValue = parseSignedValue(adjustment);
                  const adjustmentError = getOriginAdjustmentError(origin, adjustment);
                  return (
                    <article key={origin.id} className="rounded-xl border p-4" data-testid="rebilling-origin">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">{origin.numero}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(origin.data), "dd/MM/yyyy")} · {origin.itens.length} item(ns)
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <span className="block text-xs text-muted-foreground">Valor atual</span>
                          <strong>{formatCurrency(Number(origin.valor))}</strong>
                        </div>
                      </div>

                      {preview.data.podeAjustar && (
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <div className="space-y-2">
                            <Label htmlFor={`rebilling-adjustment-${origin.id}`}>
                              Ajuste (+ acréscimo / − desconto)
                            </Label>
                            <Input
                              id={`rebilling-adjustment-${origin.id}`}
                              value={adjustment}
                              onChange={(event) => setAdjustments((current) => ({
                                ...current,
                                [origin.id]: event.target.value,
                              }))}
                              inputMode="decimal"
                              placeholder="Ex.: -10,00 ou 15,00"
                              className="text-base sm:text-sm"
                              aria-invalid={!!adjustmentError}
                            />
                            <p className={adjustmentError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                              {adjustmentError ?? "O motivo geral abaixo será registrado também neste ajuste."}
                            </p>
                          </div>
                          <div className="min-w-36 rounded-lg bg-muted/40 px-3 py-2 text-sm sm:text-right">
                            <span className="block text-xs text-muted-foreground">Após ajuste</span>
                            <strong>{formatCurrency(Number(origin.valor) + (Number.isFinite(adjustmentValue) ? adjustmentValue : 0))}</strong>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="space-y-2">
              <Label htmlFor="rebilling-reason">Motivo do refaturamento *</Label>
              <Textarea
                id="rebilling-reason"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Descreva a correção comercial ou operacional realizada"
                rows={3}
                maxLength={500}
                className="text-base sm:text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Mínimo de 5 caracteres. O motivo, o operador e os valores ficam no histórico de auditoria.</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                Voltar
              </Button>
              <Button
                type="submit"
                className="min-h-11"
                data-testid="confirm-industrial-rebilling"
                disabled={!canSubmit || refaturarFatura.isPending}
              >
                {refaturarFatura.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar fatura substituta
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
