"use client";

import { ArrowUp, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CATEGORY_LABEL,
  SORT_OPTIONS,
  type CartLine,
  type CategoryFilter,
  type PriceBandId,
  type Product,
  type SortKey,
} from "@/lib/catalog";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import type { Order } from "@/lib/admin-data";
import { applyCatalogQuery, countByCategory } from "@/lib/filtering";
import CartDrawer, { type CartItem, type CheckoutDetails, type PlacedOrder } from "./CartDrawer";
import FilterBar from "./FilterBar";
import Header from "./Header";
import ProductGrid from "./ProductGrid";
import ProductModal from "./ProductModal";

interface StoreFrontProps {
  /** Live catalog from the shared store; re-delivered by router.refresh() after admin edits or checkout. */
  products: Product[];
  freeDeliveryThreshold: number;
  supportPhone: string;
  /** Server-rendered hero, slotted in so it stays out of the client bundle. */
  hero: ReactNode;
  /** Server-rendered sections shown after the catalog (trust markers, etc.). */
  children?: ReactNode;
}

interface ToastState {
  id: number;
  message: string;
}

const TOAST_DURATION_MS = 2600;

const CART_STORAGE_KEY = "hotulan.cart.v1";

export default function StoreFront({ products, freeDeliveryThreshold, supportPhone, hero, children }: StoreFrontProps) {
  const router = useRouter();
  // Catalog view state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priceBand, setPriceBand] = useState<PriceBandId>("all");
  const [sort, setSort] = useState<SortKey>("featured");

  // Commerce state
  const [cart, setCart] = useState<CartLine[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const catalogRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ——— Cart persistence ———
  // Restored after mount (not in the initial state) so server and client HTML match.
  const [cartRestored, setCartRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]") as CartLine[];
      if (Array.isArray(saved)) {
        setCart(saved.filter((l) => typeof l?.productId === "string" && Number.isInteger(l?.quantity) && l.quantity > 0));
      }
    } catch {
      // Private mode or corrupted value: start with an empty cart.
    }
    setCartRestored(true);
  }, []);

  useEffect(() => {
    if (!cartRestored) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage full/blocked — the cart still works for this visit.
    }
  }, [cart, cartRestored]);

  /**
   * Stock is owned by the server and can change under us (admin edits, other shoppers).
   * Whenever fresh products arrive, clamp cart lines to what's actually available.
   */
  useEffect(() => {
    if (!cartRestored) return;
    setCart((prev) => {
      let changed = false;
      const next = prev.flatMap((line) => {
        const product = productById.get(line.productId);
        const quantity = Math.min(line.quantity, product?.stock ?? 0);
        if (quantity !== line.quantity) changed = true;
        return quantity > 0 ? [{ ...line, quantity }] : [];
      });
      return changed ? next : prev;
    });
  }, [productById, cartRestored]);

  // Re-fetch the catalog when the shopper returns to the tab, so prices/stock are current.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  const visibleProducts = useMemo(
    () => applyCatalogQuery(products, { query, category, priceBand, sort }),
    [products, query, category, priceBand, sort],
  );

  const categoryCounts = useMemo(
    () => countByCategory(products, { query, priceBand }),
    [products, query, priceBand],
  );

  // Lines whose product vanished from the catalog (e.g. delisted between sessions) are dropped silently.
  const cartItems = useMemo<CartItem[]>(
    () =>
      cart.flatMap((line) => {
        const product = productById.get(line.productId);
        return product ? [{ product, quantity: line.quantity }] : [];
      }),
    [cart, productById],
  );

  const quantities = useMemo(
    () => Object.fromEntries(cart.map((l) => [l.productId, l.quantity])) as Record<string, number>,
    [cart],
  );

  const cartCount = useMemo(() => cartItems.reduce((n, i) => n + i.quantity, 0), [cartItems]);
  const subtotal = useMemo(() => cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0), [cartItems]);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /**
   * Single source of truth for quantity changes. Clamps to [0, stock] so no UI path
   * (double clicks, modal + card, stale props) can oversell; 0 removes the line.
   */
  const setLineQuantity = useCallback(
    (productId: string, next: (current: number) => number) => {
      const product = productById.get(productId);
      if (!product) return;

      setCart((prev) => {
        const existing = prev.find((l) => l.productId === productId);
        const current = existing?.quantity ?? 0;
        const target = Math.max(0, Math.min(product.stock, next(current)));

        if (target === current) return prev;
        if (target === 0) return prev.filter((l) => l.productId !== productId);
        if (!existing) return [...prev, { productId, quantity: target }];
        return prev.map((l) => (l.productId === productId ? { ...l, quantity: target } : l));
      });
    },
    [productById],
  );

  const addToCart = useCallback(
    (productId: string, amount = 1) => {
      const product = productById.get(productId);
      if (!product || product.stock === 0) return;

      const alreadyInCart = quantities[productId] ?? 0;
      const addable = Math.min(amount, product.stock - alreadyInCart);
      if (addable <= 0) {
        showToast("Энэ барааны үлдэгдэл таны сагсанд бүрэн орсон байна");
        return;
      }
      setLineQuantity(productId, (q) => q + addable);
      showToast(addable < amount ? `Үлдэгдлийн хэмжээгээр ${addable} ширхэг нэмэгдлээ` : "Сагсанд нэмэгдлээ");
    },
    [productById, quantities, setLineQuantity, showToast],
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
      const match = /^#category-(all|toys|home|electronics|sports)$/.exec(window.location.hash);
      if (!match) return;
      updateCategory(match[1] as CategoryFilter, "force");
      // Strip the hash so clicking the same tile again fires another hashchange.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [updateCategory]);

  const resetFilters = useCallback(() => {
    setQuery("");
    setCategory("all");
    setPriceBand("all");
    setSort("featured");
    requestReveal("soft");
  }, [requestReveal]);

  const placeOrder = useCallback(
    async (details: CheckoutDetails): Promise<PlacedOrder> => {
      try {
        const { order, total } = await api<{ order: Order; total: number }>("/api/orders", {
          method: "POST",
          body: { ...details, lines: cart.map(({ productId, quantity }) => ({ productId, quantity })) },
        });
        setCart([]);
        router.refresh(); // pull the decremented stock into the grid
        return { id: order.id, total, itemCount: order.lines.reduce((n, l) => n + l.quantity, 0) };
      } catch (err) {
        // Stock conflict: refresh so the cart clamps to real availability, then let the shopper retry.
        if (err instanceof ApiError && err.status === 409) router.refresh();
        throw err;
      }
    },
    [cart, router],
  );

  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeDetail = useCallback(() => setDetailId(null), []);

  const detailProduct = detailId ? (productById.get(detailId) ?? null) : null;

  return (
    <>
      <Header
        query={query}
        onQueryChange={handleQueryChange}
        onSearchSubmit={() => requestReveal("force")}
        category={category}
        onCategoryChange={(c) => updateCategory(c, "force")}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        freeDeliveryThreshold={freeDeliveryThreshold}
        supportPhone={supportPhone}
      />

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
              category={category}
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

      <CartDrawer
        open={isCartOpen}
        onClose={closeCart}
        items={cartItems}
        subtotal={subtotal}
        onIncrement={(id) => setLineQuantity(id, (q) => q + 1)}
        onDecrement={(id) => setLineQuantity(id, (q) => q - 1)}
        onRemove={(id) => setLineQuantity(id, () => 0)}
        freeDeliveryThreshold={freeDeliveryThreshold}
        onPlaceOrder={placeOrder}
      />

      <ProductModal
        product={detailProduct}
        quantityInCart={detailId ? (quantities[detailId] ?? 0) : 0}
        onClose={closeDetail}
        onAddToCart={handleModalAdd}
      />

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60]">
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto absolute left-1/2 flex w-[calc(100%-2rem)] max-w-sm animate-toast-in items-center gap-3 rounded-2xl bg-slate-900 py-3 pl-4 pr-3 text-sm text-white shadow-2xl"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
            <span className="flex-1 font-medium">{toast.message}</span>
            <button
              type="button"
              onClick={() => {
                setToast(null);
                setCartOpen(true);
              }}
              className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20"
            >
              Сагс харах
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Landing strip for result jumps: after a scroll, the shopper immediately sees which
 * category they're in and has a one-tap way back to the filter controls.
 */
function ResultsContext({ category, count, sortLabel }: { category: CategoryFilter; count: number; sortLabel: string }) {
  const label = category === "all" ? "Бүх бараа" : CATEGORY_LABEL[category];
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
