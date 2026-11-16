import StoreFront from "@/components/store/StoreFront";
import Hero, { type CategorySummary } from "@/components/store/Hero";
import TrustStrip from "@/components/store/TrustStrip";
import Footer from "@/components/store/Footer";
import { readStore } from "@/lib/server/store";

// Catalog, stock and settings are edited live from /admin — never serve a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * Server entry. Reads the shared store once per request; static sections (hero, trust,
 * footer) render here and are slotted into the client StoreFront.
 */
export default async function HomePage() {
  const { products, settings } = await readStore();

  const categories: CategorySummary = {
    toys: { count: 0, minPrice: null },
    home: { count: 0, minPrice: null },
    electronics: { count: 0, minPrice: null },
    sports: { count: 0, minPrice: null },
  };
  for (const p of products) {
    const c = categories[p.category];
    c.count += 1;
    c.minPrice = c.minPrice === null ? p.price : Math.min(c.minPrice, p.price);
  }

  return (
    <>
      <StoreFront
        products={products}
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
