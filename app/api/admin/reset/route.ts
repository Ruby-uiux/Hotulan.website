import { requireStaff } from "@/lib/server/actor";
import { writeTx } from "@/lib/server/db/client";
import { handle } from "@/lib/server/http";
import { listOrders } from "@/lib/server/repo/orders";
import { listProducts } from "@/lib/server/repo/products";
import { resetDemoCatalog } from "@/lib/server/seed";

export const dynamic = "force-dynamic";

/**
 * Restores demo products and orders (and their customers). Categories, delivery zones,
 * settings, staff, coupons and banners are intentionally kept.
 */
export const POST = handle(async () => {
  await requireStaff("staff", "full");
  await writeTx((tx) => resetDemoCatalog(tx));
  const [products, orders] = await Promise.all([listProducts(), listOrders()]);
  return { products, orders };
});
