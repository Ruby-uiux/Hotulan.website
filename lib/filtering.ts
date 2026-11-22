import { discountPercent, type Product } from "./catalog";

/**
 * Catalog listing for /c/[slug] and /search: filters, sort and pagination, all read from
 * the URL so every result page is linkable and indexable. Pure functions — the pages run
 * them on the server; the filter UI only rewrites the query string.
 */

export type SortKey = "relevance" | "popular" | "new" | "price-asc" | "price-desc" | "discount";

export const SORT_OPTIONS: ReadonlyArray<{ id: SortKey; label: string; searchOnly?: boolean }> = [
  { id: "relevance", label: "Хамгийн тохирох", searchOnly: true },
  { id: "popular", label: "Эрэлттэй нь эхэнд" },
  { id: "new", label: "Шинэ нь эхэнд" },
  { id: "price-asc", label: "Үнэ: багаас их" },
  { id: "price-desc", label: "Үнэ: ихээс бага" },
  { id: "discount", label: "Хямдрал ихтэй" },
];

/** Quick price ranges (design/MFilter chips); the min/max inputs allow any range. */
export const PRICE_PRESETS = [
  { label: "<100к", min: null, max: 100_000 },
  { label: "100–500к", min: 100_000, max: 500_000 },
  { label: "500к–1.5сая", min: 500_000, max: 1_500_000 },
  { label: "1.5сая+", min: 1_500_000, max: null },
] as const;

export const PAGE_SIZE = 24;

export interface CatalogFilters {
  q: string;
  /** Search only: one root category id from the pills (?cat=). */
  cat: string | null;
  /** Category ids a product's category or subcategory must be in (empty = any). */
  categoryIds: string[];
  brands: string[];
  min: number | null;
  max: number | null;
  inStock: boolean;
  sale: boolean;
  freeDelivery: boolean;
  sort: SortKey;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const amount = (v: string) => {
  const n = Number(v.replace(/[\s,₮]/g, ""));
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/** URL search params → filters. Unknown or malformed values fall back to defaults, never throw. */
export function parseFilters(params: Params, defaults: { sort: SortKey }): CatalogFilters {
  const sort = one(params.sort) as SortKey;
  const brand = params.brand;
  return {
    q: one(params.q).trim().slice(0, 100),
    cat: one(params.cat).trim().slice(0, 80) || null,
    categoryIds: [],
    brands: (Array.isArray(brand) ? brand : brand ? brand.split(",") : []).map((b) => b.trim()).filter(Boolean).slice(0, 20),
    min: amount(one(params.min)),
    max: amount(one(params.max)),
    inStock: one(params.stock) === "1",
    sale: one(params.sale) === "1",
    freeDelivery: one(params.free) === "1",
    sort: SORT_OPTIONS.some((o) => o.id === sort) ? sort : defaults.sort,
    page: Math.max(1, Math.floor(Number(one(params.page))) || 1),
  };
}

/** Filters → query string (defaults omitted), for links and router.replace. */
export function filtersToQuery(f: Partial<CatalogFilters>, defaults: { sort: SortKey }): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cat) p.set("cat", f.cat);
  if (f.brands?.length) p.set("brand", f.brands.join(","));
  if (f.min != null) p.set("min", String(f.min));
  if (f.max != null) p.set("max", String(f.max));
  if (f.inStock) p.set("stock", "1");
  if (f.sale) p.set("sale", "1");
  if (f.freeDelivery) p.set("free", "1");
  if (f.sort && f.sort !== defaults.sort) p.set("sort", f.sort);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** How many filters (besides search text and sort) are active — the badge on the phone "Шүүлтүүр" button. */
export function activeFilterCount(f: CatalogFilters): number {
  return f.brands.length + Number(f.min != null || f.max != null) + Number(f.inStock) + Number(f.sale) + Number(f.freeDelivery);
}

/* ------------------------------------------------------------------ Search */

/** id → category name; searching "тоглоом" should find every toy. */
export type CategoryNames = Readonly<Record<string, string>>;

/** Collapses whitespace and case so "  Чихэвч " and "чихэвч" match the same items. */
export function normalizeSearch(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Every term must appear in the title, brand, category names or keywords ("цагаан хөвөн"
 * narrows, never widens). Returns a relevance score, or 0 for no match.
 */
export function searchScore(product: Product, normalizedQuery: string, names: CategoryNames = {}): number {
  if (!normalizedQuery) return 1;
  const title = product.title.toLowerCase();
  const brand = product.brand.toLowerCase();
  const cats = [names[product.category] ?? "", product.subcategory ? (names[product.subcategory] ?? "") : ""].join(" ").toLowerCase();
  const keywords = (product.keywords ?? []).join(" ").toLowerCase();
  let score = 0;
  for (const term of normalizedQuery.split(" ")) {
    let s = 0;
    if (title.startsWith(term)) s += 4;
    else if (title.includes(term)) s += 3;
    if (brand.includes(term)) s += 2;
    if (cats.includes(term)) s += 1;
    if (keywords.includes(term)) s += 1;
    if (s === 0) return 0;
    score += s;
  }
  return score;
}

/* ------------------------------------------------------------------- Query */

export interface FacetCount {
  value: string;
  count: number;
}

export interface CatalogResult {
  items: Product[];
  total: number;
  page: number;
  pages: number;
  /** Brands among results matching every filter except brand. */
  brands: FacetCount[];
  /** Root categories among results matching every filter (for the search chips). */
  categories: FacetCount[];
}

export function queryCatalog(
  products: Product[],
  f: CatalogFilters,
  ctx: { names?: CategoryNames; freeDeliveryThreshold: number; sales?: Record<string, number> },
): CatalogResult {
  const needle = normalizeSearch(f.q);
  const scores = new Map<string, number>();
  const inCategory = (p: Product) =>
    f.categoryIds.length === 0 || f.categoryIds.includes(p.category) || (p.subcategory !== null && f.categoryIds.includes(p.subcategory));
  const passesExceptBrand = (p: Product) => {
    if (!inCategory(p)) return false;
    if (f.min != null && p.price < f.min) return false;
    if (f.max != null && p.price > f.max) return false;
    if (f.inStock && p.stock <= 0) return false;
    if (f.sale && discountPercent(p) <= 0) return false;
    if (f.freeDelivery && p.price < ctx.freeDeliveryThreshold) return false;
    const s = searchScore(p, needle, ctx.names);
    if (s === 0) return false;
    scores.set(p.id, s);
    return true;
  };

  const base = products.filter(passesExceptBrand);
  const brandCounts = new Map<string, number>();
  for (const p of base) if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const matched = f.brands.length ? base.filter((p) => f.brands.includes(p.brand)) : base;

  const categoryCounts = new Map<string, number>();
  for (const p of matched) categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);

  const sales = ctx.sales ?? {};
  const compare: Record<SortKey, (a: Product, b: Product) => number> = {
    relevance: (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || (sales[b.id] ?? 0) - (sales[a.id] ?? 0),
    popular: (a, b) => (sales[b.id] ?? 0) - (sales[a.id] ?? 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
    new: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    discount: (a, b) => discountPercent(b) - discountPercent(a),
  };
  const sorted = [...matched].sort((a, b) => {
    // Sold-out items never outrank purchasable ones, whatever the sort.
    const stock = Number(a.stock <= 0) - Number(b.stock <= 0);
    return stock || compare[f.sort](a, b) || a.title.localeCompare(b.title, "mn");
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(f.page, pages);
  return {
    items: sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: sorted.length,
    page,
    pages,
    brands: [...brandCounts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
    categories: [...categoryCounts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count),
  };
}
