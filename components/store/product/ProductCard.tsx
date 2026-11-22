"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { discountPercent, formatMNT, purchaseLimit, type Product } from "@/lib/catalog";
import { cn } from "@/components/ui";
import { useCart } from "../cart/CartProvider";
import ProductImage from "./ProductImage";

/** Top-left label: sold out beats discount beats the admin badge. */
function Label({ product }: { product: Product }) {
  const pct = discountPercent(product);
  const base = "absolute top-2.5 left-2.5 rounded-sm px-2 py-1 text-xs leading-none font-bold text-white";
  if (product.stock <= 0) return <span className={cn(base, "bg-slate-600")}>Дууссан</span>;
  if (pct > 0) return <span className={cn(base, "bg-danger")}>−{pct}%</span>;
  if (product.badge === "Шинэ") return <span className={cn(base, "bg-brand")}>Шинэ</span>;
  if (product.badge === "Эрэлттэй") return <span className={cn(base, "bg-slate-900")}>Эрэлттэй</span>;
  return null;
}

export interface ProductCardProps {
  product: Product;
  /** Category line icon for the photo placeholder. */
  icon: string | null;
  /** "solid" (deals, category grid) or "outline" (new arrivals) add-to-cart button. */
  button?: "solid" | "outline" | "none";
  /** Eager-load the photo (first row above the fold). */
  priority?: boolean;
  className?: string;
}

/**
 * design/Components ProductCard. On phones it switches to the compact card from
 * design/MHome: smaller type and a square "+" next to the price.
 * Ratings are not shown — there are no real reviews yet (flaw #17).
 */
export default function ProductCard({ product, icon, button = "solid", priority, className }: ProductCardProps) {
  const cart = useCart();
  const href = `/p/${product.id}`;
  const soldOut = product.stock <= 0;
  const hasVariants = product.variants.length > 0;
  const atLimit = !soldOut && cart.ready && cart.quantityOf(product.id) >= purchaseLimit(product);
  const onSale = discountPercent(product) > 0;
  const disabled = soldOut || atLimit;
  const label = soldOut ? "Дууссан" : atLimit ? "Сагсанд байна" : hasVariants ? "Сонгох" : "Сагсанд нэмэх";

  const addToCart = () => {
    if (!hasVariants) cart.add(product);
  };

  const action = hasVariants ? (
    <Link
      href={href}
      className={cn(
        "flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold transition-colors",
        button === "outline" ? "border border-brand bg-white text-brand hover:bg-brand-50" : "bg-brand text-white hover:bg-brand-700",
      )}
    >
      {label}
    </Link>
  ) : (
    <button
      type="button"
      onClick={addToCart}
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400",
        button === "outline" ? "border border-brand bg-white text-brand hover:bg-brand-50" : "bg-brand text-white hover:bg-brand-700",
      )}
    >
      {label}
    </button>
  );

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-square">
        <ProductImage
          id={product.id}
          src={product.image}
          alt=""
          icon={icon}
          eager={priority}
          className={cn("h-full w-full", soldOut && "opacity-60 grayscale")}
        />
        <Label product={product} />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-1.5 sm:p-3.5">
        {product.brand && <span className="hidden text-xs font-medium text-slate-500 sm:block">{product.brand}</span>}
        <Link href={href} className="line-clamp-2 min-h-[35px] text-[13px] leading-[1.35] font-semibold hover:text-brand sm:min-h-[39px] sm:text-sm sm:leading-[1.4]">
          {product.title}
        </Link>
        <div className="mt-auto flex items-center justify-between gap-2 sm:block">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("text-[15px] font-extrabold tabular-nums sm:text-[17px]", onSale && "text-danger")}>{formatMNT(product.price)}</span>
            {onSale && <span className="text-xs text-slate-500 line-through tabular-nums sm:text-[13px]">{formatMNT(product.compareAtPrice!)}</span>}
          </span>
          {button !== "none" &&
            (hasVariants ? (
              <Link href={href} aria-label={`${product.title} — сонгох`} className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white sm:hidden">
                <Plus className="size-5" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={addToCart}
                disabled={disabled}
                aria-label={disabled ? `${product.title} — ${label}` : `${product.title} — сагсанд нэмэх`}
                className="grid size-9 shrink-0 place-items-center rounded-md bg-brand text-white disabled:bg-slate-200 disabled:text-slate-400 sm:hidden"
              >
                <Plus className="size-5" aria-hidden="true" />
              </button>
            ))}
        </div>
        {button !== "none" && <div className="mt-1.5 hidden sm:block">{action}</div>}
      </div>
    </article>
  );
}
