"use client";

import { Check, Eye, ShoppingCart } from "lucide-react";
import { CATEGORY_LABEL, formatMNT, type Product } from "@/lib/catalog";
import Rating from "./Rating";
import SafeImage from "./SafeImage";

interface ProductCardProps {
  product: Product;
  quantityInCart: number;
  onAddToCart: (productId: string) => void;
  onQuickView: (productId: string) => void;
}

const BADGE_STYLES: Record<NonNullable<Product["badge"]>, string> = {
  "Хямдрал": "bg-rose-600 text-white",
  "Шинэ": "bg-emerald-600 text-white",
  "Эрэлттэй": "bg-slate-900 text-white",
};

/** Below this many units we surface scarcity — honest urgency, not a fake countdown. */
const LOW_STOCK_THRESHOLD = 5;

export default function ProductCard({ product, quantityInCart, onAddToCart, onQuickView }: ProductCardProps) {
  const soldOut = product.stock === 0;
  const reachedLimit = !soldOut && quantityInCart >= product.stock;
  const discountPct = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : 0;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/[0.07]">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <button
          type="button"
          onClick={() => onQuickView(product.id)}
          className="block h-full w-full"
          aria-label={`${product.title} — дэлгэрэнгүй харах`}
          tabIndex={-1 /* the labelled button below is the keyboard path; avoid a duplicate tab stop */}
        >
          <SafeImage
            src={product.image}
            alt={product.title}
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${soldOut ? "opacity-60 grayscale" : ""}`}
          />
        </button>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <span className="rounded-sm bg-slate-700 px-2 py-1 text-[11px] font-bold text-white">Дууссан</span>
          ) : (
            product.badge && (
              <span className={`rounded-sm px-2 py-1 text-[11px] font-bold ${BADGE_STYLES[product.badge]}`}>
                {product.badge}
              </span>
            )
          )}
          {discountPct > 0 && !soldOut && (
            <span className="rounded-sm bg-white px-2 py-1 text-[11px] font-bold text-rose-600 shadow-sm">
              −{discountPct}%
            </span>
          )}
        </div>

        {quantityInCart > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[11px] font-bold text-white shadow">
            <Check className="h-3 w-3" aria-hidden="true" />
            Сагсанд {quantityInCart}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-slate-500">
          {product.brand} <span aria-hidden="true">·</span> {CATEGORY_LABEL[product.category]}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-900">
          {product.title}
        </h3>

        <div className="mt-2">
          <Rating value={product.rating} count={product.reviewCount} />
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
          <p className="text-lg font-extrabold tracking-tight text-slate-900">{formatMNT(product.price)}</p>
          {product.compareAtPrice && (
            <p className="text-sm text-slate-400 line-through">{formatMNT(product.compareAtPrice)}</p>
          )}
        </div>

        <p className="mt-1 h-4 text-xs">
          {soldOut ? (
            <span className="text-slate-500">Удахгүй нөөц нэмэгдэнэ</span>
          ) : product.stock <= LOW_STOCK_THRESHOLD ? (
            <span className="font-semibold text-amber-600">Зөвхөн {product.stock} ширхэг үлдлээ</span>
          ) : (
            <span className="text-emerald-600">Агуулахад бэлэн</span>
          )}
        </p>

        <div className="mt-auto grid gap-2 pt-4">
          <button
            type="button"
            onClick={() => onAddToCart(product.id)}
            disabled={soldOut || reachedLimit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-bold text-white shadow-sm shadow-brand/20 transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            {soldOut ? "Дууссан" : reachedLimit ? "Үлдэгдэл хүрлээ" : "Сагсанд хийх"}
          </button>
          <button
            type="button"
            onClick={() => onQuickView(product.id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Дэлгэрэнгүй харах
          </button>
        </div>
      </div>
    </article>
  );
}
