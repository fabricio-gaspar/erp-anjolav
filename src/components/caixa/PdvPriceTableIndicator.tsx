import { ChevronRight, Loader2 } from "lucide-react";
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

const PRICE_TABLE_ORDER: ClientPriceMode[] = ["padrao", "cesto", "personalizada"];

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
      className="pdv-reference-card pdv-price-card"
      aria-labelledby="pdv-price-table-title"
    >
      <div className="pdv-card-title-row">
        <div className="pdv-card-title">
          <span className="pdv-step-number" aria-hidden="true">2</span>
          <h2 id="pdv-price-table-title">Tabela de preço</h2>
        </div>
      </div>

      {!clienteNome ? (
        <>
          <div className="pdv-price-empty">
            <p>Selecione o cliente para carregar a tabela aplicável.</p>
          </div>
          <div className="pdv-price-options" aria-label="Tabelas de preço disponíveis">
            {PRICE_TABLE_ORDER.map((option) => (
              <span key={option} className="pdv-price-option is-muted" aria-disabled="true">
                {CLIENT_PRICE_MODE_LABELS[option]}
              </span>
            ))}
          </div>
        </>
      ) : isLoading ? (
        <p role="status" className="pdv-inline-status">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando os preços de {clienteNome}…
        </p>
      ) : isError ? (
        <p role="alert" className="pdv-inline-status text-destructive">Não foi possível carregar a tabela de preço deste cliente.</p>
      ) : (
        <>
          <div className="pdv-price-highlight">
            <span>
              <strong>Tabela: {CLIENT_PRICE_MODE_LABELS[mode]}</strong>
              <small>{mode === "personalizada" ? "Preços especiais para este cliente." : TABLE_DESCRIPTIONS[mode]}</small>
            </span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </div>

          <div className="pdv-price-options" aria-label="Opções da tabela de preço">
            {PRICE_TABLE_ORDER.map((option) => {
              const isActive = option === mode;
              return (
                <span
                  key={option}
                  aria-current={isActive ? "true" : undefined}
                  className={`pdv-price-option${isActive ? " is-active" : ""}`}
                >
                  {CLIENT_PRICE_MODE_LABELS[option]}
                </span>
              );
            })}
          </div>
          <p className="sr-only">A alteração da tabela respeita a permissão comercial do perfil e acontece no cadastro do cliente.</p>
          <p className="sr-only">O pedido guardará esta tabela e o preço efetivo de cada item na confirmação.</p>
        </>
      )}
    </section>
  );
}
