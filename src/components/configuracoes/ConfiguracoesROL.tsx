import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";

export function ConfiguracoesROL() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Configurações de ROL</h2>
          <p className="text-sm text-muted-foreground">
            Configure o formato e opções do Registro de Operação de Lavanderia
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Configurações de ROL em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
