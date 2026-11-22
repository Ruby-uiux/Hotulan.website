import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import JsonLd, { breadcrumbLd } from "@/components/store/JsonLd";
import { Breadcrumbs } from "@/components/store/listing/Listing";
import ProductGallery from "@/components/store/product/ProductGallery";
import ProductImage from "@/components/store/product/ProductImage";
import ProductInfo from "@/components/store/product/ProductInfo";
import ProductPurchase from "@/components/store/product/ProductPurchase";
import { cn } from "@/components/ui";
import { discountPercent, formatMNT, isPublished, type Product } from "@/lib/catalog";
import { boughtTogether } from "@/lib/server/repo/orders";
import { getProduct, stripPrivate } from "@/lib/server/repo/products";
import { categoryIcons, getAllCategories, getStoreProducts, getStoreShell } from "@/lib/server/storefront";
import { siteUrl } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };

/** Published product only; drafts, scheduled-not-yet and deleted ids are 404. */
const loadProduct = cache(async (id: string): Promise<Product | null> => {
  const p = await getProduct(decodeURIComponent(id));
  return p && isPublished(p) ? stripPrivate(p) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await loadProduct((await params).id);
  if (!product) return { title: "Бараа олдсонгүй" };
  const description = (product.summary || product.description || product.title).slice(0, 160);
  return {
    title: product.brand ? `${product.title} — ${product.brand}` : product.title,
    description,
    alternates: { canonical: `/p/${product.id}` },
    openGraph: { title: product.title, description, images: product.image ? [product.image] : undefined, type: "website" },
  };
}

function Label({ product, large }: { product: Product; large?: boolean }) {
  const pct = discountPercent(product);
  const base = cn("rounded-sm font-bold text-white", large ? "px-2.5 py-[5px] text-xs" : "px-2 py-1 text-xs");
  if (product.stock <= 0) return <span className={cn(base, "bg-slate-600")}>Дууссан</span>;
  if (product.badge === "Эрэлттэй") return <span className={cn(base, "bg-slate-900")}>Эрэлттэй</span>;
  if (product.badge === "Шинэ") return <span className={cn(base, "bg-brand")}>Шинэ</span>;
  if (pct > 0) return <span className={cn(base, "bg-danger")}>−{pct}%</span>;
  return null;
}

/** design/Product and design/MProduct. */
export default async function ProductPage({ params }: Props) {
  const product = await loadProduct((await params).id);
  if (!product) notFound();

  const [{ settings, zones }, categories, products, togetherIds] = await Promise.all([
    getStoreShell(),
    getAllCategories(),
    getStoreProducts(),
    boughtTogether(product.id, 3),
  ]);
  const icons = categoryIcons(categories);
  const root = categories.find((c) => c.id === product.category);
  const sub = product.subcategory ? categories.find((c) => c.id === product.subcategory) : null;

  // "Хамт авдаг" from real orders; without that history, similar items from the same shelf.
  const byId = new Map(products.map((p) => [p.id, p]));
  const together = togetherIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const similar = products
    .filter((p) => p.id !== product.id && p.stock > 0 && (product.subcategory ? p.subcategory === product.subcategory : p.category === product.category))
    .concat(products.filter((p) => p.id !== product.id && p.stock > 0 && p.category === product.category))
    .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
    .slice(0, 3);
  const related = together.length > 0 ? { title: "Хамт авдаг", items: together } : { title: "Төстэй бараа", items: similar };

  // No aggregateRating: there are no real reviews yet (flaw #17).
  const base = siteUrl();
  const images = [product.image, ...product.gallery].filter(Boolean);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.summary || product.description || undefined,
    image: images.length ? images : undefined,
    sku: product.sku ?? undefined,
    gtin: product.barcode ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    category: [root?.name, sub?.name].filter(Boolean).join(" > ") || undefined,
    offers: {
      "@type": "Offer",
      url: `${base}/p/${encodeURIComponent(product.id)}`,
      priceCurrency: "MNT",
      price: product.price,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };
  const crumbs = [
    { name: "Нүүр", path: "/" },
    ...(root ? [{ name: root.name, path: `/c/${root.slug}` }] : []),
    ...(sub ? [{ name: sub.name, path: `/c/${sub.slug}` }] : []),
    { name: product.title, path: `/p/${encodeURIComponent(product.id)}` },
  ];

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-4 pb-28 lg:px-6 lg:pt-5 lg:pb-16">
      <JsonLd data={productLd} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <div className="hidden lg:block">
        <Breadcrumbs
          items={[
            { label: "Нүүр", href: "/" },
            ...(root ? [{ label: root.name, href: `/c/${root.slug}` }] : []),
            ...(sub ? [{ label: sub.name, href: `/c/${sub.slug}` }] : []),
            { label: product.title },
          ]}
        />
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8 lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:p-7">
        <ProductGallery
          id={product.id}
          title={product.title}
          images={[product.image, ...product.gallery].filter(Boolean)}
          icon={icons[product.category] ?? null}
          label={<Label product={product} large />}
        />
        <div className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_420px] lg:gap-[18px]">
          <div className="flex flex-col gap-2">
            {product.brand && (
              <Link href={`/search?q=${encodeURIComponent(product.brand)}`} className="w-fit text-sm font-semibold text-brand">
                {product.brand}
              </Link>
            )}
            <h1 className="text-[22px] leading-[1.25] font-extrabold tracking-[-0.02em] lg:text-[28px]">{product.title}</h1>
          </div>
          <ProductPurchase
            product={product}
            zones={zones}
            freeDeliveryThreshold={settings.freeDeliveryThreshold}
            oversizedFee={settings.oversizedFee}
            nextDayCutoff={settings.nextDayCutoff}
            returnDays={settings.returnDays}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 lg:flex-[999_1_560px]">
          <ProductInfo description={product.description} features={product.features} specs={product.specs} />
        </div>
        {related.items.length > 0 && (
          <aside aria-labelledby="related" className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-[1_1_300px]">
            <h2 id="related" className="text-base font-extrabold lg:text-lg">
              {related.title}
            </h2>
            <ul className="flex flex-col gap-3">
              {related.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/p/${p.id}`} className="group flex items-center gap-3.5">
                    <ProductImage id={p.id} src={p.image} alt="" icon={icons[p.category] ?? null} iconClassName="size-6" className="size-16 shrink-0 rounded-[10px]" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="line-clamp-2 text-sm font-semibold group-hover:text-brand">{p.title}</span>
                      <span className="text-sm font-bold tabular-nums">{formatMNT(p.price)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
