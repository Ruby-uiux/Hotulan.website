"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote } from "@/lib/server/repo/orders";
import type { CartItem } from "./CartProvider";

export type { Quote };

/**
 * Server-priced view of the cart (POST /api/checkout/quote). Debounced, and only the
 * latest request wins, so typing a coupon or switching districts never shows a stale
 * total. `quote` stays at the last good answer while a new one loads.
 */
export function useQuote(
  items: CartItem[],
  opts: { enabled: boolean; zoneId?: string | null; couponCode?: string | null; phone?: string | null },
) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);

  const key = JSON.stringify({
    lines: items.map((i) => [i.productId, i.variantId, i.quantity]),
    zone: opts.zoneId ?? null,
    coupon: opts.couponCode ?? null,
    phone: opts.phone ?? null,
  });

  useEffect(() => {
    if (!opts.enabled || items.length === 0) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lines: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
            zoneId: opts.zoneId ?? undefined,
            couponCode: opts.couponCode ?? undefined,
            phone: opts.phone ?? undefined,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Quote;
        if (id === seq.current) {
          setQuote(data);
          setFailed(false);
        }
      } catch {
        if (id === seq.current) setFailed(true);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // `key` captures every input that changes the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.enabled]);

  return { quote, loading, failed };
}
