import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import type { FolhaPagamento } from "@/hooks/useFolhaPagamento";

interface Props {
  folha: FolhaPagamento;
  disabled?: boolean;
}

export function FolhaBeneficiosCompactPopover({ folha, disabled }: Props) {
  const { data: catalogo = [] } = useBeneficiosCatalogo();
  const { data: valores = [] } = useFolhaBeneficiosByFolha([folha.id]);
  const upsert = useUpsertValorBeneficio();

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

  const ativosCount = beneficiosVisiveis.filter((b) => Number(valorMap.get(b.id)?.valor || 0) > 0).length
    + beneficiosLegados.filter((benefit) => Number(benefit.valor || 0) > 0).length;
  const total = beneficiosVisiveis.reduce((s, b) => s + Number(valorMap.get(b.id)?.valor || 0), 0)
    + beneficiosLegados.reduce((sum, benefit) => sum + Number(benefit.valor || 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-10 gap-1.5 font-normal"
          aria-label={`Editar benefícios de ${folha.funcionario?.nome || "funcionário"}`}
        >
          <span>Benefícios</span>
          {ativosCount > 0 && (
            <span className="ml-0.5 text-xs px-1.5 rounded bg-primary text-primary-foreground">
              {ativosCount}
            </span>
          )}
          <span className="ml-1 font-semibold tabular-nums">
            R$ {formatNumberToCurrency(total)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-3" align="end">
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold text-sm">Benefícios do funcionário</h4>
            <p className="text-xs text-muted-foreground">
              Informe o valor que sua empresa paga deste benefício a este funcionário neste mês.
            </p>
          </div>

          {beneficiosVisiveis.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Nenhum benefício no catálogo. Cadastre em Configurações → Equipe → Benefícios.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {beneficiosVisiveis.map((b) => {
                const atual = Number(valorMap.get(b.id)?.valor || 0);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded-md border",
                      atual > 0 ? "bg-muted/30" : "opacity-80",
                    )}
                  >
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", corDot(b.cor))} />
                    <span className="min-w-0 flex-1 text-xs font-medium truncate" title={b.nome}>
                      {b.nome || "(sem nome)"}{!b.ativo ? " (arquivado)" : ""}
                    </span>
                    <CurrencyInput
                      showPrefix={false}
                      disabled={disabled || !b.ativo || upsert.isPending}
                      className="h-10 w-28 text-sm px-2 shrink-0"
                      defaultValue={formatNumberToCurrency(atual)}
                      onBlur={(e) => {
                        const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                        if (novo !== atual) {
                          upsert.mutate({
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
            <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Itens históricos preservados</p>
              {beneficiosLegados.map((benefit) => (
                <div key={benefit.id} className="mt-1 flex justify-between gap-2">
                  <span className="truncate">{benefit.nome}</span>
                  <span className="shrink-0 tabular-nums">R$ {formatNumberToCurrency(Number(benefit.valor))}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-2 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">R$ {formatNumberToCurrency(total)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
