import { Gift } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoyaltyEntryType, PortalLoyalty } from "@/hooks/usePortalData";

const pointFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

const entryTypeLabels: Record<LoyaltyEntryType, string> = {
  CREDITO: "Crédito",
  RESGATE: "Resgate",
  ESTORNO: "Estorno",
  EXPIRACAO: "Expiração",
};

function formatSignedPoints(points: number): string {
  return `${points > 0 ? "+" : ""}${pointFormatter.format(points)} pontos`;
}

interface FidelidadeClienteCardProps {
  loyalty: PortalLoyalty;
}

export function FidelidadeClienteCard({ loyalty }: FidelidadeClienteCardProps) {
  if (!loyalty.visible) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="h-5 w-5 text-primary" aria-hidden="true" />
          Fidelidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-background/80 p-4">
            <dt className="text-sm text-muted-foreground">Saldo de pontos</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {pointFormatter.format(loyalty.balancePoints)} pontos
            </dd>
            <p className="mt-1 text-sm text-muted-foreground">
              Valor estimado para resgate: {currencyFormatter.format(loyalty.balanceValue)}
            </p>
          </div>
          <div className="rounded-lg bg-background/80 p-4">
            <dt className="text-sm text-muted-foreground">Resgate mínimo</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">
              {pointFormatter.format(loyalty.minimumRedemptionPoints)} pontos
            </dd>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte a lavanderia para usar seus pontos.
            </p>
          </div>
        </dl>

        <section aria-labelledby="portal-loyalty-history-title">
          <h3 id="portal-loyalty-history-title" className="font-medium">
            Movimentações recentes
          </h3>
          {loyalty.recentEntries.length === 0 ? (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Ainda não há movimentações de fidelidade.
            </p>
          ) : (
            <ul className="mt-3 space-y-3" aria-label="Movimentações recentes de fidelidade">
              {loyalty.recentEntries.map((entry) => (
                <li key={`${entry.timestamp}-${entry.type}-${entry.description}`} className="flex items-start justify-between gap-4 border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{entry.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entryTypeLabels[entry.type]} · <time dateTime={entry.timestamp}>{dateFormatter.format(new Date(entry.timestamp))}</time>
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatSignedPoints(entry.points)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
