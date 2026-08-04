import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { useUpdateFolha, type FolhaPagamento } from "@/hooks/useFolhaPagamento";
import { Wallet, AlertCircle } from "lucide-react";

interface Props {
  funcionarioId: string;
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

export function FuncionarioFolhaInline({ funcionarioId, folha, competenciaLabel }: Props) {
  const { data: catalogo = [] } = useBeneficiosCatalogo();
  const { data: valores = [] } = useFolhaBeneficiosByFolha(folha ? [folha.id] : []);
  const upsertBen = useUpsertValorBeneficio();
  const updateFolha = useUpdateFolha();

  const ativos = useMemo(() => catalogo.filter((c) => c.ativo), [catalogo]);

  const valorMap = useMemo(() => {
    const m = new Map<string, FolhaBeneficio>();
    valores.forEach((v) => v.beneficio_id && m.set(v.beneficio_id, v));
    return m;
  }, [valores]);

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
  const totalBen = ativos.reduce((s, b) => s + Number(valorMap.get(b.id)?.valor || 0), 0);
  const totalPagar = Number(folha.salario_base || 0) + totalBen;

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
      <div className="flex items-center justify-between">
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
        <div className="text-xs">
          Total a pagar:{" "}
          <span className="font-bold tabular-nums text-primary">
            R$ {formatNumberToCurrency(totalPagar)}
          </span>
        </div>
      </div>

      {/* Salário */}
      <div className="grid grid-cols-2 gap-3">
        <CampoMoeda
          label="Adiantamento"
          value={Number(folha.adiantamento_salarial || 0)}
          disabled={!isAberto}
          onSave={(v) =>
            updateFolha.mutate({ id: folha.id, adiantamento_salarial: v } as any)
          }
        />
        <CampoMoeda
          label="Pagamento (Salário)"
          value={Number(folha.salario_base || 0)}
          disabled={!isAberto}
          onSave={(v) => updateFolha.mutate({ id: folha.id, salario_base: v } as any)}
        />
      </div>

      {/* Benefícios */}
      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Benefícios</div>
        {ativos.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">
            Nenhum benefício cadastrado no catálogo.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ativos.map((b) => {
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
                    {b.nome}
                  </span>
                  <CurrencyInput
                    showPrefix={false}
                    disabled={!isAberto}
                    className="h-7 w-20 text-xs px-2 shrink-0"
                    defaultValue={formatNumberToCurrency(atual)}
                    onBlur={(e) => {
                      const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                      if (novo !== atual) {
                        upsertBen.mutate({
                          folha_id: folha.id,
                          funcionario_id: funcionarioId,
                          beneficio_id: b.id,
                          nome: b.nome,
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
      </div>
    </div>
  );
}
