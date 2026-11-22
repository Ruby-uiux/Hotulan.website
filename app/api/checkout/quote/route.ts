import { HttpError } from "@/lib/server/errors";
import { handle, readJson } from "@/lib/server/http";
import { quoteCart } from "@/lib/server/repo/orders";

export const dynamic = "force-dynamic";

/**
 * Public, read-only checkout preview: line prices and stock, coupon result, delivery fee
 * and total — computed by the same code as order creation, so the number a shopper sees
 * is the number they're charged. Nothing is reserved.
 *
 * Body: { lines: [{ productId, variantId?, quantity }], zoneId?, couponCode?, phone? }
 */
export const POST = handle(async (request: Request) => {
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

  const quote = await quoteCart({
    lines,
    zoneId: text(b.zoneId, 40),
    couponCode: text(b.couponCode, 40),
    phone: digits && /^\d{8}$/.test(digits) ? `${digits.slice(0, 4)}-${digits.slice(4)}` : null,
  });
  return Response.json(quote, { headers: { "Cache-Control": "no-store" } });
});
