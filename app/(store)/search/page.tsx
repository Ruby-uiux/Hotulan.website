import type { Metadata } from "next";
import { Breadcrumbs, Listing, PillLinks } from "@/components/store/listing/Listing";
import { categoryNameMap } from "@/lib/categories";
import { filtersToQuery, parseFilters, queryCatalog, type SortKey } from "@/lib/filtering";
import { categoryIcons, getAllCategories, getSales, getStoreProducts, getStoreShell } from "@/lib/server/storefront";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Text search → relevance; the header's "Хямдрал" / "Шинэ бараа" links → popularity / newest. */
function defaultSortFor(params: Record<string, string | string[] | undefined>): SortKey {
  return one(params.q).trim() ? "relevance" : "popular";
}

function heading(q: string, sale: boolean, sort: SortKey): string {
  if (q) return `“${q}”`;
  if (sale) return "Хямдрал";
  if (sort === "new") return "Шинэ бараа";
  return "Бүх бараа";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const q = one(params.q).trim();
  return {
    title: heading(q, one(params.sale) === "1", one(params.sort) as SortKey).replace(/[“”]/g, "") + (q ? " — хайлт" : ""),
    // Result pages for arbitrary text are thin duplicates; keep only the curated lists indexable.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

/** design/Search. Also serves "Хямдрал" (?sale=1) and "Шинэ бараа" (?sort=new) from the header. */
export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const defaultSort = defaultSortFor(params);
  const [{ settings, tree }, products, all, sales] = await Promise.all([getStoreShell(), getStoreProducts(), getAllCategories(), getSales()]);
  const names = categoryNameMap(all);

  // ?cat=<root id> narrows to one root category (the pills).
  const base = parseFilters(params, { sort: defaultSort });
  const cat = tree.find((c) => c.id === base.cat) ?? null;
  const filters = { ...base, cat: cat?.id ?? null, categoryIds: cat ? [cat.id, ...cat.children.map((c) => c.id)] : [] };
  const ctx = { names, freeDeliveryThreshold: settings.freeDeliveryThreshold, sales };
  const result = queryCatalog(products, filters, ctx);
  const everywhere = cat ? queryCatalog(products, { ...filters, categoryIds: [], page: 1 }, ctx) : result;

  const link = (catId: string | null) => `/search${filtersToQuery({ ...base, cat: catId, page: 1 }, { sort: defaultSort })}`;
  const pills = [
    { label: "Бүгд", href: link(null), count: everywhere.total, selected: !cat },
    ...everywhere.categories.slice(0, 6).flatMap(({ value, count }) => {
      const c = tree.find((t) => t.id === value);
      return c ? [{ label: c.name, href: link(c.id), count, selected: cat?.id === c.id }] : [];
    }),
  ];
  const title = heading(base.q, base.sale, base.sort);
  const inStock = result.items.length ? queryCatalog(products, { ...filters, inStock: true, page: 1 }, ctx).total : 0;

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 pt-4 pb-16 lg:gap-5 lg:px-6 lg:pt-5">
      <Breadcrumbs items={[{ label: "Нүүр", href: "/" }, { label: base.q ? "Хайлт" : title }]} />
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] lg:text-[28px]">{title}</h1>
        <span className="text-[17px] text-slate-500">— {result.total} илэрц</span>
      </div>
      {everywhere.total > 0 && pills.length > 2 && <PillLinks items={pills} />}
      <Listing
        path="/search"
        filters={filters}
        result={result}
        defaultSort={defaultSort}
        icons={categoryIcons(all)}
        freeDeliveryThreshold={settings.freeDeliveryThreshold}
        priceBounds={null}
        sidebar={false}
        search={!!base.q}
        toolbarNote={inStock > 0 ? <span>Бэлэн байгаа {inStock}</span> : null}
        emptyAction={{ label: "Бүх бараа үзэх", href: "/search" }}
      />
    </main>
  );
}
