import { ChevronLeft, ChevronRight, SearchX, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses, cn } from "@/components/ui";
import { formatMNT } from "@/lib/catalog";
import { filtersToQuery, type CatalogFilters, type CatalogResult, type SortKey } from "@/lib/filtering";
import ProductCard from "../product/ProductCard";
import { FilterSidebar, MobileFilterBar, SortSelect } from "./Filters";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Байршил" className="text-[13px] text-slate-500">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {it.href ? (
              <Link href={it.href} className="hover:text-brand">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-slate-900">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Pill links (subcategories, search categories): 38px, dark when selected — design/Category. */
export function PillLinks({ items }: { items: { label: string; href: string; count?: number; selected: boolean }[] }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.selected ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors lg:h-[38px]",
            it.selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white hover:border-slate-400",
          )}
        >
          {it.label}
          {it.count !== undefined && <span className={it.selected ? "text-white/70" : "text-slate-500"}>{it.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Removable chips for active filters (design: "Samsung ×"). Each is a plain link without that filter. */
function ActiveChips({ path, filters, defaultSort }: { path: string; filters: CatalogFilters; defaultSort: SortKey }) {
  const href = (patch: Partial<CatalogFilters>) => path + filtersToQuery({ ...filters, ...patch, page: 1 }, { sort: defaultSort });
  const chips: { label: string; href: string }[] = [
    ...filters.brands.map((b) => ({ label: b, href: href({ brands: filters.brands.filter((x) => x !== b) }) })),
  ];
  if (filters.min != null || filters.max != null) {
    const label = filters.min != null && filters.max != null ? `${formatMNT(filters.min)} – ${formatMNT(filters.max)}` : filters.min != null ? `${formatMNT(filters.min)}-өөс` : `${formatMNT(filters.max!)} хүртэл`;
    chips.push({ label, href: href({ min: null, max: null }) });
  }
  if (filters.inStock) chips.push({ label: "Бэлэн байгаа", href: href({ inStock: false }) });
  if (filters.sale) chips.push({ label: "Хямдралтай", href: href({ sale: false }) });
  if (filters.freeDelivery) chips.push({ label: "Үнэгүй хүргэлт", href: href({ freeDelivery: false }) });
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label}>
          <Link href={c.href} scroll={false} className="flex h-7 items-center gap-1 rounded-sm bg-brand-50 px-2.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-100">
            {c.label}
            <X className="size-3.5" aria-label="хасах" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function pageList(page: number, pages: number): (number | "…")[] {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function Pagination({ path, filters, defaultSort, page, pages }: { path: string; filters: CatalogFilters; defaultSort: SortKey; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (p: number) => path + filtersToQuery({ ...filters, page: p }, { sort: defaultSort });
  const box = "grid size-11 place-items-center rounded-md border border-slate-300 bg-white text-sm font-semibold hover:border-slate-400";
  return (
    <nav aria-label="Хуудаслалт" className="flex justify-center pt-2">
      {/* Phones: one "next" button (design/MCategory "Цааш үзэх"). */}
      {page < pages && (
        <Link href={href(page + 1)} className={cn(buttonClasses({ variant: "outline", fullWidth: true }), "lg:hidden")}>
          Цааш үзэх ({page}/{pages})
        </Link>
      )}
      <ul className="hidden items-center gap-2 lg:flex">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Өмнөх" className={box}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(box, "text-slate-300")} aria-hidden="true">
              <ChevronLeft className="size-4" />
            </span>
          )}
        </li>
        {pageList(page, pages).map((n, i) =>
          n === "…" ? (
            <li key={`gap${i}`} className="px-1 text-slate-400" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={cn(box, n === page && "border-brand bg-brand text-white hover:border-brand")}>
                {n}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < pages ? (
            <Link href={href(page + 1)} aria-label="Дараах" className={box}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className={cn(box, "text-slate-300")} aria-hidden="true">
              <ChevronRight className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}

export interface ListingProps {
  path: string;
  filters: CatalogFilters;
  result: CatalogResult;
  defaultSort: SortKey;
  icons: Record<string, string | null>;
  freeDeliveryThreshold: number;
  priceBounds: [number, number] | null;
  /** Category pages get the filter column; search shows only sort (design/Search). */
  sidebar: boolean;
  search?: boolean;
  /** Left of the sort control (e.g. "Бэлэн байгаа 12"). */
  toolbarNote?: ReactNode;
  emptyAction?: { label: string; href: string };
}

/** Toolbar + grid + pagination shared by /c/[slug] and /search. */
export function Listing(p: ListingProps) {
  const filterProps = {
    filters: p.filters,
    brands: p.result.brands,
    defaultSort: p.defaultSort,
    freeDeliveryThreshold: p.freeDeliveryThreshold,
    total: p.result.total,
    priceBounds: p.priceBounds,
    search: p.search,
  };
  const grid = (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="hidden items-center justify-between gap-3 lg:flex lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:px-3 lg:py-2.5">
        <div className="flex min-h-10 items-center gap-3 text-sm text-slate-600">
          <ActiveChips path={p.path} filters={p.filters} defaultSort={p.defaultSort} />
          {p.toolbarNote}
        </div>
        <SortSelect filters={p.filters} defaultSort={p.defaultSort} search={p.search} />
      </div>
      <MobileFilterBar {...filterProps} />
      <p className="text-[13px] text-slate-500 lg:hidden">{p.result.total} бараа</p>

      {p.result.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-lg bg-slate-100 text-slate-400">
            <SearchX className="size-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">Тохирох бараа олдсонгүй</p>
          <p className="max-w-sm text-sm text-slate-500">Шүүлтүүрээ багасгах эсвэл өөр үгээр хайж үзнэ үү.</p>
          {p.emptyAction && (
            <Link href={p.emptyAction.href} className={buttonClasses({ variant: "outline" })}>
              {p.emptyAction.label}
            </Link>
          )}
        </div>
      ) : (
        <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4", p.sidebar ? "xl:grid-cols-4" : "lg:grid-cols-5")}>
          {p.result.items.map((product, i) => (
            <ProductCard key={product.id} product={product} icon={p.icons[product.category] ?? null} priority={i < 4} />
          ))}
        </div>
      )}
      <Pagination path={p.path} filters={p.filters} defaultSort={p.defaultSort} page={p.result.page} pages={p.result.pages} />
    </div>
  );

  if (!p.sidebar) return grid;
  return (
    <div className="flex items-start gap-6">
      <div className="hidden w-[280px] shrink-0 lg:block">
        <FilterSidebar {...filterProps} />
      </div>
      {grid}
    </div>
  );
}
