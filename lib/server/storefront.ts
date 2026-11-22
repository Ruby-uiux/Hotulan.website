import { cache } from "react";
import { enabledPaymentMethods } from "@/lib/admin-data";
import type { Category, CategoryNode } from "@/lib/categories";
import { getStoreCategoryTree, listCategories } from "./repo/categories";
import { listStoreProducts } from "./repo/products";
import { listZones } from "./repo/delivery";
import { getAppearance, getStoreSettings } from "./repo/settings";

/**
 * Data every storefront page shares (header, footer, cart drawer). Wrapped in React
 * `cache`, so the layout and the page can both ask for it and the database is read once
 * per request.
 */
export const getStoreShell = cache(async () => {
  const [tree, settings, appearance, zones] = await Promise.all([
    getStoreCategoryTree(),
    getStoreSettings(),
    getAppearance(),
    listZones({ activeOnly: true }),
  ]);
  return { tree, settings, appearance, zones, paymentMethods: enabledPaymentMethods(settings) };
});

/** category id → line icon. Subcategories have no icon of their own and use their root's. */
export function categoryIcons(categories: Category[]): Record<string, string | null> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return Object.fromEntries(categories.map((c) => [c.id, c.icon ?? (c.parentId ? (byId.get(c.parentId)?.icon ?? null) : null)]));
}

export const getAllCategories = cache(listCategories);

/** Published products (admin-only fields stripped), once per request. */
export const getStoreProducts = cache(listStoreProducts);

/** The category menu shape used by the header (and the mobile drawer). */
export function toMenuCategories(tree: CategoryNode[]) {
  return tree.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    children: c.children.map((s) => ({ id: s.id, slug: s.slug, name: s.name })),
  }));
}
