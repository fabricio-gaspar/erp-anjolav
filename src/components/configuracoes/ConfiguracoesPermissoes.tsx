import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";

export function ConfiguracoesPermissoes() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Permissões</h2>
          <p className="text-sm text-muted-foreground">
            Configure os níveis de acesso e permissões dos usuários
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Shield className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">
          Módulo de permissões em desenvolvimento
        </p>
      </div>
    </Card>
  );
}
