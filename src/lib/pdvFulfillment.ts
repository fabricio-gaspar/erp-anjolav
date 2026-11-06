import { addDays, isWeekend, nextMonday } from "date-fns";

const DEFAULT_DELIVERY_LEAD_DAYS = 3;

export function getDefaultPdvDeliveryDate(urgent = false): Date {
  const candidate = addDays(new Date(), urgent ? 1 : DEFAULT_DELIVERY_LEAD_DAYS);
  return isWeekend(candidate) ? nextMonday(candidate) : candidate;
}
