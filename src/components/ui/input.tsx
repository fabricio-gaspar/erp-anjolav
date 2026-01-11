import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  skipUppercase?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, skipUppercase, onChange, ...props }, ref) => {
    const isEmailField = type === "email" || 
      props.placeholder?.toLowerCase().includes("email") ||
      props.name?.toLowerCase().includes("email");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Não converter para maiúsculas se for campo de email ou skipUppercase estiver ativo
      if (!skipUppercase && !isEmailField && type !== "password" && type !== "number") {
        e.target.value = e.target.value.toUpperCase();
      }
      onChange?.(e);
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          !isEmailField && !skipUppercase && type !== "password" && type !== "number" && "uppercase",
          className,
        )}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
