import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { normalizeTotpCode } from "@/lib/mfaSecurity";

interface MfaCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label?: string;
}

export function MfaCodeInput({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  label = "Código de verificação",
}: MfaCodeInputProps) {
  return (
    <InputOTP
      maxLength={6}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={(nextValue) => onChange(normalizeTotpCode(nextValue))}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={label}
      autoComplete="one-time-code"
      inputMode="numeric"
    >
      <InputOTPGroup className="mx-auto">
        {Array.from({ length: 6 }, (_, index) => (
          <InputOTPSlot key={index} index={index} className="h-11 w-10 sm:w-11" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
