import { Card } from "@/components/ui/card";
import { Receipt } from "lucide-react";

export function ConfiguracoesFiscal() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Configurações Fiscais</h2>
          <p className="text-sm text-muted-foreground">
            Configure dados fiscais, certificados e emissão de notas
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Receipt className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações fiscais em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
