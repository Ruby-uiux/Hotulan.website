"use client";

import { ArrowLeft, Minus, Plus, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { buttonClasses, cn } from "@/components/ui";
import { formatMNT } from "@/lib/catalog";
import { useOverlay } from "@/lib/useOverlay";
import ProductImage from "../product/ProductImage";
import { useCart } from "./CartProvider";
import CouponField from "./CouponField";
import { useQuote } from "./useQuote";

/**
 * The cart (design/MCart): full screen on phones, a right-hand drawer on desktop.
 * Totals come from the server quote; checkout happens on /checkout.
 */
export default function CartDrawer({ freeDeliveryThreshold, icons }: { freeDeliveryThreshold: number; icons: Record<string, string | null> }) {
  const router = useRouter();
  const cart = useCart();
  const { items, isOpen, close } = cart;
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(isOpen, close);
  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);
  const { quote } = useQuote(items, { enabled: isOpen, couponCode: cart.coupon });

  if (!isOpen) return null;

  const subtotal = quote?.subtotal ?? cart.subtotal;
  const discount = quote?.discount ?? 0;
  const remaining = Math.max(0, freeDeliveryThreshold - (subtotal - discount));
  const progress = freeDeliveryThreshold > 0 ? Math.min(100, ((subtotal - discount) / freeDeliveryThreshold) * 100) : 100;
  const problems = new Map((quote?.lines ?? []).filter((l) => l.problem).map((l) => [`${l.productId}::${l.variantId ?? ""}`, l.problem!]));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 hidden animate-fade-in bg-slate-900/50 sm:block" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col bg-slate-50 shadow-lg outline-none sm:max-w-[440px] sm:animate-pop-in"
      >
        <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2">
          <button type="button" onClick={close} aria-label="Сагс хаах" className="grid size-11 place-items-center">
            <ArrowLeft className="size-5 sm:hidden" aria-hidden="true" />
            <X className="hidden size-5 sm:block" aria-hidden="true" />
          </button>
          <h2 id="cart-title" className="flex-1 text-lg font-bold">
            Сагс ({cart.count})
          </h2>
          {items.length > 0 && (
            <button type="button" onClick={cart.clear} className="h-11 px-3 text-sm font-semibold text-danger">
              Хоослох
            </button>
          )}
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="grid size-16 place-items-center rounded-xl bg-brand-50 text-brand">
              <ShoppingBag className="size-8" aria-hidden="true" />
            </span>
            <p className="text-lg font-bold">Таны сагс хоосон байна</p>
            <p className="text-sm text-slate-500">{formatMNT(freeDeliveryThreshold)}-өөс дээш захиалгад хүргэлт үнэгүй.</p>
            <button type="button" onClick={close} className={cn(buttonClasses(), "mt-2")}>
              Дэлгүүр хэсэх
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className={cn("rounded-lg border px-3.5 py-3", remaining === 0 ? "border-success-border bg-green-50" : "border-slate-200 bg-white")}>
                <p className={cn("text-sm font-bold", remaining === 0 ? "text-success-ink" : "text-slate-700")}>
                  {remaining === 0 ? "Хүргэлт үнэгүй боллоо" : `Үнэгүй хүргэлтэд ${formatMNT(remaining)} дутуу`}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Үнэгүй хүргэлт">
                  <div className={cn("h-full rounded-full", remaining === 0 ? "bg-success" : "bg-brand")} style={{ width: `${progress}%` }} />
                </div>
              </div>

              <ul className="space-y-3">
                {items.map((i) => {
                  const problem = problems.get(i.key);
                  return (
                    <li key={i.key} className="flex gap-3.5 rounded-lg border border-slate-200 bg-white p-3">
                      <Link href={`/p/${i.productId}`} onClick={close} tabIndex={-1} aria-hidden="true" className="shrink-0">
                        <ProductImage id={i.productId} src={i.product.image} alt="" icon={icons[i.product.category] ?? null} iconClassName="size-6" className="size-[84px] rounded-[10px]" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <Link href={`/p/${i.productId}`} onClick={close} className="line-clamp-2 flex-1 text-sm font-semibold hover:text-brand">
                            {i.product.title}
                          </Link>
                          <button type="button" onClick={() => cart.remove(i.productId, i.variantId)} aria-label={`${i.product.title} — сагснаас хасах`} className="-mt-1.5 -mr-1.5 grid size-8 shrink-0 place-items-center rounded-sm text-slate-500 hover:bg-slate-100">
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                        <span className="text-xs text-slate-500">{i.variant ? `${i.variant.option}: ${i.variant.name}` : " "}</span>
                        <div className="mt-auto flex items-center justify-between gap-2">
                          <span className="text-[15px] font-extrabold tabular-nums">{formatMNT(i.unitPrice * i.quantity)}</span>
                          <div className="flex h-9 items-center rounded-md border border-slate-300" role="group" aria-label={`Тоо ширхэг — ${i.product.title}`}>
                            <button type="button" aria-label="Хасах" onClick={() => cart.setQuantity(i.productId, i.variantId, i.quantity - 1)} className="grid h-full w-9 place-items-center">
                              <Minus className="size-3.5" aria-hidden="true" />
                            </button>
                            <output aria-live="polite" className="w-7 text-center text-sm font-bold tabular-nums">
                              {i.quantity}
                            </output>
                            <button type="button" aria-label="Нэмэх" disabled={i.quantity >= i.limit} onClick={() => cart.setQuantity(i.productId, i.variantId, i.quantity + 1)} className="grid h-full w-9 place-items-center disabled:text-slate-300">
                              <Plus className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {problem && <p className="text-xs font-medium text-warning-ink">{problem}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <CouponField coupon={cart.coupon} setCoupon={cart.setCoupon} result={quote?.coupon ?? undefined} />
            </div>

            <footer className="shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Барааны дүн</span>
                <span className="tabular-nums">{formatMNT(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Купон ({quote?.coupon?.code})</span>
                  <span className="text-danger tabular-nums">−{formatMNT(discount)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="font-bold">Нийт</span>
                <span className="text-2xl font-extrabold tabular-nums">{formatMNT(subtotal - discount)}</span>
              </div>
              <p className="text-xs text-slate-500">Хүргэлтийн төлбөрийг дүүрэг сонгосны дараа тооцно.</p>
              <button
                type="button"
                onClick={() => {
                  close();
                  router.push("/checkout");
                }}
                className="h-[52px] w-full rounded-md bg-brand text-base font-bold text-white transition-colors hover:bg-brand-700"
              >
                Захиалах
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
