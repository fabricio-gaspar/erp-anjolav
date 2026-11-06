export type ClientPriceMode = "padrao" | "personalizada" | "cesto";

export const CLIENT_PRICE_MODE_LABELS: Record<ClientPriceMode, string> = {
  padrao: "Padrão",
  personalizada: "Personalizada",
  cesto: "Cesto",
};

export function isClientPriceMode(value: unknown): value is ClientPriceMode {
  return value === "padrao" || value === "personalizada" || value === "cesto";
}

export function normalizeClientPriceMode(value: unknown): ClientPriceMode {
  return isClientPriceMode(value) ? value : "padrao";
}

export type PriceCatalogProduct = {
  id: string;
  nome: string;
  unidade: string | null;
  preco: number;
  status: string;
  unidade_negocio: string | null;
};

export type ClientPriceOverride = {
  produto_id: string;
  preco_especial: number;
  tipo?: string;
};

export function isProductAvailableForArea(
  product: Pick<PriceCatalogProduct, "status" | "unidade_negocio">,
  area: "industrial" | "residencial",
) {
  if (product.status !== "ativo") return false;
  if (!product.unidade_negocio || product.unidade_negocio === "ambos") return true;
  return area === "industrial" ? product.unidade_negocio === "ID1" : product.unidade_negocio === "ID2";
}

export function resolveClientProductPrice(
  product: Pick<PriceCatalogProduct, "preco">,
  mode: ClientPriceMode,
  override?: Pick<ClientPriceOverride, "preco_especial">,
) {
  return mode === "personalizada" && override ? override.preco_especial : product.preco;
}

export function buildClientPriceCatalog<T extends PriceCatalogProduct>(
  products: T[],
  overrides: ClientPriceOverride[],
  mode: ClientPriceMode,
  area: "industrial" | "residencial",
) {
  const overridesByProduct = new Map(overrides.map((override) => [override.produto_id, override]));
  return products
    .filter((product) => isProductAvailableForArea(product, area))
    // Cesto is a named commercial table that intentionally shares the base
    // product price with Padrão. Only Personalizada needs an override entry.
    .filter((product) => mode !== "personalizada" || overridesByProduct.has(product.id))
    .map((product) => ({
      ...product,
      precoAplicado: resolveClientProductPrice(product, mode, overridesByProduct.get(product.id)),
      override: overridesByProduct.get(product.id) ?? null,
    }));
}
