import { Card } from "@/components/ui/card";
import { Database } from "lucide-react";

export function ConfiguracoesDados() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
          <Database className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Dados</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie backup, importação e exportação de dados
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Database className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações de dados em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
