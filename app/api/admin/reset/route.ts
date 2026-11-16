import { byNewest } from "@/lib/admin-data";
import { handle } from "@/lib/server/http";
import { mutateStore } from "@/lib/server/store";
import { seedData } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Restores demo products and orders; store settings are intentionally kept. */
export const POST = handle(async () => {
  const data = await mutateStore((d) => {
    const seed = seedData();
    d.products = seed.products;
    d.orders = seed.orders;
    return { products: d.products, orders: [...d.orders].sort(byNewest) };
  });
  return data;
});
