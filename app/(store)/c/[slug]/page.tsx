import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd, { breadcrumbLd } from "@/components/store/JsonLd";
import { Breadcrumbs, Listing, PillLinks } from "@/components/store/listing/Listing";
import { filtersToQuery, parseFilters, queryCatalog, type SortKey } from "@/lib/filtering";
import { categoryIcons, getAllCategories, getSales, getStoreProducts, getStoreShell } from "@/lib/server/storefront";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const DEFAULT_SORT: SortKey = "popular";

/** Visible category by slug (root or sub), with its root; null when missing or hidden. */
async function resolve(slug: string) {
  const [{ tree }, all] = await Promise.all([getStoreShell(), getAllCategories()]);
  const decoded = decodeURIComponent(slug);
  for (const root of tree) {
    if (root.slug === decoded) return { root, current: root, all, tree };
    const child = root.children.find((c) => c.slug === decoded);
    if (child) return { root, current: child, all, tree };
  }
  // Exists but hidden/empty → 404 too; only visible categories have pages.
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await resolve((await params).slug);
  if (!found) return { title: "Ангилал олдсонгүй" };
  const { current, root } = found;
  const name = current === root ? current.name : `${current.name} — ${root.name}`;
  return {
    title: name,
    description: `${name}: үнэ, үлдэгдэл, хүргэлтийн нөхцөл. Улаанбаатар хотод хүргэнэ.`,
    alternates: { canonical: `/c/${current.slug}` },
  };
}

/** design/Category, design/MCategory, design/MFilter. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const found = await resolve((await params).slug);
  if (!found) notFound();
  const { root, current, all } = found;
  const isRoot = current.id === root.id;

  const [{ settings }, products, sales] = await Promise.all([getStoreShell(), getStoreProducts(), getSales()]);
  const filters = { ...parseFilters(await searchParams, { sort: DEFAULT_SORT }), cat: null, categoryIds: isRoot ? [root.id, ...root.children.map((c) => c.id)] : [current.id] };
  const result = queryCatalog(products, filters, { freeDeliveryThreshold: settings.freeDeliveryThreshold, sales });

  // Subcategory pills count within the root, with the current (non-category) filters applied.
  const keep = filtersToQuery({ ...filters, page: 1 }, { sort: DEFAULT_SORT });
  const countIn = (ids: string[]) => queryCatalog(products, { ...filters, categoryIds: ids, page: 1 }, { freeDeliveryThreshold: settings.freeDeliveryThreshold }).total;
  const pills =
    root.children.length > 0
      ? [
          { label: "Бүгд", href: `/c/${root.slug}${keep}`, selected: isRoot },
          ...root.children.map((c) => ({ label: c.name, href: `/c/${c.slug}${keep}`, count: countIn([c.id]), selected: c.id === current.id })),
        ]
      : [];

  const inRoot = products.filter((p) => p.category === root.id);
  const prices = inRoot.map((p) => p.price);
  const bounds: [number, number] | null = prices.length ? [Math.min(...prices), Math.max(...prices)] : null;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-4 pb-16 lg:gap-5 lg:px-6 lg:pt-5">
      <JsonLd
        data={breadcrumbLd([
          { name: "Нүүр", path: "/" },
          ...(isRoot ? [] : [{ name: root.name, path: `/c/${root.slug}` }]),
          { name: current.name, path: `/c/${current.slug}` },
        ])}
      />
      <Breadcrumbs items={[{ label: "Нүүр", href: "/" }, ...(isRoot ? [] : [{ label: root.name, href: `/c/${root.slug}` }]), { label: current.name }]} />
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] lg:text-[32px]">{current.name}</h1>
        <span className="text-[15px] text-slate-500">{result.total} бараа</span>
      </div>
      {pills.length > 0 && <PillLinks items={pills} />}
      <Listing
        path={`/c/${current.slug}`}
        filters={filters}
        result={result}
        defaultSort={DEFAULT_SORT}
        icons={categoryIcons(all)}
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
        priceBounds={bounds}
        sidebar
        emptyAction={{ label: "Шүүлтүүр цэвэрлэх", href: `/c/${current.slug}` }}
      />
    </main>
  );
}
