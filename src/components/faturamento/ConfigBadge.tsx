import { Check } from "lucide-react";

interface ConfigBadgeProps {
  label: string;
  value: string;
}

export function ConfigBadge({ label, value }: ConfigBadgeProps) {
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
      <Check className="w-4 h-4 text-green-600 shrink-0" />
      <div className="text-sm">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value}</span>
      </div>
      <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
        Configurado no cadastro
      </span>
    </div>
  );
}
