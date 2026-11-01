export const OPERATION_TYPES = ["industrial", "domestico"] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];
export type OperationFilter = OperationType | "all";
export type LegacyOperationalArea = "industrial" | "residencial";

export const OPERATION_LABELS: Record<OperationType, string> = {
  industrial: "Industrial",
  domestico: "Doméstico",
};

export function isOperationType(value: unknown): value is OperationType {
  return typeof value === "string" && OPERATION_TYPES.includes(value as OperationType);
}

export function parseOperationFilter(value: string | null | undefined): OperationFilter {
  return isOperationType(value) ? value : "all";
}

export function operationFromLegacyArea(area: LegacyOperationalArea): OperationType {
  return area === "industrial" ? "industrial" : "domestico";
}

export function legacyAreaFromOperation(operation: OperationType): LegacyOperationalArea {
  return operation === "industrial" ? "industrial" : "residencial";
}

export function getCanonicalPdvOperationPath(operation: OperationType): "/pdv/industrial" | "/pdv/domestico" {
  return operation === "industrial" ? "/pdv/industrial" : "/pdv/domestico";
}

export function getPdvOperationalPath(
  operation: OperationType,
  modulePath: string,
  search = "",
): string {
  const suffix = modulePath.replace(/^\/+/, "");
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return suffix
    ? `${getCanonicalPdvOperationPath(operation)}/${suffix}${query}`
    : `${getCanonicalPdvOperationPath(operation)}${query}`;
}
