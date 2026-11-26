export const OPERATION_TYPES = ["industrial", "domestico"] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];
export type OperationFilter = OperationType | "all";
export type LegacyOperationalArea = "industrial" | "residencial";
export type ClientClassification = OperationType | "residencial";

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

/** Normaliza a classificação de clientes antiga para o vocabulário atual. */
export function normalizeClientClassification(value: unknown): OperationType | null {
  if (value === "industrial") return "industrial";
  if (value === "domestico" || value === "residencial") return "domestico";
  return null;
}

/** Aceita registros antigos enquanto clientes e PDVs ainda podem estar em transição. */
export function clientClassificationValuesForArea(area: string): ClientClassification[] {
  if (area === "industrial") return ["industrial"];
  if (area === "domestico" || area === "residencial") return ["domestico", "residencial"];
  return [];
}

export function clientClassificationMatchesArea(value: unknown, area: string): boolean {
  const classification = normalizeClientClassification(value);
  const operation = area === "residencial" ? "domestico" : area;
  return classification !== null && classification === operation;
}

export function clientClassificationLabel(value: unknown): string {
  const classification = normalizeClientClassification(value);
  return classification ? OPERATION_LABELS[classification] : "—";
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
