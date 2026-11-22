import { PRICE_BANDS, type CategoryFilter, type PriceBandId, type Product, type SortKey } from "./catalog";

export interface CatalogQuery {
  query: string;
  category: CategoryFilter;
  priceBand: PriceBandId;
  sort: SortKey;
}

/** id → category name; searching "тоглоом" should find every toy. */
export type CategoryNames = Readonly<Record<string, string>>;

/** Collapses whitespace and case so "  Чихэвч " and "чихэвч" match the same items. */
export function normalizeSearch(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function searchableText(product: Product, names: CategoryNames): string {
  return [
    product.title,
    product.brand,
    names[product.category] ?? "",
    product.subcategory ? (names[product.subcategory] ?? "") : "",
    ...(product.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Every whitespace-separated term must appear somewhere in the product's text,
 * so "цагаан хөвөн" narrows results instead of widening them.
 */
export function matchesQuery(product: Product, normalizedQuery: string, names: CategoryNames = {}): boolean {
  if (!normalizedQuery) return true;
  const haystack = searchableText(product, names);
  return normalizedQuery.split(" ").every((term) => haystack.includes(term));
}

export function matchesPriceBand(product: Product, bandId: PriceBandId): boolean {
  const band = PRICE_BANDS.find((b) => b.id === bandId) ?? PRICE_BANDS[0];
  // Lower bound inclusive, upper exclusive — a 500,000₮ item lands in exactly one band.
  return product.price >= band.min && product.price < band.max;
}

const comparators: Record<SortKey, (a: Product, b: Product) => number> = {
  featured: () => 0,
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
};

export function applyCatalogQuery(products: Product[], q: CatalogQuery, names: CategoryNames = {}): Product[] {
  const needle = normalizeSearch(q.query);
  const compare = comparators[q.sort];

  return products
    .filter(
      (p) =>
        (q.category === "all" || p.category === q.category) &&
        matchesPriceBand(p, q.priceBand) &&
        matchesQuery(p, needle, names),
    )
    .sort((a, b) => {
      // Sold-out items never outrank purchasable ones, regardless of sort mode.
      const stockOrder = Number(a.stock === 0) - Number(b.stock === 0);
      return stockOrder || compare(a, b);
    });
}

/** Tab badges reflect the current search + price band, so a tab never promises items it can't show. */
export function countByCategory(
  products: Product[],
  q: Pick<CatalogQuery, "query" | "priceBand">,
  names: CategoryNames = {},
): Record<CategoryFilter, number> {
  const needle = normalizeSearch(q.query);
  const counts: Record<CategoryFilter, number> = { all: 0 };

  for (const p of products) {
    if (!matchesPriceBand(p, q.priceBand) || !matchesQuery(p, needle, names)) continue;
    counts.all += 1;
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}
