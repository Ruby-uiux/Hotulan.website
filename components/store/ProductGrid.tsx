"use client";

import { SearchX } from "lucide-react";
import type { Product } from "@/lib/catalog";
import ProductCard from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  quantities: Record<string, number>;
  query: string;
  onAddToCart: (productId: string) => void;
  onQuickView: (productId: string) => void;
  onReset: () => void;
  /** Matches for the same search/price outside the active category — rescues "wrong tab" searches. */
  matchesInOtherCategories: number;
  onSearchAllCategories: () => void;
}

export default function ProductGrid({
  products,
  quantities,
  query,
  onAddToCart,
  onQuickView,
  onReset,
  matchesInOtherCategories,
  onSearchAllCategories,
}: ProductGridProps) {
  if (products.length === 0) {
    const trimmed = query.trim();
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
          <SearchX className="h-7 w-7" aria-hidden="true" />
        </div>
        <h3 className="mt-5 text-lg font-bold text-slate-900">
          {trimmed ? `“${trimmed}” хайлтад тохирох бараа олдсонгүй` : "Энэ шүүлтүүрт тохирох бараа алга"}
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          Үгийн зөв бичгийг шалгах, илүү ерөнхий үг (жишээ нь: “чихэвч”, “тоглоом”) ашиглах эсвэл үнийн хүрээг
          өргөсгөж үзнэ үү.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {matchesInOtherCategories > 0 && (
            <button
              type="button"
              onClick={onSearchAllCategories}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              Бүх ангилалд хайх ({matchesInOtherCategories})
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className={
              matchesInOtherCategories > 0
                ? "rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                : "rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            }
          >
            Бүх барааг харах
          </button>
        </div>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="flex">
          <div className="flex w-full flex-col [&>article]:flex-1">
            <ProductCard
              product={product}
              quantityInCart={quantities[product.id] ?? 0}
              onAddToCart={onAddToCart}
              onQuickView={onQuickView}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
