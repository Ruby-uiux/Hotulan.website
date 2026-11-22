/**
 * Delivery zones and slots — Ulaanbaatar only. Shared by checkout UI and the server,
 * so the fee a shopper sees is computed by exactly the same rule the server charges.
 */

export type ZoneRegion = "central" | "remote";

export interface DeliveryZone {
  /** Stable latin id, e.g. "khan-uul". */
  id: string;
  /** District name shown to shoppers and snapshotted on orders, e.g. "Хан-Уул". */
  name: string;
  region: ZoneRegion;
  fee: number;
  /** Promised delivery time in hours (24, 48, 72). */
  etaHours: number;
  /** Number of khoroos — drives the khoroo select (1…N). Editable in admin. */
  khorooCount: number;
  /** Inactive districts can't be chosen at checkout. */
  active: boolean;
  sortOrder: number;
}

export interface DeliverySlot {
  id: string;
  /** "10:00–14:00" */
  label: string;
  /** Max orders per slot per day; null = unlimited. */
  capacity: number | null;
  active: boolean;
  sortOrder: number;
}

export const REGION_LABEL: Record<ZoneRegion, string> = {
  central: "Төв",
  remote: "Алслагдсан",
};

export interface DeliveryFeeInput {
  zone: Pick<DeliveryZone, "fee" | "region">;
  /** Subtotal after coupon discount. */
  subtotal: number;
  /** From store settings. Applies to central zones only (design: "Үнэгүй хүргэлтийн босго (төв бүс)"). */
  freeDeliveryThreshold: number;
  hasOversized: boolean;
  oversizedFee: number;
  /** Free-shipping coupon applied. */
  freeShipping?: boolean;
}

/**
 * Zone fee, waived for central zones above the threshold or with a free-shipping coupon;
 * the oversized surcharge is always added on top (a bulky item costs the same to move).
 */
export function computeDeliveryFee(i: DeliveryFeeInput): number {
  const waived = i.freeShipping || (i.zone.region === "central" && i.subtotal >= i.freeDeliveryThreshold);
  return (waived ? 0 : i.zone.fee) + (i.hasOversized ? i.oversizedFee : 0);
}

/** Ulaanbaatar is UTC+8 all year (no daylight saving). */
const UB_OFFSET_MS = 8 * 3600_000;

/**
 * Earliest delivery day for an order placed `now`: orders before the cut-off ship the next
 * day, later ones the day after; zones promising 48/72 hours add the extra days.
 * Returns days from today (1 = tomorrow) and a label like "Маргааш (11.18)".
 */
export function estimateDelivery(zone: Pick<DeliveryZone, "etaHours">, cutoff: string, now = Date.now()): { days: number; date: string; label: string } {
  const local = new Date(now + UB_OFFSET_MS);
  const [h, m] = cutoff.split(":").map(Number);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const afterCutoff = Number.isFinite(h) && minutes >= h * 60 + (m || 0);
  const days = Math.max(1, Math.ceil(zone.etaHours / 24)) + (afterCutoff ? 1 : 0);
  const d = new Date(local.getTime() + days * 86_400_000);
  const date = `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
  const word = days === 1 ? "Маргааш" : days === 2 ? "Нөгөөдөр" : null;
  return { days, date: d.toISOString().slice(0, 10), label: word ? `${word} (${date})` : date };
}
