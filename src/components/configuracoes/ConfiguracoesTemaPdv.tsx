import { Check, Palette } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PDV_TEMPLATE_THEMES } from "@/lib/pdvTemplateTheme";

export function ConfiguracoesTemaPdv() {
  const theme = PDV_TEMPLATE_THEMES[0];

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Palette className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Tema visual do PDV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O PDV usa a mesma paleta azul do Painel Administrativo Geral em todos os setores, módulos e telas operacionais.
            </p>
          </div>
        </div>
      </Card>

      <div className="rounded-xl border-2 border-primary bg-primary/5 p-3" aria-label="Paleta visual ativa do PDV">
        <div className="mb-3 flex h-16 overflow-hidden rounded-lg border" aria-hidden="true">
          <span className="w-1/3" style={{ backgroundColor: theme.colors[0] }} />
          <span className="w-1/3" style={{ backgroundColor: theme.colors[1] }} />
          <span className="w-1/3" style={{ backgroundColor: theme.colors[2] }} />
        </div>
        <span className="flex items-center justify-between gap-2 font-semibold">
          {theme.name}
          <Check className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{theme.description}</span>
      </div>
    </div>
  );
}
