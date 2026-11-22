"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Checkbox, Switch, cn } from "@/components/ui";
import { formatMNT } from "@/lib/catalog";
import { PRICE_PRESETS, SORT_OPTIONS, activeFilterCount, filtersToQuery, type CatalogFilters, type FacetCount, type SortKey } from "@/lib/filtering";
import { useOverlay } from "@/lib/useOverlay";

interface FilterProps {
  filters: CatalogFilters;
  brands: FacetCount[];
  defaultSort: SortKey;
  freeDeliveryThreshold: number;
  /** Results for the current filters — the phone sheet's "N бараа харах". */
  total: number;
  /** Price span of the unfiltered listing, for the range bar. */
  priceBounds: [number, number] | null;
  /** Search pages offer "Хамгийн тохирох"; category pages don't. */
  search?: boolean;
}

/** Applies a change by rewriting the query string; page resets to 1. */
function useApply(filters: CatalogFilters, defaultSort: SortKey) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const apply = (patch: Partial<CatalogFilters>) =>
    startTransition(() => {
      router.replace(pathname + filtersToQuery({ ...filters, ...patch, page: 1 }, { sort: defaultSort }), { scroll: false });
    });
  return { apply, pending };
}

const cleared: Partial<CatalogFilters> = { brands: [], min: null, max: null, inStock: false, sale: false, freeDelivery: false };

function PriceInputs({ filters, apply, size }: { filters: CatalogFilters; apply: (p: Partial<CatalogFilters>) => void; size: "sm" | "md" }) {
  const [min, setMin] = useState(filters.min?.toLocaleString("en-US") ?? "");
  const [max, setMax] = useState(filters.max?.toLocaleString("en-US") ?? "");
  useEffect(() => {
    setMin(filters.min?.toLocaleString("en-US") ?? "");
    setMax(filters.max?.toLocaleString("en-US") ?? "");
  }, [filters.min, filters.max]);

  const num = (v: string) => {
    const n = Number(v.replace(/[\s,₮]/g, ""));
    return v.trim() && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const commit = () => {
    const lo = num(min);
    const hi = num(max);
    if (lo !== filters.min || hi !== filters.max) apply({ min: lo, max: hi });
  };
  const input = cn(
    "w-full min-w-0 rounded-md border border-slate-300 bg-white tabular-nums focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-100)] focus:outline-none",
    size === "sm" ? "h-10 px-2.5 text-sm" : "h-11 px-3 text-body",
  );
  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className={cn("flex flex-1 flex-col gap-1 text-xs text-slate-500", size === "md" && "[&>span]:sr-only")}>
      <span>{label}</span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        placeholder={label === "Доод" ? "0" : "∞"}
        aria-label={`${label} үнэ`}
        className={input}
      />
    </label>
  );
  return (
    <div className="flex items-end gap-2">
      {field("Доод", min, setMin)}
      {size === "md" && <span className="pb-3 text-slate-400">—</span>}
      {field("Дээд", max, setMax)}
    </div>
  );
}

function Group({ title, children, size }: { title: string; children: ReactNode; size: "sm" | "md" }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={cn("mb-2.5 font-bold", size === "sm" ? "text-sm" : "text-[15px]")}>{title}</legend>
      {children}
    </fieldset>
  );
}

/** design/Category left column. */
export function FilterSidebar({ filters, brands, defaultSort, freeDeliveryThreshold, priceBounds }: FilterProps) {
  const { apply, pending } = useApply(filters, defaultSort);
  const active = activeFilterCount(filters);
  const toggleBrand = (b: string) =>
    apply({ brands: filters.brands.includes(b) ? filters.brands.filter((x) => x !== b) : [...filters.brands, b] });

  // Selected span as a share of the listing's price range (design's blue bar).
  let bar: { left: string; right: string } | null = null;
  if (priceBounds && priceBounds[1] > priceBounds[0]) {
    const [lo, hi] = priceBounds;
    const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
    bar = { left: `${pct(filters.min ?? lo)}%`, right: `${100 - pct(filters.max ?? hi)}%` };
  }

  return (
    <aside aria-label="Шүүлтүүр" aria-busy={pending} className={cn("flex flex-col gap-[22px] rounded-lg border border-slate-200 bg-white p-5 transition-opacity", pending && "opacity-70")}>
      <div className="flex items-center justify-between">
        <span className="text-base font-bold">Шүүлтүүр</span>
        {active > 0 && (
          <button type="button" onClick={() => apply(cleared)} className="py-2 text-[13px] font-semibold text-brand">
            Цэвэрлэх
          </button>
        )}
      </div>

      <Group title="Үнэ" size="sm">
        <PriceInputs filters={filters} apply={apply} size="sm" />
        {bar && (
          <div className="relative mx-1.5 mt-2 h-1 rounded-sm bg-slate-200" aria-hidden="true">
            <div className="absolute inset-y-0 rounded-sm bg-brand" style={bar} />
          </div>
        )}
      </Group>

      {brands.length > 0 && (
        <Group title="Брэнд" size="sm">
          {brands.slice(0, 12).map((b) => (
            <div key={b.value} className="flex items-center justify-between">
              <Checkbox className="min-h-8! flex-1" label={b.value} checked={filters.brands.includes(b.value)} onChange={() => toggleBrand(b.value)} />
              <span className="text-[13px] text-slate-500 tabular-nums">{b.count}</span>
            </div>
          ))}
        </Group>
      )}

      <Group title="Бусад" size="sm">
        <Checkbox className="min-h-8!" label="Зөвхөн бэлэн байгаа" checked={filters.inStock} onChange={() => apply({ inStock: !filters.inStock })} />
        <Checkbox className="min-h-8!" label="Хямдралтай" checked={filters.sale} onChange={() => apply({ sale: !filters.sale })} />
        <Checkbox
          className="min-h-8!"
          label={`Үнэгүй хүргэлттэй (${formatMNT(freeDeliveryThreshold)}+)`}
          checked={filters.freeDelivery}
          onChange={() => apply({ freeDelivery: !filters.freeDelivery })}
        />
      </Group>
    </aside>
  );
}

export function SortSelect({ filters, defaultSort, search, className }: Pick<FilterProps, "filters" | "defaultSort" | "search"> & { className?: string }) {
  const { apply } = useApply(filters, defaultSort);
  return (
    <label className={cn("flex items-center gap-2 text-sm text-slate-600", className)}>
      <span className="max-sm:sr-only">Эрэмбэлэх</span>
      <select
        value={filters.sort}
        onChange={(e) => apply({ sort: e.target.value as SortKey })}
        className="h-10 cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-brand focus:outline-none"
      >
        {SORT_OPTIONS.filter((o) => search || !o.searchOnly).map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** design/MCategory toolbar ("Шүүлтүүр N" | sort) and the design/MFilter bottom sheet. */
export function MobileFilterBar(props: FilterProps) {
  const { filters, brands, defaultSort, total, search } = props;
  const { apply, pending } = useApply(filters, defaultSort);
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const active = activeFilterCount(filters);
  useOverlay(open, () => setOpen(false));
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open]);
  const sortLabel = SORT_OPTIONS.find((o) => o.id === filters.sort)?.label ?? "";

  return (
    <>
      <div className="-mx-4 grid grid-cols-2 border-y border-slate-200 bg-white lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="flex h-12 items-center justify-center gap-2 border-r border-slate-200 text-sm font-semibold">
          <SlidersHorizontal className="size-[18px]" aria-hidden="true" />
          Шүүлтүүр
          {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{active}</span>}
        </button>
        <label className="relative flex h-12 items-center justify-center gap-1 text-sm font-semibold">
          <span>{sortLabel}</span>
          <ChevronDown className="size-4" aria-hidden="true" />
          <select
            aria-label="Эрэмбэлэх"
            value={filters.sort}
            onChange={(e) => apply({ sort: e.target.value as SortKey })}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {SORT_OPTIONS.filter((o) => search || !o.searchOnly).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Шүүлтүүр"
            className="relative flex max-h-[90dvh] animate-pop-in flex-col rounded-t-[18px] bg-white outline-none"
          >
            <div className="flex justify-center pt-2" aria-hidden="true">
              <span className="h-1 w-10 rounded-sm bg-slate-300" />
            </div>
            <div className="flex items-center border-b border-slate-200 py-2 pr-2 pl-4">
              <h2 className="flex-1 text-lg font-bold">Шүүлтүүр</h2>
              {active > 0 && (
                <button type="button" onClick={() => apply(cleared)} className="h-11 px-3 text-sm font-semibold text-brand">
                  Цэвэрлэх
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Хаах" className="grid size-11 place-items-center">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className={cn("flex flex-1 flex-col gap-[22px] overflow-y-auto p-4 transition-opacity", pending && "opacity-70")}>
              <Group title="Үнэ" size="md">
                <div className="flex gap-2">
                  {PRICE_PRESETS.map((p) => {
                    const on = filters.min === p.min && filters.max === p.max;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => apply(on ? { min: null, max: null } : { min: p.min, max: p.max })}
                        className={cn(
                          "h-10 flex-1 rounded-md text-xs font-semibold",
                          on ? "border-2 border-brand bg-brand-50 text-brand-700" : "border border-slate-300 bg-white",
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <PriceInputs filters={filters} apply={apply} size="md" />
              </Group>
              {brands.length > 0 && (
                <Group title="Брэнд" size="md">
                  {brands.slice(0, 12).map((b) => (
                    <div key={b.value} className="flex items-center justify-between border-b border-slate-100">
                      <Checkbox
                        className="min-h-11 flex-1 gap-3 text-[15px] [&>input]:size-5"
                        label={b.value}
                        checked={filters.brands.includes(b.value)}
                        onChange={() =>
                          apply({ brands: filters.brands.includes(b.value) ? filters.brands.filter((x) => x !== b.value) : [...filters.brands, b.value] })
                        }
                      />
                      <span className="text-[13px] text-slate-500 tabular-nums">{b.count}</span>
                    </div>
                  ))}
                </Group>
              )}
              <Group title="Бусад" size="md">
                <Switch label="Зөвхөн бэлэн байгаа" checked={filters.inStock} onCheckedChange={(v) => apply({ inStock: v })} />
                <Switch label="Хямдралтай" checked={filters.sale} onCheckedChange={(v) => apply({ sale: v })} />
              </Group>
            </div>
            <div className="border-t border-slate-200 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-[52px] w-full rounded-md bg-brand text-base font-bold text-white"
              >
                {pending ? "Шүүж байна…" : `${total} бараа харах`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
