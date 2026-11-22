import { requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { createOrder, listOrders } from "@/lib/server/repo/orders";
import { parseCheckout } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Staff with orders:view. Contains customer names and phone numbers; drivers only see orders assigned to them. */
export const GET = handle(async () => {
  const staff = await requireStaff("orders", "view");
  return { orders: await listOrders(staff.role === "driver" ? { driverId: staff.id } : {}) };
});

/**
 * Storefront checkout (public). Prices, stock, delivery fee and discount are all computed from
 * the database inside one transaction — the client only says what, how many and where.
 */
export const POST = handle(async (request: Request) => {
  const order = await createOrder(parseCheckout(await readJson(request)));
  return Response.json({ order, total: order.total }, { status: 201 });
});
