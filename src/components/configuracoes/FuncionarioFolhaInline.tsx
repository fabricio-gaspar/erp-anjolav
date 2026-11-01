import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import {
  formatCurrencyInput,
  formatNumberToCurrency,
  parseCurrencyToNumber,
} from "@/lib/currencyUtils";
import { useBeneficiosCatalogo, corDot } from "@/hooks/useBeneficiosCatalogo";
import {
  useFolhaBeneficiosByFolha,
  useUpsertValorBeneficio,
  type FolhaBeneficio,
} from "@/hooks/useFolhaBeneficios";
import { useCancelFolha, useUpdateFolha, type FolhaPagamento } from "@/hooks/useFolhaPagamento";
import { Wallet, AlertCircle, ArchiveX, Loader2 } from "lucide-react";

interface Props {
  folha: FolhaPagamento | null;
  competenciaLabel: string;
}

function CampoMoeda({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string;
  value: number;
  onSave: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <CurrencyInput
        showPrefix={false}
        disabled={disabled}
        className="h-9 w-full text-sm"
        defaultValue={formatNumberToCurrency(value)}
        onBlur={(e) => {
          const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
          if (novo !== value) onSave(novo);
        }}
      />
    </div>
  );
}

export function FuncionarioFolhaInline({ folha, competenciaLabel }: Props) {
  const { data: catalogo = [] } = useBeneficiosCatalogo();
  const { data: valores = [] } = useFolhaBeneficiosByFolha(folha ? [folha.id] : []);
  const upsertBen = useUpsertValorBeneficio();
  const updateFolha = useUpdateFolha();
  const cancelFolha = useCancelFolha();
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const valorMap = useMemo(() => {
    const m = new Map<string, FolhaBeneficio>();
    valores.forEach((v) => v.beneficio_id && m.set(v.beneficio_id, v));
    return m;
  }, [valores]);
  const beneficiosVisiveis = useMemo(
    () => catalogo.filter((benefit) => benefit.ativo || Number(valorMap.get(benefit.id)?.valor || 0) > 0),
    [catalogo, valorMap],
  );
  const beneficiosLegados = useMemo(() => {
    const catalogIds = new Set(catalogo.map((benefit) => benefit.id));
    return valores.filter((benefit) => benefit.ativo && (
      !benefit.beneficio_id || !catalogIds.has(benefit.beneficio_id)
    ));
  }, [catalogo, valores]);

  if (!folha) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          Sem folha de <strong>{competenciaLabel}</strong> para este funcionário. Clique em
          <strong> Gerar Folha do Mês </strong> no topo.
        </span>
      </div>
    );
  }

  const isAberto = folha.status === "aberto";
  const totalBen = beneficiosVisiveis.reduce((s, b) => s + Number(valorMap.get(b.id)?.valor || 0), 0)
    + beneficiosLegados.reduce((sum, benefit) => sum + Number(benefit.valor || 0), 0);
  const totalPagar = Number(folha.salario_base || 0) + totalBen;

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wallet className="w-4 h-4 text-primary" />
          Folha de {competenciaLabel}
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded uppercase",
              isAberto ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700",
            )}
          >
            {folha.status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            Total a pagar:{" "}
            <strong className="tabular-nums text-primary">
              R$ {formatNumberToCurrency(totalPagar)}
            </strong>
          </span>
          {isAberto && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-10 text-destructive hover:text-destructive"
              onClick={() => setShowCancel(true)}
            >
              <ArchiveX className="h-4 w-4" />
              Cancelar folha
            </Button>
          )}
        </div>
      </div>

      {/* Salário */}
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda
          label="Adiantamento"
          value={Number(folha.adiantamento_salarial || 0)}
          disabled={!isAberto || updateFolha.isPending}
          onSave={(v) =>
            updateFolha.mutate({ folha, field: "adiantamento_salarial", value: v })
          }
        />
        <CampoMoeda
          label="Pagamento (Salário)"
          value={Number(folha.salario_base || 0)}
          disabled={!isAberto || updateFolha.isPending}
          onSave={(v) => updateFolha.mutate({ folha, field: "salario_base", value: v })}
        />
      </div>

      {/* Benefícios */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Benefícios</div>
        {beneficiosVisiveis.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            Nenhum benefício cadastrado no catálogo.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {beneficiosVisiveis.map((b) => {
              const atual = Number(valorMap.get(b.id)?.valor || 0);
              return (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border bg-background",
                    atual > 0 ? "border-primary/40" : "",
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", corDot(b.cor))} />
                  <span className="min-w-0 flex-1 text-xs font-medium truncate" title={b.nome}>
                    {b.nome}{!b.ativo ? " (arquivado)" : ""}
                  </span>
                  <CurrencyInput
                    showPrefix={false}
                    disabled={!isAberto || !b.ativo || upsertBen.isPending}
                    className="h-10 w-24 text-sm px-2 shrink-0"
                    defaultValue={formatNumberToCurrency(atual)}
                    onBlur={(e) => {
                      const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                      if (novo !== atual) {
                        upsertBen.mutate({
                          folha,
                          beneficioId: b.id,
                          valor: novo,
                        });
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
        {beneficiosLegados.length > 0 && (
          <div className="mt-2 rounded-md border border-dashed bg-background p-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Itens históricos preservados</p>
            {beneficiosLegados.map((benefit) => (
              <div key={benefit.id} className="mt-1 flex justify-between gap-3">
                <span className="truncate">{benefit.nome}</span>
                <span className="shrink-0 tabular-nums">R$ {formatNumberToCurrency(Number(benefit.valor))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta folha?</AlertDialogTitle>
            <AlertDialogDescription>
              O lançamento será preservado como cancelado para auditoria e não entrará no fechamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`cancel-payroll-${folha.id}`}>Motivo do cancelamento</Label>
            <Textarea
              id={`cancel-payroll-${folha.id}`}
              value={cancelReason}
              maxLength={500}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Descreva o motivo com pelo menos 5 caracteres"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelFolha.isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelReason.trim().length < 5 || cancelFolha.isPending}
              onClick={async (event) => {
                event.preventDefault();
                await cancelFolha.mutateAsync({ folha, motivo: cancelReason });
                setShowCancel(false);
                setCancelReason("");
              }}
            >
              {cancelFolha.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
