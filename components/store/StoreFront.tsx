"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  SORT_OPTIONS,
  type CategoryFilter,
  type PriceBandId,
  type Product,
  type SortKey,
} from "@/lib/catalog";
import { applyCatalogQuery, countByCategory } from "@/lib/filtering";
import { CatalogProvider, type NavCategory } from "./CatalogContext";
import FilterBar from "./FilterBar";
import { useCart } from "./cart/CartProvider";
import ProductGrid from "./ProductGrid";
import ProductModal from "./ProductModal";

interface StoreFrontProps {
  /** Live catalog from the shared store; re-delivered by router.refresh() after admin edits or checkout. */
  products: Product[];
  /** Visible root categories for the tabs (hidden and empty ones already removed). */
  categories: NavCategory[];
  /** id → name for every category, including subcategories. */
  categoryNames: Record<string, string>;
  /** Server-rendered hero, slotted in so it stays out of the client bundle. */
  hero: ReactNode;
  /** Server-rendered sections shown after the catalog (trust markers, etc.). */
  children?: ReactNode;
}


export default function StoreFront({
  products,
  categories,
  categoryNames,
  hero,
  children,
}: StoreFrontProps) {
  const router = useRouter();
  // Catalog view state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priceBand, setPriceBand] = useState<PriceBandId>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  const [detailId, setDetailId] = useState<string | null>(null);
  const cart = useCart();

  const catalogRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);


  // Re-fetch the catalog when the shopper returns to the tab, so prices/stock are current.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const visibleProducts = useMemo(
    () => applyCatalogQuery(products, { query, category, priceBand, sort }, categoryNames),
    [products, query, category, priceBand, sort, categoryNames],
  );

  const categoryCounts = useMemo(
    () => countByCategory(products, { query, priceBand }, categoryNames),
    [products, query, priceBand, categoryNames],
  );

  const quantities = useMemo(
    () => Object.fromEntries(cart.items.map((i) => [i.productId, cart.quantityOf(i.productId)])) as Record<string, number>,
    [cart],
  );

  const addToCart = useCallback(
    (productId: string, amount = 1) => {
      const product = productById.get(productId);
      if (product) cart.add(product, { quantity: amount });
    },
    [productById, cart],
  );

  const handleModalAdd = useCallback(
    (productId: string, amount: number) => {
      addToCart(productId, amount);
      setDetailId(null);
    },
    [addToCart],
  );

  /**
   * Result navigation. Scrolling must happen *after* the grid re-renders — measuring
   * before would target where the old, longer list ended. So handlers only request a
   * reveal; the effect below performs it once the new results are in the DOM.
   *
   * "force"  — explicit navigation (header tabs, hero tiles, Enter in search): always jump.
   * "soft"   — in-place refinement (filter tabs, sort, price, typing): jump only when the
   *            first result is off-screen, e.g. the shopper was deep in a long list that
   *            just shrank, or is still up in the hero while typing.
   */
  const [revealRequest, setRevealRequest] = useState<{ mode: "force" | "soft"; tick: number } | null>(null);
  const requestReveal = useCallback((mode: "force" | "soft") => {
    setRevealRequest((prev) => ({
      mode: prev?.mode === "force" ? "force" : mode,
      tick: (prev?.tick ?? 0) + 1,
    }));
  }, []);

  useEffect(() => {
    if (!revealRequest) return;
    const target = resultsRef.current;
    if (!target) return;

    const headerBottom = document.getElementById("site-header")?.getBoundingClientRect().bottom ?? 0;
    const top = target.getBoundingClientRect().top;
    const firstResultVisible = top >= headerBottom - 1 && top <= window.innerHeight * 0.6;

    if (revealRequest.mode === "force" || !firstResultVisible) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setRevealRequest(null);
  }, [revealRequest]);

  const updateCategory = useCallback(
    (next: CategoryFilter, mode: "force" | "soft") => {
      setCategory(next);
      requestReveal(mode);
    },
    [requestReveal],
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      requestReveal("soft");
    },
    [requestReveal],
  );

  // Hero tiles are server-rendered links (#category-toys …). Translating the hash into
  // state here keeps the hero JS-free and makes category links shareable.
  useEffect(() => {
    const applyHash = () => {
      const match = /^#category-([a-z0-9-]+)$/.exec(window.location.hash);
      if (!match) return;
      // A link to a hidden or empty category falls back to all products.
      const known = match[1] === "all" || categories.some((c) => c.id === match[1]);
      updateCategory(known ? match[1] : "all", "force");
      // Strip the hash so clicking the same tile again fires another hashchange.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [updateCategory, categories]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
    setPriceBand("all");
    setSort("featured");
    requestReveal("soft");
  }, [requestReveal]);

  const closeDetail = useCallback(() => setDetailId(null), []);

  const detailProduct = detailId ? (productById.get(detailId) ?? null) : null;

  return (
    <CatalogProvider categories={categories} names={categoryNames}>
      <main id="top">
        {hero}

        <section
          id="catalog"
          ref={catalogRef}
          aria-labelledby="catalog-title"
          className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8"
        >
          <FilterBar
            category={category}
            onCategoryChange={(c) => updateCategory(c, "soft")}
            counts={categoryCounts}
            priceBand={priceBand}
            onPriceBandChange={(b) => {
              setPriceBand(b);
              requestReveal("soft");
            }}
            sort={sort}
            onSortChange={(s) => {
              setSort(s);
              requestReveal("soft");
            }}
            query={query}
            onClearQuery={() => handleQueryChange("")}
            resultCount={visibleProducts.length}
            onReset={resetFilters}
          />
          <div ref={resultsRef} id="results" className="mt-8">
            <ResultsContext
              label={category === "all" ? "Бүх бараа" : (categoryNames[category] ?? "Бүх бараа")}
              count={visibleProducts.length}
              sortLabel={SORT_OPTIONS.find((o) => o.id === sort)?.label ?? ""}
            />
            <ProductGrid
              products={visibleProducts}
              quantities={quantities}
              query={query}
              onAddToCart={addToCart}
              onQuickView={setDetailId}
              onReset={resetFilters}
              matchesInOtherCategories={category === "all" ? 0 : categoryCounts.all}
              onSearchAllCategories={() => updateCategory("all", "soft")}
            />
          </div>
        </section>

        {children}
      </main>

      <ProductModal
        product={detailProduct}
        quantityInCart={detailId ? (quantities[detailId] ?? 0) : 0}
        onClose={closeDetail}
        onAddToCart={handleModalAdd}
      />

    </CatalogProvider>
  );
}

/**
 * Landing strip for result jumps: after a scroll, the shopper immediately sees which
 * category they're in and has a one-tap way back to the filter controls.
 */
function ResultsContext({ label, count, sortLabel }: { label: string; count: number; sortLabel: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <p className="text-sm text-slate-600">
        <span className="font-bold text-slate-900">{label}</span>
        <span className="mx-2 text-slate-300" aria-hidden="true">/</span>
        <span className="tabular-nums">{count} бараа</span>
        <span className="mx-2 hidden text-slate-300 sm:inline" aria-hidden="true">/</span>
        <span className="hidden sm:inline">{sortLabel}</span>
      </p>
      <a
        href="#catalog"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand transition hover:text-brand-dark"
      >
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        Шүүлтүүр
      </a>
    </div>
  );
}
