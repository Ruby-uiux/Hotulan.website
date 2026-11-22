import StoreFront from "@/components/store/StoreFront";
import Hero, { type CategorySummary } from "@/components/store/Hero";
import TrustStrip from "@/components/store/TrustStrip";
import Footer from "@/components/store/Footer";
import { enabledPaymentMethods } from "@/lib/admin-data";
import { categoryNameMap } from "@/lib/categories";
import { getStoreCategoryTree, listCategories } from "@/lib/server/repo/categories";
import { listZones } from "@/lib/server/repo/delivery";
import { listStoreProducts } from "@/lib/server/repo/products";
import { getStoreSettings } from "@/lib/server/repo/settings";

// Catalog, stock and settings are edited live from /admin — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * Server entry. Reads the database once per request; static sections (hero, trust,
 * footer) render here and are slotted into the client StoreFront.
 */
export default async function HomePage() {
  const [products, settings, tree, allCategories, zones] = await Promise.all([
    listStoreProducts(),
    getStoreSettings(),
    getStoreCategoryTree(),
    listCategories(),
    listZones({ activeOnly: true }),
  ]);

  const categories: CategorySummary = {};
  for (const p of products) {
    const c = (categories[p.category] ??= { count: 0, minPrice: null });
    c.count += 1;
    c.minPrice = c.minPrice === null ? p.price : Math.min(c.minPrice, p.price);
  }

  return (
    <>
      <StoreFront
        products={products}
        categories={tree.filter((c) => c.showInMenu).map((c) => ({ id: c.id, label: c.name }))}
        categoryNames={categoryNameMap(allCategories)}
        zones={zones}
        paymentMethods={enabledPaymentMethods(settings)}
        oversizedFee={settings.oversizedFee}
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
        supportPhone={settings.supportPhone}
        hero={
          <Hero
            categories={categories}
            freeDeliveryThreshold={settings.freeDeliveryThreshold}
            supportPhone={settings.supportPhone}
          />
        }
      >
        <TrustStrip />
      </StoreFront>
      <Footer supportPhone={settings.supportPhone} supportEmail={settings.supportEmail} />
    </>
  );
}
