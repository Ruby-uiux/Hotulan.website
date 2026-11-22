"use client";

import { useState } from "react";
import { Chip } from "@/components/ui";
import type { Product } from "@/lib/catalog";
import ProductCard from "../product/ProductCard";

/** "Шинэ ирсэн бараа" with category chips (design/Home). Filtering is client-side over the 10 newest. */
export default function NewArrivals({
  title,
  products,
  tabs,
  icons,
}: {
  title: string;
  products: Product[];
  /** Root categories present among `products`, most common first. */
  tabs: { id: string; label: string }[];
  /** category id → icon key, for photo placeholders. */
  icons: Record<string, string | null>;
}) {
  const [tab, setTab] = useState("all");
  const shown = tab === "all" ? products : products.filter((p) => p.category === tab);

  return (
    <section aria-labelledby="new-arrivals" className="flex flex-col gap-4 lg:gap-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="new-arrivals" className="text-xl font-extrabold tracking-[-0.02em] lg:text-[26px]">
          {title}
        </h2>
        {tabs.length > 1 && (
          <div role="group" aria-label="Ангилал сонгох" className="hidden flex-wrap gap-1.5 sm:flex">
            <Chip selected={tab === "all"} onClick={() => setTab("all")}>
              Бүгд
            </Chip>
            {tabs.map((t) => (
              <Chip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-4">
        {shown.map((p) => (
          <ProductCard key={p.id} product={p} icon={icons[p.category] ?? null} button="outline" />
        ))}
      </div>
    </section>
  );
}
