import { HttpError } from "@/lib/server/errors";
import { handle, readJson } from "@/lib/server/http";
import { clientIp, hit, retryAfter, type Limit } from "@/lib/server/rate-limit";
import { quoteCart } from "@/lib/server/repo/orders";

export const dynamic = "force-dynamic";

/**
 * The cart and checkout re-quote on every change (debounced), so 30 a minute per IP is
 * generous for a shopper and a wall for a script. Only with TRUST_PROXY=1 is the IP
 * trustworthy; without it this layer is skipped and only the coupon limit below applies.
 */
const QUOTE_LIMIT: Limit = { max: 30, windowMs: 60_000 };

/**
 * Coupon guessing: at most 10 different wrong codes per IP per 10 minutes (100 across
 * everyone when the IP is unknown). Re-checking the same wrong code — it stays in the cart
 * while quantities change — doesn't count again. Over the limit the quote still works;
 * only coupon checking pauses.
 */
const COUPON_WINDOW_MS = 10 * 60_000;
const COUPON_MAX_PER_IP = 10;
const COUPON_MAX_GLOBAL = 100;

const g = globalThis as unknown as { __hotulanCouponMisses?: Map<string, { codes: Set<string>; resetAt: number }> };
const misses = (g.__hotulanCouponMisses ??= new Map());

function missBucket(key: string, now: number) {
  let b = misses.get(key);
  if (!b || b.resetAt <= now) {
    b = { codes: new Set(), resetAt: now + COUPON_WINDOW_MS };
    misses.set(key, b);
    if (misses.size > 10_000) for (const [k, v] of misses) if (v.resetAt <= now) misses.delete(k);
  }
  return b;
}

/**
 * Public, read-only checkout preview: line prices and stock, coupon result, delivery fee
 * and total — computed by the same code as order creation, so the number a shopper sees
 * is the number they're charged. Nothing is reserved.
 *
 * Body: { lines: [{ productId, variantId?, quantity }], zoneId?, couponCode?, phone? }
 */
export const POST = handle(async (request: Request) => {
  const ip = clientIp(request);
  if (ip) {
    const wait = retryAfter(`quote:ip:${ip}`, QUOTE_LIMIT);
    if (wait > 0) throw new HttpError(429, "Хэт олон хүсэлт илгээлээ. Түр хүлээгээд дахин оролдоно уу.", { retryAfter: wait });
    hit(`quote:ip:${ip}`, QUOTE_LIMIT);
  }

  const b = (await readJson(request)) as Record<string, unknown>;
  if (!b || typeof b !== "object" || !Array.isArray(b.lines) || b.lines.length > 50) {
    throw new HttpError(400, "Хүсэлтийн бүтэц буруу байна.");
  }
  const lines = b.lines.flatMap((raw) => {
    const l = raw as Record<string, unknown>;
    const quantity = Number(l?.quantity);
    if (typeof l?.productId !== "string" || !l.productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return [];
    return [{ productId: l.productId.slice(0, 100), variantId: typeof l.variantId === "string" && l.variantId ? l.variantId.slice(0, 100) : null, quantity }];
  });
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const digits = text(b.phone, 20)?.replace(/[\s-]/g, "") ?? null;
  const couponCode = text(b.couponCode, 40);

  const now = Date.now();
  const bucket = missBucket(ip ? `ip:${ip}` : "global", now);
  const code = couponCode?.toUpperCase() ?? null;
  const blocked = code !== null && !bucket.codes.has(code) && bucket.codes.size >= (ip ? COUPON_MAX_PER_IP : COUPON_MAX_GLOBAL);

  const quote = await quoteCart({
    lines,
    zoneId: text(b.zoneId, 40),
    couponCode: blocked ? null : couponCode,
    phone: digits && /^\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4)}` : null,
  });
  if (blocked) {
    quote.coupon = { code: code!, ok: false, message: "Олон удаа буруу купон оруулсан тул түр хүлээгээд дахин оролдоно уу." };
  } else if (quote.coupon && !quote.coupon.ok) {
    bucket.codes.add(quote.coupon.code);
  }
  return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
});
