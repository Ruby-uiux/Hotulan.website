/**
 * Coupons. The evaluation rule is shared so checkout can preview a discount; the
 * server re-runs it inside the order transaction and only its result is charged.
 */

export type CouponType = "percent" | "amount" | "free_shipping";

export interface Coupon {
  id: string;
  /** Upper-case, unique. */
  code: string;
  type: CouponType;
  /** percent: 1–100; amount: ₮; free_shipping: ignored (0). */
  value: number;
  /** Minimum eligible subtotal, ₮. */
  minSubtotal: number;
  /** Restrict to these root category ids; empty = all categories. */
  categoryIds: string[];
  firstOrderOnly: boolean;
  /** Total redemptions allowed; null = unlimited. */
  usageLimit: number | null;
  /** Redemptions per phone number; null = unlimited. */
  perCustomerLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
}

export type CouponState = "active" | "scheduled" | "expired" | "disabled" | "exhausted";

export function couponState(c: Coupon, now = Date.now()): CouponState {
  if (!c.active) return "disabled";
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return "exhausted";
  if (c.startsAt && Date.parse(c.startsAt) > now) return "scheduled";
  if (c.endsAt && Date.parse(c.endsAt) <= now) return "expired";
  return "active";
}

export interface CouponLine {
  /** Root category id of the product. */
  category: string;
  lineTotal: number;
}

export interface CouponContext {
  lines: CouponLine[];
  /** Orders this phone number placed before (not cancelled). */
  customerOrderCount: number;
  /** Times this phone number already used this coupon. */
  customerUses: number;
  now?: number;
}

export type CouponResult =
  | { ok: true; discount: number; freeShipping: boolean }
  | { ok: false; reason: string };

export function evaluateCoupon(c: Coupon, ctx: CouponContext): CouponResult {
  const state = couponState(c, ctx.now);
  if (state === "scheduled") return { ok: false, reason: "Энэ купон хараахан эхлээгүй байна." };
  if (state !== "active") return { ok: false, reason: "Купон хүчингүй эсвэл хугацаа нь дууссан байна." };
  if (c.firstOrderOnly && ctx.customerOrderCount > 0) return { ok: false, reason: "Энэ купон зөвхөн анхны захиалгад хүчинтэй." };
  if (c.perCustomerLimit !== null && ctx.customerUses >= c.perCustomerLimit) {
    return { ok: false, reason: "Та энэ купоныг ашиглах эрхээ дуусгасан байна." };
  }

  const eligible = c.categoryIds.length === 0 ? ctx.lines : ctx.lines.filter((l) => c.categoryIds.includes(l.category));
  const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
  if (eligibleTotal === 0) return { ok: false, reason: "Сагсанд энэ купон хамаарах бараа алга." };
  if (eligibleTotal < c.minSubtotal) return { ok: false, reason: `Купон ${c.minSubtotal.toLocaleString("en-US")}₮-өөс дээш худалдан авалтад хүчинтэй.` };

  switch (c.type) {
    case "percent":
      return { ok: true, discount: Math.floor((eligibleTotal * c.value) / 100), freeShipping: false };
    case "amount":
      // Never discount below zero.
      return { ok: true, discount: Math.min(c.value, eligibleTotal), freeShipping: false };
    case "free_shipping":
      return { ok: true, discount: 0, freeShipping: true };
  }
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
