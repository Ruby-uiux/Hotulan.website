"use client";

import { Phone, Search, ShoppingCart, Store, Truck, X } from "lucide-react";
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { CATEGORIES, formatMNT, type CategoryFilter } from "@/lib/catalog";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  category: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  cartCount: number;
  onOpenCart: () => void;
  freeDeliveryThreshold: number;
  supportPhone: string;
}

export default function Header({
  query,
  onQueryChange,
  onSearchSubmit,
  category,
  onCategoryChange,
  cartCount,
  onOpenCart,
  freeDeliveryThreshold,
  supportPhone,
}: HeaderProps) {
  const headerRef = useRef<HTMLElement>(null);

  // The sticky header's height differs per breakpoint (top bar, mobile search row), so a
  // fixed scroll-margin can't be right everywhere. Publishing the live height as
  // scroll-padding makes every anchor jump and scrollIntoView land just below it.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.scrollPaddingTop = `${header.offsetHeight + 16}px`;
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.scrollPaddingTop = "";
    };
  }, []);

  return (
    <header
      ref={headerRef}
      id="site-header"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="hidden bg-slate-950 text-xs text-slate-300 sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-white" aria-hidden="true" />
            Улаанбаатар хотод {formatMNT(freeDeliveryThreshold)}-өөс дээш захиалгад хүргэлт үнэгүй
          </p>
          <a
            href={`tel:${supportPhone.replace(/\D/g, "")}`}
            className="flex items-center gap-1.5 font-medium transition hover:text-white"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            Лавлах утас: {supportPhone}
          </a>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-6 sm:px-6 lg:px-8">
        <a href="#top" className="flex shrink-0 items-center gap-2.5" aria-label="hotulan.mn — нүүр хуудас">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-white shadow-md shadow-brand/25">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-extrabold tracking-tight text-slate-900">
              hotulan<span className="text-brand">.mn</span>
            </span>
            <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Албан ёсны дэлгүүр
            </span>
          </span>
        </a>

        <SearchField
          id="search-desktop"
          className="hidden flex-1 md:block"
          query={query}
          onQueryChange={onQueryChange}
          onSubmit={onSearchSubmit}
        />

        <button
          type="button"
          onClick={onOpenCart}
          className="relative ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand hover:text-brand md:ml-0"
          aria-label={cartCount > 0 ? `Сагс, ${cartCount} бараа` : "Сагс хоосон"}
        >
          <ShoppingCart className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Сагс</span>
          {cartCount > 0 && (
            <span
              key={cartCount /* re-key replays the pop animation on every change */}
              className="absolute -right-2 -top-2 grid h-5 min-w-5 animate-pop-in place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white ring-2 ring-white"
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchField id="search-mobile" query={query} onQueryChange={onQueryChange} onSubmit={onSearchSubmit} />
      </div>

      <nav aria-label="Бүтээгдэхүүний ангилал" className="border-t border-slate-100">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:px-8">
          {CATEGORIES.map((c) => {
            const active = c.id === category;
            return (
              <li key={c.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onCategoryChange(c.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative px-3 py-3 text-sm font-medium transition ${
                    active ? "text-brand" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {c.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand transition-transform ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}

interface SearchFieldProps {
  id: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  className?: string;
}

function SearchField({ id, query, onQueryChange, onSubmit, className = "" }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    inputRef.current?.blur(); // dismisses the mobile keyboard so results are visible
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Escape clears first; a second Escape on an empty field leaves focus.
    if (event.key !== "Escape") return;
    if (query) onQueryChange("");
    else inputRef.current?.blur();
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative ${className}`}>
      <label className="sr-only" htmlFor={id}>
        Бүтээгдэхүүн хайх
      </label>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Бараа, брэнд хайх… (жишээ нь: чихэвч)"
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10 [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            onQueryChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          aria-label="Хайлтыг цэвэрлэх"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
