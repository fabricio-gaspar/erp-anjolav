import { Badge } from "@/components/ui/badge";
import { Loader2, Tag } from "lucide-react";
import {
  CLIENT_PRICE_MODE_LABELS,
  normalizeClientPriceMode,
  type ClientPriceMode,
} from "@/lib/clientPricing";

interface PdvPriceTableIndicatorProps {
  clienteNome?: string | null;
  tabelaPrecoTipo?: ClientPriceMode | string | null;
  isLoading?: boolean;
  isError?: boolean;
}

const TABLE_DESCRIPTIONS: Record<ClientPriceMode, string> = {
  padrao: "Tabela compartilhada com os preços padrão do catálogo.",
  personalizada: "Tabela exclusiva deste cliente, com preços próprios por produto ou serviço.",
  cesto: "Tabela compartilhada de cesto, independente dos preços personalizados.",
};

/**
 * Step 2 of the operational flow. The customer profile is the source of truth
 * for the table selection; the PDV only makes the choice explicit before any
 * item is priced. Changing a permanent customer table stays in the commercial
 * customer record and is never an unguarded POS action.
 */
export function PdvPriceTableIndicator({
  clienteNome,
  tabelaPrecoTipo,
  isLoading = false,
  isError = false,
}: PdvPriceTableIndicatorProps) {
  const mode = normalizeClientPriceMode(tabelaPrecoTipo);

  return (
    <section
      data-testid="pdv-price-table"
      className="rounded-xl border border-strong bg-card p-3 shadow-sm sm:p-4"
      aria-labelledby="pdv-price-table-title"
    >
      <div className="flex items-start gap-2">
        <Tag className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 id="pdv-price-table-title" className="text-base font-bold">Tabela de preço</h2>
          {!clienteNome ? (
            <p className="mt-1 text-sm text-muted-foreground">Selecione o cliente para carregar a tabela aplicável.</p>
          ) : isLoading ? (
            <p role="status" className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando os preços de {clienteNome}…
            </p>
          ) : isError ? (
            <p role="alert" className="mt-1 text-sm text-destructive">Não foi possível carregar a tabela de preço deste cliente.</p>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-2.5 py-1 text-xs font-bold">{CLIENT_PRICE_MODE_LABELS[mode]}</Badge>
                <span className="text-sm font-semibold">Aplicada a {clienteNome}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{TABLE_DESCRIPTIONS[mode]}</p>
              <p className="mt-2 text-xs text-muted-foreground">O pedido guardará esta tabela e o preço efetivo de cada item na confirmação.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
