import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";

export function ConfiguracoesGeral() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Geral</h2>
          <p className="text-sm text-muted-foreground">
            Configurações gerais do sistema
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Settings className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações gerais em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
