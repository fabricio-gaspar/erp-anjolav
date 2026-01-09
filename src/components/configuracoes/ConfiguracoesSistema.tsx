import { Card } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export function ConfiguracoesSistema() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <Wrench className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Sistema</h2>
          <p className="text-sm text-muted-foreground">
            Configure integrações, APIs e configurações técnicas
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Wrench className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações do sistema em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
