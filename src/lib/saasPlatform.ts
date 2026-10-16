export const SUBSCRIPTION_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
export const SAAS_TENANT_PAGE_SIZE = 50;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type TenantLifecycleStatus = "active" | "suspended" | "cancelled";

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

export function tenantStatusForSubscription(status: SubscriptionStatus): TenantLifecycleStatus {
  if (status === "suspended") return "suspended";
  if (status === "cancelled") return "cancelled";
  return "active";
}

export function getSaasTenantPageOffset(page: number, pageSize = SAAS_TENANT_PAGE_SIZE): number {
  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 0;
  const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : SAAS_TENANT_PAGE_SIZE;
  return normalizedPage * normalizedPageSize;
}
