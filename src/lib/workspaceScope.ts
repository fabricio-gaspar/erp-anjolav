export type BusinessArea = "central" | "industrial" | "residencial";

const RESIDENTIAL_ORDER_ORIGINS = ["residencial", "loja"] as const;

export function getAllowedOrderOrigins(area: BusinessArea): readonly string[] | null {
  if (area === "central") return null;
  if (area === "residencial") return RESIDENTIAL_ORDER_ORIGINS;
  return ["industrial"];
}

export function getCanonicalOrderOrigin(area: BusinessArea, requested: string): string {
  return area === "central" ? requested : area;
}

export function isOrderOriginAllowed(area: BusinessArea, origin: string): boolean {
  const allowed = getAllowedOrderOrigins(area);
  return allowed === null || allowed.includes(origin);
}

export function getAllowedProductUnits(area: BusinessArea): readonly string[] | null {
  if (area === "industrial") return ["ID1", "ambos"];
  if (area === "residencial") return ["ID2", "ambos"];
  return null;
}
