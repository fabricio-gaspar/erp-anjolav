import { Card } from "@/components/ui/card";
import { Tag } from "lucide-react";

export function ConfiguracoesEtiquetas() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Tag className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Etiquetas</h2>
          <p className="text-sm text-muted-foreground">
            Configure o formato e layout das etiquetas de identificação
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Tag className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações de etiquetas em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
