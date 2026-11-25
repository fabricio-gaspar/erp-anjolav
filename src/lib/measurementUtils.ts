/**
 * Parse measurements entered with either Brazilian or invariant decimal
 * separators. Inputs such as `3,25` and `3.25` represent the same measure.
 */
export function parseMeasurement(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized || !/^\d+(?:\.\d+)?$/.test(normalized)) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateAreaInSquareMeters(length: string, width: string): number {
  return parseMeasurement(length) * parseMeasurement(width);
}
