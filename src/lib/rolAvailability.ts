interface AvailabilityItem {
  ordemId: string;
  disponivel: boolean;
}

/** Readiness must consider the complete ROL, never just the visible filtered rows. */
export function isRolReadyForNotification(items: readonly AvailabilityItem[], orderId: string): boolean {
  const orderItems = items.filter((item) => item.ordemId === orderId);
  return orderItems.length > 0 && orderItems.every((item) => item.disponivel);
}
