import { ORDER_DELIVERY_FEE, byNewest, orderTotal, type Order } from "@/lib/admin-data";
import { handle, readJson, uniqueId } from "@/lib/server/http";
import { mutateStore, readStore } from "@/lib/server/store";
import { HttpError, parseCheckout } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { orders } = await readStore();
  return { orders: [...orders].sort(byNewest) };
});

/**
 * Storefront checkout. Prices, stock and delivery fee are all taken from the store,
 * never from the request — the client only says *what* and *how many*.
 * Stock check and decrement happen in one queued mutation, so two shoppers can't
 * both buy the last unit.
 */
export const POST = handle(async (request: Request) => {
  const input = parseCheckout(await readJson(request));

  const order = await mutateStore((data) => {
    const lines = input.lines.map(({ productId, quantity }) => {
      const product = data.products.find((p) => p.id === productId);
      if (!product) {
        throw new HttpError(409, "Сагсанд байсан нэг бараа дэлгүүрээс хасагдсан байна.", { productId, available: 0 });
      }
      if (product.stock < quantity) {
        throw new HttpError(
          409,
          product.stock === 0
            ? `“${product.title}” дууссан байна.`
            : `“${product.title}” — зөвхөн ${product.stock} ширхэг үлдсэн байна.`,
          { productId, available: product.stock },
        );
      }
      return { product, quantity };
    });

    // All lines validated — only now touch stock, so a failure above leaves nothing half-applied.
    for (const { product, quantity } of lines) product.stock -= quantity;

    const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
    const created: Order = {
      id: uniqueId("HTL-", new Set(data.orders.map((o) => o.id))),
      customer: input.customer,
      phone: input.phone,
      district: input.district,
      payment: input.payment,
      status: "new",
      createdAt: new Date().toISOString(),
      deliveryFee: subtotal >= data.settings.freeDeliveryThreshold ? 0 : ORDER_DELIVERY_FEE,
      lines: lines.map(({ product, quantity }) => ({
        productId: product.id,
        title: product.title,
        unitPrice: product.price,
        quantity,
      })),
    };
    data.orders.unshift(created);
    return created;
  });

  return Response.json({ order, total: orderTotal(order) }, { status: 201 });
});
