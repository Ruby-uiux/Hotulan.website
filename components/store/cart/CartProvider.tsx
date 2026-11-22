"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MAX_PER_PRODUCT, type Product, type ProductVariant } from "@/lib/catalog";
import { useToast } from "@/components/ui";

/**
 * The shopping cart, shared by every storefront page (header badge, product cards,
 * product page, drawer, checkout). Lives in the (store) layout, persists to localStorage.
 *
 * Only ids and quantities are stored. Titles, prices and stock always come from the
 * server (GET /api/products?ids=…), so a stale browser can never show yesterday's price,
 * and lines are clamped to what is actually available whenever fresh data arrives.
 */

export interface CartEntry {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface CartItem extends CartEntry {
  /** Stable key for lists: product + variant. */
  key: string;
  product: Product;
  variant: ProductVariant | null;
  /** Unit price (variant price when a variant is chosen). */
  unitPrice: number;
  /** Most this line may hold right now: stock, and the per-product order cap. */
  limit: number;
}

interface CartContextValue {
  /** False until localStorage has been read — render counts only after this to avoid hydration drift. */
  ready: boolean;
  items: CartItem[];
  /** Total units. */
  count: number;
  subtotal: number;
  /** Units of a product already in the cart, all variants together. */
  quantityOf: (productId: string) => number;
  /** Adds up to `quantity`, clamped to stock and MAX_PER_PRODUCT. Returns how many were added. */
  add: (product: Product, options?: { variantId?: string | null; quantity?: number; silent?: boolean }) => number;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  /** Re-reads prices and stock from the server (e.g. after a 409 at checkout). */
  refresh: () => Promise<void>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Coupon typed in the cart or at checkout; validated by the quote, carried between them. */
  coupon: string | null;
  setCoupon: (code: string | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export const CART_STORAGE_KEY = "hotulan.cart.v2";
/** The single-page store (before phase 4) saved `[{ productId, quantity }]` here. */
export const LEGACY_CART_STORAGE_KEY = "hotulan.cart.v1";
const COUPON_STORAGE_KEY = "hotulan.coupon";

const keyOf = (productId: string, variantId: string | null) => `${productId}::${variantId ?? ""}`;

function isEntryLike(v: unknown): v is { productId: string; variantId?: unknown; quantity: number } {
  const o = v as Record<string, unknown> | null;
  return (
    !!o && typeof o.productId === "string" && o.productId.length > 0 && Number.isInteger(o.quantity) && (o.quantity as number) > 0
  );
}

/** Parses either storage format into entries, merging duplicates. Garbage is dropped, never thrown. */
export function parseStoredCart(raw: string | null): CartEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const merged = new Map<string, CartEntry>();
  for (const v of data) {
    if (!isEntryLike(v)) continue;
    const variantId = typeof v.variantId === "string" && v.variantId ? v.variantId : null;
    const k = keyOf(v.productId, variantId);
    const prev = merged.get(k);
    merged.set(k, { productId: v.productId, variantId, quantity: (prev?.quantity ?? 0) + v.quantity });
  }
  return [...merged.values()];
}

/** v2 if present, otherwise the legacy v1 cart (migrated on the next save). */
function readStoredCart(): CartEntry[] {
  try {
    const current = window.localStorage.getItem(CART_STORAGE_KEY);
    if (current !== null) return parseStoredCart(current);
    return parseStoredCart(window.localStorage.getItem(LEGACY_CART_STORAGE_KEY));
  } catch {
    // Private mode / blocked storage: start empty, the cart still works for this visit.
    return [];
  }
}

function stockOf(product: Product, variant: ProductVariant | null): number {
  return Math.max(0, variant ? variant.stock : product.stock);
}

/** Line limit: its own stock, and whatever is left of the per-product cap after the product's other lines. */
function lineLimit(entries: CartEntry[], product: Product, variantId: string | null): number {
  const variant = variantId ? (product.variants.find((v) => v.id === variantId) ?? null) : null;
  const others = entries
    .filter((e) => e.productId === product.id && e.variantId !== variantId)
    .reduce((n, e) => n + e.quantity, 0);
  return Math.max(0, Math.min(stockOf(product, variant), MAX_PER_PRODUCT - others));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(() => new Map());
  const [isOpen, setOpen] = useState(false);
  const [coupon, setCouponState] = useState<string | null>(null);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const productsRef = useRef(products);
  productsRef.current = products;

  // Restore after mount so the server HTML (empty cart) and the first client render match.
  useEffect(() => {
    setEntries(readStoredCart());
    try {
      setCouponState(window.localStorage.getItem(COUPON_STORAGE_KEY));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
      // The legacy cart now lives in v2; drop it so it can't resurrect removed lines.
      window.localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {
      // Storage full/blocked — keep working in memory.
    }
  }, [entries, ready]);

  // Another tab changed the cart: follow it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) setEntries(parseStoredCart(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const cacheProducts = useCallback((list: Product[]) => {
    if (list.length === 0) return;
    setProducts((prev) => {
      const next = new Map(prev);
      for (const p of list) next.set(p.id, p);
      return next;
    });
  }, []);

  /** Fetches the given ids (or every cart product) and clamps lines to fresh stock. */
  const fetchProducts = useCallback(
    async (ids?: string[]) => {
      const wanted = [...new Set(ids ?? entriesRef.current.map((e) => e.productId))];
      if (wanted.length === 0) return;
      let list: Product[];
      try {
        const res = await fetch(`/api/products?ids=${wanted.map(encodeURIComponent).join(",")}`, { cache: "no-store" });
        if (!res.ok) return;
        list = ((await res.json()) as { products: Product[] }).products;
      } catch {
        return; // Offline: keep what we have rather than emptying the cart.
      }
      cacheProducts(list);
      const fresh = new Map(list.map((p) => [p.id, p]));
      setEntries((prev) => {
        let changed = false;
        const next: CartEntry[] = [];
        for (let i = 0; i < prev.length; i++) {
          const e = prev[i];
          if (!wanted.includes(e.productId)) {
            next.push(e);
            continue;
          }
          const p = fresh.get(e.productId);
          // Delisted, or its variant was removed: the line goes.
          if (!p || (e.variantId && !p.variants.some((v) => v.id === e.variantId))) {
            changed = true;
            continue;
          }
          // Siblings = lines already clamped + lines still to come; earlier lines win the per-product cap.
          const q = Math.min(e.quantity, lineLimit([...next, ...prev.slice(i + 1)], p, e.variantId));
          if (q !== e.quantity) changed = true;
          if (q > 0) next.push(q === e.quantity ? e : { ...e, quantity: q });
        }
        return changed ? next : prev;
      });
    },
    [cacheProducts],
  );

  // Hydrate unknown lines (first load, legacy carts, another tab).
  const missing = useMemo(
    () => [...new Set(entries.map((e) => e.productId))].filter((id) => !products.has(id)),
    [entries, products],
  );
  const missingKey = missing.join(",");
  useEffect(() => {
    if (ready && missingKey) void fetchProducts(missingKey.split(","));
  }, [ready, missingKey, fetchProducts]);

  // Prices and stock may have moved while the tab was in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchProducts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchProducts]);

  const items = useMemo<CartItem[]>(
    () =>
      entries.flatMap((e) => {
        const product = products.get(e.productId);
        if (!product) return [];
        const variant = e.variantId ? (product.variants.find((v) => v.id === e.variantId) ?? null) : null;
        if (e.variantId && !variant) return [];
        return [
          {
            ...e,
            key: keyOf(e.productId, e.variantId),
            product,
            variant,
            unitPrice: variant?.price ?? product.price,
            limit: lineLimit(entries, product, e.variantId),
          },
        ];
      }),
    [entries, products],
  );

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items]);

  const quantityOf = useCallback(
    (productId: string) => entries.filter((e) => e.productId === productId).reduce((n, e) => n + e.quantity, 0),
    [entries],
  );

  const add = useCallback<CartContextValue["add"]>(
    (product, options = {}) => {
      const variantId = options.variantId ?? null;
      const wanted = Math.max(1, Math.floor(options.quantity ?? 1));
      cacheProducts([product]);

      const current = entriesRef.current;
      const existing = current.find((e) => e.productId === product.id && e.variantId === variantId);
      const limit = lineLimit(current, product, variantId);
      const addable = Math.max(0, Math.min(wanted, limit - (existing?.quantity ?? 0)));

      if (addable === 0) {
        if (!options.silent) {
          const capped = stockOf(product, variantId ? (product.variants.find((v) => v.id === variantId) ?? null) : null) > limit;
          toast({
            tone: "warning",
            title: capped ? `Нэг захиалгад ${MAX_PER_PRODUCT} ширхэг хүртэл` : "Үлдэгдэл хүрэлцэхгүй",
            description: capped ? product.title : `“${product.title}” — үлдэгдэл бүхэлдээ таны сагсанд байна`,
          });
        }
        return 0;
      }

      const next = existing
        ? current.map((e) => (e === existing ? { ...e, quantity: e.quantity + addable } : e))
        : [...current, { productId: product.id, variantId, quantity: addable }];
      entriesRef.current = next;
      setEntries(next);
      if (!options.silent) {
        toast({
          tone: addable < wanted ? "warning" : "success",
          title: addable < wanted ? `Боломжит ${addable} ширхэг нэмэгдлээ` : "Сагсанд нэмэгдлээ",
          description: `${product.title} × ${addable}`,
        });
      }
      return addable;
    },
    [cacheProducts, toast],
  );

  const setQuantity = useCallback((productId: string, variantId: string | null, quantity: number) => {
    setEntries((prev) => {
      const product = productsRef.current.get(productId);
      const target = Math.max(0, Math.floor(quantity));
      const clamped = product ? Math.min(target, lineLimit(prev, product, variantId)) : target;
      const exists = prev.some((e) => e.productId === productId && e.variantId === variantId);
      if (clamped === 0) return prev.filter((e) => !(e.productId === productId && e.variantId === variantId));
      if (!exists) return [...prev, { productId, variantId, quantity: clamped }];
      return prev.map((e) => (e.productId === productId && e.variantId === variantId ? { ...e, quantity: clamped } : e));
    });
  }, []);

  const remove = useCallback((productId: string, variantId: string | null) => setQuantity(productId, variantId, 0), [setQuantity]);
  const setCoupon = useCallback((code: string | null) => {
    const value = code?.trim().toUpperCase() || null;
    setCouponState(value);
    try {
      if (value) window.localStorage.setItem(COUPON_STORAGE_KEY, value);
      else window.localStorage.removeItem(COUPON_STORAGE_KEY);
    } catch {}
  }, []);
  const clear = useCallback(() => {
    setEntries([]);
    setCoupon(null);
  }, [setCoupon]);
  const refresh = useCallback(() => fetchProducts(), [fetchProducts]);
  const open = useCallback(() => {
    setOpen(true);
    void fetchProducts(); // show current stock and prices
  }, [fetchProducts]);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<CartContextValue>(
    () => ({ ready, items, count, subtotal, quantityOf, add, setQuantity, remove, clear, refresh, isOpen, open, close, coupon, setCoupon }),
    [ready, items, count, subtotal, quantityOf, add, setQuantity, remove, clear, refresh, isOpen, open, close, coupon, setCoupon],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart() must be used inside <CartProvider>.");
  return ctx;
}
