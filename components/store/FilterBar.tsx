"use client";

import { ArrowUpDown, ChevronDown, RotateCcw, Tag, X } from "lucide-react";
import {
  PRICE_BANDS,
  SORT_OPTIONS,
  type CategoryFilter,
  type PriceBandId,
  type SortKey,
} from "@/lib/catalog";
import { useCatalog } from "./CatalogContext";

interface FilterBarProps {
  category: CategoryFilter;
  onCategoryChange: (c: CategoryFilter) => void;
  counts: Record<string, number>;
  priceBand: PriceBandId;
  onPriceBandChange: (b: PriceBandId) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  query: string;
  onClearQuery: () => void;
  resultCount: number;
  onReset: () => void;
}

export default function FilterBar({
  category,
  onCategoryChange,
  counts,
  priceBand,
  onPriceBandChange,
  sort,
  onSortChange,
  query,
  onClearQuery,
  resultCount,
  onReset,
}: FilterBarProps) {
  const { categories } = useCatalog();
  const trimmedQuery = query.trim();
  const activeBand = PRICE_BANDS.find((b) => b.id === priceBand);
  const hasActiveFilters = category !== "all" || priceBand !== "all" || trimmedQuery.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="catalog-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Бүтээгдэхүүн
          </h2>
          <p className="mt-1 text-sm text-slate-500" aria-live="polite">
            {resultCount > 0 ? `${resultCount} бараа олдлоо` : "Тохирох бараа олдсонгүй"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Ангиллаар шүүх">
        {categories.map((c) => {
          const active = c.id === category;
          const count = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryChange(c.id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "border-brand bg-brand text-white shadow-md shadow-brand/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {c.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center">
        <SelectControl
          id="price-band"
          label="Үнийн хүрээ"
          icon={<Tag className="h-4 w-4" aria-hidden="true" />}
          value={priceBand}
          onChange={(v) => onPriceBandChange(v as PriceBandId)}
          options={PRICE_BANDS.map((b) => ({ value: b.id, label: b.label }))}
        />
        <SelectControl
          id="sort"
          label="Эрэмбэлэх"
          icon={<ArrowUpDown className="h-4 w-4" aria-hidden="true" />}
          value={sort}
          onChange={(v) => onSortChange(v as SortKey)}
          options={SORT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-brand sm:ml-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Шүүлтүүр арилгах
          </button>
        )}
      </div>

      {(trimmedQuery || priceBand !== "all") && (
        <ul className="flex flex-wrap gap-2" aria-label="Идэвхтэй шүүлтүүр">
          {trimmedQuery && (
            <FilterChip label={`Хайлт: “${trimmedQuery}”`} onRemove={onClearQuery} removeLabel="Хайлтыг арилгах" />
          )}
          {priceBand !== "all" && activeBand && (
            <FilterChip
              label={activeBand.label}
              onRemove={() => onPriceBandChange("all")}
              removeLabel="Үнийн шүүлтүүрийг арилгах"
            />
          )}
        </ul>
      )}
    </div>
  );
}

interface SelectControlProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function SelectControl({ id, label, icon, value, onChange, options }: SelectControlProps) {
  return (
    <div className="flex items-center gap-2 sm:min-w-60">
      <label htmlFor={id} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </label>
      <div className="relative flex-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-xs font-semibold text-brand">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-brand hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
