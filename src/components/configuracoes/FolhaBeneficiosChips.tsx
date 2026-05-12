import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { formatNumberToCurrency, parseCurrencyToNumber, formatCurrencyInput } from "@/lib/currencyUtils";

export interface BeneficioTipo {
  key: string;
  label: string;
  field: string;
  className: string; // bg + text
}

export const BENEFICIO_TIPOS: BeneficioTipo[] = [
  { key: "vt", label: "VT", field: "vale_transporte", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border-blue-300/60" },
  { key: "va", label: "VA", field: "vale_alimentacao", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border-green-300/60" },
  { key: "vr", label: "VR", field: "vale_refeicao", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200 border-orange-300/60" },
  { key: "saude", label: "Saúde", field: "plano_saude", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200 border-rose-300/60" },
  { key: "odonto", label: "Odonto", field: "plano_odontologico", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200 border-cyan-300/60" },
  { key: "cesta", label: "Cesta", field: "desconto_cesta_basica", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300/60" },
  { key: "bonif", label: "Bonif.", field: "gratificacao", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 border-purple-300/60" },
  { key: "outros", label: "Outros", field: "outros_beneficios", className: "bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-200 border-slate-300/60" },
];

interface Props {
  folha: any;
  disabled?: boolean;
  onUpdate: (field: string, valor: number) => void;
}

export function FolhaBeneficiosChips({ folha, disabled, onUpdate }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BENEFICIO_TIPOS.map((t) => {
        const valor = Number(folha[t.field] || 0);
        const dim = valor === 0;
        return (
          <div
            key={t.key}
            className={cn(
              "flex items-center gap-1 rounded-md border px-1.5 py-0.5 transition-opacity",
              t.className,
              dim && "opacity-60",
            )}
            title={t.label}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">{t.label}</span>
            {disabled ? (
              <span className="text-xs font-medium tabular-nums">
                {formatNumberToCurrency(valor)}
              </span>
            ) : (
              <CurrencyInput
                showPrefix={false}
                className="h-6 w-20 text-xs px-1 bg-background/60 border-0 focus-visible:ring-1"
                defaultValue={formatNumberToCurrency(valor)}
                onBlur={(e) => {
                  const novo = parseCurrencyToNumber(formatCurrencyInput(e.target.value));
                  if (novo !== valor) onUpdate(t.field, novo);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
