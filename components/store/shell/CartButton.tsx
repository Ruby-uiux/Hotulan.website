"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "../cart/CartProvider";

function Count({ count, className }: { count: number; className: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-[5px] text-[11px] leading-none font-bold text-white tabular-nums ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Header cart button: icon + label on desktop, icon only on mobile. Opens the cart drawer. */
export default function CartButton({ compact = false }: { compact?: boolean }) {
  const { count, ready, open } = useCart();
  const shown = ready ? count : 0;
  const label = shown > 0 ? `Сагс, ${shown} бараа` : "Сагс";

  if (compact) {
    return (
      <button type="button" onClick={open} aria-label={label} className="relative grid size-11 shrink-0 place-items-center text-slate-900">
        <ShoppingCart className="size-6" strokeWidth={1.8} aria-hidden="true" />
        <Count count={shown} className="top-1 right-0.5" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      className="relative flex h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50"
    >
      <ShoppingCart className="size-5" strokeWidth={1.8} aria-hidden="true" />
      Сагс
      <Count count={shown} className="top-0 right-2.5" />
    </button>
  );
}
