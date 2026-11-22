"use client";

import { Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/components/ui";
import { MAX_PER_PRODUCT, discountPercent, formatMNT, type Product } from "@/lib/catalog";
import { computeDeliveryFee, estimateDelivery, type DeliveryZone } from "@/lib/delivery";
import { useCart } from "../cart/CartProvider";

/** Swatch colours for common colour names; other option values render as text pills. */
const COLORS: Record<string, string> = {
  хар: "#0f172a",
  цагаан: "#ffffff",
  мөнгөлөг: "#cbd5e1",
  саарал: "#94a3b8",
  цэнхэр: "#1e3a8a",
  хөх: "#2563eb",
  улаан: "#dc2626",
  ногоон: "#16a34a",
  шар: "#facc15",
  ягаан: "#ec4899",
  бор: "#92400e",
  алтлаг: "#d4af37",
};

const ZONE_KEY = "hotulan.zone";

export interface ProductPurchaseProps {
  product: Product;
  zones: DeliveryZone[];
  freeDeliveryThreshold: number;
  oversizedFee: number;
  nextDayCutoff: string;
  returnDays: number;
}

export default function ProductPurchase({ product, zones, freeDeliveryThreshold, oversizedFee, nextDayCutoff, returnDays }: ProductPurchaseProps) {
  const router = useRouter();
  const cart = useCart();
  const variants = product.variants;
  const [variantId, setVariantId] = useState<string | null>(variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? null);
  const variant = variants.find((v) => v.id === variantId) ?? null;
  const price = variant?.price ?? product.price;
  const stock = Math.max(0, variant ? variant.stock : product.stock);
  const inCart = cart.ready ? cart.quantityOf(product.id) : 0;
  const available = Math.max(0, Math.min(stock, MAX_PER_PRODUCT - inCart));
  const [qty, setQty] = useState(1);
  useEffect(() => setQty((q) => Math.max(1, Math.min(q, available || 1))), [available]);

  // Remember the shopper's district between products (and for checkout).
  const [zoneId, setZoneId] = useState(zones.find((z) => z.region === "central")?.id ?? zones[0]?.id ?? "");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ZONE_KEY);
      if (saved && zones.some((z) => z.id === saved)) setZoneId(saved);
    } catch {}
  }, [zones]);
  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const delivery = useMemo(() => {
    if (!zone) return null;
    const fee = computeDeliveryFee({ zone, subtotal: price * qty, freeDeliveryThreshold, hasOversized: product.oversized, oversizedFee });
    return { fee, when: now === null ? null : estimateDelivery(zone, nextDayCutoff, now) };
  }, [zone, price, qty, freeDeliveryThreshold, product.oversized, oversizedFee, nextDayCutoff, now]);

  const compareAt = variant ? null : product.compareAtPrice;
  const savings = compareAt && compareAt > price ? compareAt - price : 0;
  const soldOut = stock === 0;
  const blocked = soldOut || available === 0;

  const add = () => cart.add(product, { variantId, quantity: qty });
  const buyNow = () => {
    if (!blocked) cart.add(product, { variantId, quantity: qty, silent: true });
    router.push("/checkout");
  };

  const stockLine = soldOut ? (
    <span className="font-semibold text-slate-500">● Дууссан</span>
  ) : (
    <span className="font-semibold text-success">● Бэлэн байгаа{stock <= 20 ? ` (${stock})` : ""}</span>
  );

  return (
    <>
      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
        {product.sku && <span>Код: {product.sku}</span>}
        {stockLine}
      </div>

      <div className="flex flex-wrap items-baseline gap-3 border-slate-200 lg:border-y lg:py-4">
        <span className={cn("text-[28px] font-extrabold tracking-[-0.02em] tabular-nums lg:text-[32px]", savings > 0 && "max-lg:text-slate-900")}>{formatMNT(price)}</span>
        {savings > 0 && (
          <>
            <span className="text-[15px] text-slate-500 line-through tabular-nums lg:text-[17px]">{formatMNT(compareAt!)}</span>
            <span className="rounded-sm bg-danger-soft px-2 py-1 text-[13px] font-bold text-red-700">
              <span className="lg:hidden">−{discountPercent({ price, compareAtPrice: compareAt! })}%</span>
              <span className="hidden lg:inline">{formatMNT(savings)} хэмнэнэ</span>
            </span>
          </>
        )}
      </div>

      {variants.length > 0 && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold">
            {variants[0].option}: <span className="font-normal text-slate-600">{variant?.name}</span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {variants.map((v) => {
              const color = COLORS[v.name.trim().toLowerCase()];
              const selected = v.id === variantId;
              return color ? (
                <button
                  key={v.id}
                  type="button"
                  aria-label={`${v.name}${v.stock === 0 ? " (дууссан)" : ""}`}
                  aria-pressed={selected}
                  onClick={() => setVariantId(v.id)}
                  className={cn("size-11 rounded-full border-[3px] border-white", selected ? "shadow-[0_0_0_2px_var(--color-brand)]" : "shadow-[0_0_0_1px_var(--color-slate-300)]", v.stock === 0 && "opacity-40")}
                  style={{ background: color }}
                />
              ) : (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setVariantId(v.id)}
                  className={cn(
                    "h-10 rounded-md border px-4 text-sm font-medium",
                    selected ? "border-2 border-brand bg-brand-50 text-brand-700" : "border-slate-300 bg-white",
                    v.stock === 0 && "text-slate-400 line-through",
                  )}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Desktop actions (design/Product). The heart ("Хадгалах") arrives with saved lists in phase 6. */}
      <div className="hidden flex-wrap items-center gap-3 lg:flex">
        <div className="flex h-[50px] items-center rounded-md border border-slate-300" role="group" aria-label="Тоо ширхэг">
          <button type="button" aria-label="Хасах" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="grid h-12 w-[46px] place-items-center disabled:text-slate-300">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <output aria-live="polite" className="w-10 text-center font-bold tabular-nums">
            {qty}
          </output>
          <button type="button" aria-label="Нэмэх" disabled={qty >= available} onClick={() => setQty((q) => q + 1)} className="grid h-12 w-[46px] place-items-center disabled:text-slate-300">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={blocked}
          className="h-[50px] flex-[1_1_160px] rounded-md border-[1.5px] border-brand bg-white text-[15px] font-bold text-brand transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {soldOut ? "Дууссан" : available === 0 ? `Сагсанд ${inCart} байна` : "Сагсанд нэмэх"}
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut}
          className="h-[50px] flex-[1_1_160px] rounded-md bg-brand text-[15px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          Шууд авах
        </button>
      </div>
      {available === 0 && !soldOut && inCart > 0 && (
        <p className="text-[13px] text-warning-ink">Нэг захиалгад {MAX_PER_PRODUCT} ширхэг хүртэл — сагсанд {inCart} байна.</p>
      )}

      {/* Delivery & warranty (design/Product box; design/MProduct table). No "official" wording (flaw #17). */}
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white">
        <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3.5">
          <Truck className="mt-0.5 hidden size-5 shrink-0 text-brand lg:block" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-bold">Хүргэлт — зөвхөн Улаанбаатар</span>
            {zones.length > 0 && (
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                Дүүрэг
                <select
                  value={zoneId}
                  onChange={(e) => {
                    setZoneId(e.target.value);
                    try {
                      window.localStorage.setItem(ZONE_KEY, e.target.value);
                    } catch {}
                  }}
                  className="h-9 rounded-sm border border-slate-300 bg-white px-2 text-[13px] font-medium text-slate-900"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {delivery && (
              <span className="text-[13px] text-slate-600">
                {delivery.when ? `${delivery.when.label} хүргэнэ · ` : ""}
                {delivery.fee === 0 ? <span className="font-semibold text-success">Үнэгүй</span> : formatMNT(delivery.fee)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5 text-sm">
          <ShieldCheck className="size-5 shrink-0 text-brand" aria-hidden="true" />
          <span>
            {product.warrantyMonths > 0 ? (
              <>
                <b>{product.warrantyMonths} сарын</b> баталгаа ·{" "}
              </>
            ) : null}
            {returnDays} хоногт буцаах боломжтой
          </span>
        </div>
      </div>

      {/* Phones: sticky buy bar (design/MProduct). */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={add}
          disabled={blocked}
          className="h-[52px] flex-1 rounded-md border-[1.5px] border-brand bg-white text-base font-bold text-brand disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {soldOut ? "Дууссан" : "Сагсанд"}
        </button>
        <button
          type="button"
          onClick={buyNow}
          disabled={soldOut}
          className="h-[52px] flex-[1.2] rounded-md bg-brand text-base font-bold text-white disabled:bg-slate-100 disabled:text-slate-400"
        >
          Шууд авах
        </button>
      </div>
    </>
  );
}
