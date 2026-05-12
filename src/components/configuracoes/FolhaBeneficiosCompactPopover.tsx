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

interface Props {
  folhaId: string;
  funcionarioId: string;
  disabled?: boolean;
}

export function FolhaBeneficiosCompactPopover({ folhaId, funcionarioId, disabled }: Props) {
  const { data: catalogo = [] } = useBeneficiosCatalogo();
  const { data: valores = [] } = useFolhaBeneficiosByFolha([folhaId]);
  const upsert = useUpsertValorBeneficio();

  const ativos = useMemo(() => catalogo.filter((c) => c.ativo), [catalogo]);

  const valorMap = useMemo(() => {
    const m = new Map<string, FolhaBeneficio>();
    valores.forEach((v) => v.beneficio_id && m.set(v.beneficio_id, v));
    return m;
  }, [valores]);

  const ativosCount = ativos.filter((b) => Number(valorMap.get(b.id)?.valor || 0) > 0).length;
  const total = ativos.reduce((s, b) => s + Number(valorMap.get(b.id)?.valor || 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 font-normal"
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

          {ativos.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Nenhum benefício no catálogo. Cadastre em Configurações → Equipe → Benefícios.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {ativos.map((b) => {
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
                    <span className="flex-1 text-xs font-medium truncate">{b.nome}</span>
                    <CurrencyInput
                      showPrefix={false}
                      disabled={disabled}
                      className="h-7 w-24 text-xs px-2"
                      defaultValue={formatNumberToCurrency(atual)}
                      onBlur={(e) => {
                        const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                        if (novo !== atual) {
                          upsert.mutate({
                            folha_id: folhaId,
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

          <div className="border-t pt-2 flex justify-between text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">R$ {formatNumberToCurrency(total)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
