"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Order, PaymentMethod } from "@/lib/admin-data";
import { ApiError, api } from "@/lib/api-client";
import type { DeliveryZone } from "@/lib/delivery";
import CartDrawer, { type CheckoutDetails, type PlacedOrder } from "../CartDrawer";
import { useCart } from "./CartProvider";

/**
 * Mounts the cart drawer once for every storefront page and feeds it from CartProvider.
 * (The drawer still holds the quick checkout form until the /checkout page replaces it.)
 */
export default function CartDrawerHost({
  zones,
  paymentMethods,
  freeDeliveryThreshold,
  oversizedFee,
}: {
  zones: DeliveryZone[];
  paymentMethods: PaymentMethod[];
  freeDeliveryThreshold: number;
  oversizedFee: number;
}) {
  const router = useRouter();
  const cart = useCart();
  const { items, setQuantity, clear, refresh } = cart;

  const find = useCallback((productId: string) => items.find((i) => i.productId === productId), [items]);

  const placeOrder = useCallback(
    async (details: CheckoutDetails): Promise<PlacedOrder> => {
      try {
        const { order } = await api<{ order: Order; total: number }>("/api/orders", {
          method: "POST",
          body: { ...details, lines: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })) },
        });
        clear();
        router.refresh(); // pages show the decremented stock
        return { id: order.id, total: order.total, itemCount: order.lines.reduce((n, l) => n + l.quantity, 0) };
      } catch (err) {
        // Stock moved under us: re-read the cart so it clamps, then let the shopper retry.
        if (err instanceof ApiError && err.status === 409) void refresh();
        throw err;
      }
    },
    [items, clear, refresh, router],
  );

  return (
    <CartDrawer
      open={cart.isOpen}
      onClose={cart.close}
      items={items.map((i) => ({ product: i.product, quantity: i.quantity }))}
      subtotal={cart.subtotal}
      onIncrement={(id) => {
        const i = find(id);
        if (i) setQuantity(id, i.variantId, i.quantity + 1);
      }}
      onDecrement={(id) => {
        const i = find(id);
        if (i) setQuantity(id, i.variantId, i.quantity - 1);
      }}
      onRemove={(id) => {
        const i = find(id);
        if (i) setQuantity(id, i.variantId, 0);
      }}
      freeDeliveryThreshold={freeDeliveryThreshold}
      oversizedFee={oversizedFee}
      zones={zones}
      paymentMethods={paymentMethods}
      onPlaceOrder={placeOrder}
    />
  );
}
