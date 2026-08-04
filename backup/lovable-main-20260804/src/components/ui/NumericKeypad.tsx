import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Delete, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm?: () => void;
  allowDecimal?: boolean;
  className?: string;
}

const KEYS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["C", "0", ","],
];

export function NumericKeypad({
  value,
  onChange,
  onConfirm,
  allowDecimal = true,
  className,
}: NumericKeypadProps) {
  const handleKeyPress = (key: string) => {
    if (key === "C") {
      onChange("");
      return;
    }

    if (key === "," && !allowDecimal) return;
    if (key === "," && value.includes(",")) return;

    onChange(value + key);
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {KEYS.map((row, rowIndex) =>
        row.map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === "C" ? "destructive" : "outline"}
            className={cn(
              "h-12 text-lg font-semibold",
              key === "C" && "bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            )}
            onClick={() => handleKeyPress(key)}
          >
            {key}
          </Button>
        ))
      )}
      <Button
        type="button"
        variant="outline"
        className="h-12"
        onClick={handleBackspace}
      >
        <Delete className="w-5 h-5" />
      </Button>
      {onConfirm && (
        <Button
          type="button"
          className="h-12 col-span-3 bg-success hover:bg-success/90"
          onClick={onConfirm}
        >
          <Check className="w-5 h-5 mr-2" />
          Confirmar
        </Button>
      )}
    </div>
  );
}

// Hook para detectar dispositivo touch
export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouch(
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0
      );
    };
    
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  return isTouch;
}
