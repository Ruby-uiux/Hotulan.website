import { requireStaff } from "@/lib/server/actor";
import { HttpError } from "@/lib/server/errors";
import { handle, readJson } from "@/lib/server/http";
import { clientIp, hit, retryAfter, type Limit } from "@/lib/server/rate-limit";
import { orderAccessUrl } from "@/lib/server/order-token";
import { createOrder, listOrders } from "@/lib/server/repo/orders";
import { parseCheckout } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Staff with orders:view. Contains customer names and phone numbers; drivers only see orders assigned to them. */
export const GET = handle(async () => {
  const staff = await requireStaff("orders", "view");
  return { orders: await listOrders(staff.role === "driver" ? { driverId: staff.id } : {}) };
});

/**
 * Checkout is public and every order reserves stock, so it is throttled: 5 placed orders per
 * 10 minutes per IP (when TRUST_PROXY=1 makes the IP trustworthy) and per phone number
 * (always). Rejected attempts don't count — a shopper fixing a typo isn't penalised.
 */
const ORDER_LIMIT: Limit = { max: 5, windowMs: 10 * 60_000 };

/**
 * Storefront checkout (public). Prices, stock, delivery fee and discount are all computed from
 * the database inside one transaction — the client only says what, how many and where.
 */
export const POST = handle(async (request: Request) => {
  const input = parseCheckout(await readJson(request));
  const ip = clientIp(request);
  const keys = [`order:phone:${input.phone}`, ...(ip ? [`order:ip:${ip}`] : [])];

  const wait = Math.max(...keys.map((k) => retryAfter(k, ORDER_LIMIT)));
  if (wait > 0) {
    throw new HttpError(429, `Хэт олон захиалга илгээлээ. ${Math.ceil(wait / 60)} минутын дараа дахин оролдоно уу.`, {
      retryAfter: wait,
    });
  }

  const order = await createOrder(input);
  for (const k of keys) hit(k, ORDER_LIMIT);
  // accessUrl is the only way back to the confirmation page (/order/[id] needs its token).
  return Response.json({ order, total: order.total, accessUrl: orderAccessUrl(order.id) }, { status: 201, headers: { "Cache-Control": "no-store" } });
});
