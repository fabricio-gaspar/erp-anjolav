import * as React from "react";
import { cn } from "@/lib/utils";
import {
  formatCurrencyInput,
  formatNumberToCurrency,
  parseCurrencyToNumber,
} from "@/lib/currencyUtils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "defaultValue"> {
  value?: string | number | null;
  defaultValue?: string | number | null;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (numeric: number, formatted: string) => void;
  showPrefix?: boolean;
  className?: string;
}

const toDisplay = (v: string | number | null | undefined): string => {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") return formatNumberToCurrency(v);
  return formatCurrencyInput(String(v));
};

/**
 * Input com máscara monetária BR: R$ 1.250,30
 * Suporta modo controlado (value) e não-controlado (defaultValue).
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    { value, defaultValue, onChange, onValueChange, onBlur, showPrefix = true, className, placeholder = "0,00", ...props },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [internal, setInternal] = React.useState<string>(() => toDisplay(defaultValue));
    const display = isControlled ? toDisplay(value) : internal;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrencyInput(e.target.value);
      e.target.value = formatted;
      if (!isControlled) setInternal(formatted);
      onChange?.(e);
      onValueChange?.(parseCurrencyToNumber(formatted), formatted);
    };

    return (
      <div className="relative w-full">
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
          onBlur={onBlur}
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
