import { cache } from "react";
import { enabledPaymentMethods } from "@/lib/admin-data";
import type { CategoryNode } from "@/lib/categories";
import { getStoreCategoryTree } from "./repo/categories";
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
