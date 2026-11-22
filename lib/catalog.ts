/**
 * Catalogue types and pure helpers, safe for both server and client bundles.
 * Data itself lives in the database (lib/server/repo/*); categories are dynamic
 * (see lib/categories.ts), so there is no hard-coded category list here any more.
 */

/** Category id (stable, string). Seeded roots keep their old slugs: toys, home, electronics, sports. */
export type CategoryId = string;

export interface ProductSpec {
  label: string;
  value: string;
}

export const PRODUCT_BADGES = ["Шинэ", "Хямдрал", "Эрэлттэй"] as const;
export type ProductBadge = (typeof PRODUCT_BADGES)[number];

/** active = visible; draft = hidden; scheduled = becomes visible at `publishAt`. */
export type ProductStatus = "active" | "draft" | "scheduled";

export interface ProductVariant {
  id: string;
  /** Option name, e.g. "Өнгө". */
  option: string;
  /** Option value, e.g. "Хар". */
  name: string;
  price: number;
  stock: number;
  sku: string | null;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  /** Root category id. */
  category: CategoryId;
  /** Child category id, if any. */
  subcategory: CategoryId | null;
  price: number;
  /** Pre-discount price; present only when the item is actually on sale. */
  compareAtPrice?: number;
  /** Purchase cost — admin only, never sent to the storefront. */
  cost?: number;
  sku: string | null;
  barcode: string | null;
  rating: number;
  reviewCount: number;
  /** Cover image (first of the gallery). */
  image: string;
  /** Additional gallery images after the cover. */
  gallery: string[];
  badge?: ProductBadge;
  /** 0 means sold out — card stays visible but purchase is disabled. With variants, the sum of variant stock. */
  stock: number;
  /** Per-product low-stock warning level; falls back to the store setting. */
  lowStockAlert: number | null;
  status: ProductStatus;
  publishAt: string | null;
  /** Show in the home page highlight sections. */
  featured: boolean;
  warrantyMonths: number;
  weightKg: number | null;
  /** Bulky item — adds the oversized delivery surcharge. */
  oversized: boolean;
  summary: string;
  description: string;
  features: string[];
  specs: ProductSpec[];
  /** Extra search terms (Latin spellings, synonyms) customers commonly type. */
  keywords?: string[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface CartLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/** Whether a product should be visible on the storefront right now. */
export function isPublished(p: Pick<Product, "status" | "publishAt">, now = Date.now()): boolean {
  if (p.status === "active") return true;
  return p.status === "scheduled" && p.publishAt !== null && Date.parse(p.publishAt) <= now;
}


/**
 * Fixed en-US grouping keeps server and client output identical (no hydration drift
 * from differing ICU data) and matches how ₮ prices are printed on local receipts.
 */
/**
 * Most units of one product a single order may contain. Enforced by the server
 * (lib/server/validate.ts) and mirrored in the cart so shoppers never hit the error.
 */
export const MAX_PER_PRODUCT = 10;

/** How many of `product` one order may hold: its stock, capped at MAX_PER_PRODUCT. */
export function purchaseLimit(product: Pick<Product, "stock">): number {
  return Math.max(0, Math.min(product.stock, MAX_PER_PRODUCT));
}

/** Whole-percent discount from the crossed-out price; 0 when not on sale. */
export function discountPercent(p: Pick<Product, "price" | "compareAtPrice">): number {
  return p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
}

export function formatMNT(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")}₮`;
}
