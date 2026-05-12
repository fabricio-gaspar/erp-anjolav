import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatCurrencyInput,
  formatNumberToCurrency,
  parseCurrencyToNumber,
} from "@/lib/currencyUtils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  value?: string | number | null;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (numeric: number, formatted: string) => void;
  showPrefix?: boolean;
  className?: string;
}

/**
 * Input com máscara monetária BR: R$ 1.250,30
 * - Aceita value como string formatada ou number.
 * - onChange dispara com o evento (value já formatado).
 * - onValueChange entrega (numero, formatado).
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    { value, onChange, onValueChange, showPrefix = true, className, placeholder = "0,00", ...props },
    ref,
  ) => {
    const display = React.useMemo(() => {
      if (value === undefined || value === null || value === "") return "";
      if (typeof value === "number") return formatNumberToCurrency(value);
      return formatCurrencyInput(String(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrencyInput(e.target.value);
      e.target.value = formatted;
      onChange?.(e);
      onValueChange?.(parseCurrencyToNumber(formatted), formatted);
    };

    return (
      <div className={cn("relative w-full", showPrefix && "")}>
        {showPrefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
            R$
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={display}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            showPrefix ? "pl-10 pr-3" : "px-3",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
