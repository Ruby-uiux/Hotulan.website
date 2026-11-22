import StoreFront from "@/components/store/StoreFront";
import Hero, { type CategorySummary } from "@/components/store/Hero";
import TrustStrip from "@/components/store/TrustStrip";
import { categoryNameMap } from "@/lib/categories";
import { listCategories } from "@/lib/server/repo/categories";
import { listStoreProducts } from "@/lib/server/repo/products";
import { getStoreShell } from "@/lib/server/storefront";

/**
 * Home. Header, footer and cart come from the (store) layout; this page renders the
 * hero and the catalog.
 */
export default async function HomePage() {
  const [products, allCategories, { tree, settings }] = await Promise.all([listStoreProducts(), listCategories(), getStoreShell()]);

  const categories: CategorySummary = {};
  for (const p of products) {
    const c = (categories[p.category] ??= { count: 0, minPrice: null });
    c.count += 1;
    c.minPrice = c.minPrice === null ? p.price : Math.min(c.minPrice, p.price);
  }

  return (
    <StoreFront
      products={products}
      categories={tree.filter((c) => c.showInMenu).map((c) => ({ id: c.id, label: c.name }))}
      categoryNames={categoryNameMap(allCategories)}
      hero={<Hero categories={categories} freeDeliveryThreshold={settings.freeDeliveryThreshold} supportPhone={settings.supportPhone} />}
    >
      <TrustStrip />
    </StoreFront>
  );
}
