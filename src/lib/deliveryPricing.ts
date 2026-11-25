export type DeliveryPricingModel = "fixo" | "km";

export interface DeliveryPricingRule {
  model: DeliveryPricingModel;
  baseFee: number;
  feePerKm: number;
}

export function calculateDistanceKm(
  originLatitude?: number | null,
  originLongitude?: number | null,
  destinationLatitude?: number | null,
  destinationLongitude?: number | null,
) {
  if (![originLatitude, originLongitude, destinationLatitude, destinationLongitude].every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }

  const earthRadiusKm = 6371;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians((destinationLatitude as number) - (originLatitude as number));
  const longitudeDelta = toRadians((destinationLongitude as number) - (originLongitude as number));
  const originLat = toRadians(originLatitude as number);
  const destinationLat = toRadians(destinationLatitude as number);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function calculateDeliveryFee(rule: DeliveryPricingRule, distanceKm?: number | null) {
  if (rule.model === "km") {
    if (distanceKm == null) return null;
    return Math.round((Math.max(0, rule.baseFee) + distanceKm * Math.max(0, rule.feePerKm)) * 100) / 100;
  }
  return Math.round(Math.max(0, rule.baseFee) * 100) / 100;
}
