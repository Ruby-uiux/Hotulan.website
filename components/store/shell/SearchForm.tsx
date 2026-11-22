"use client";

import { Search } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * GET /search?q=… — a plain form, so search works before hydration too. On the
 * search page it shows the current query so the shopper can refine it.
 */
export default function SearchForm({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/search" ? (params.get("q") ?? "") : "";

  if (variant === "mobile") {
    return (
      <form action="/search" role="search" className="flex h-11 items-center gap-2 rounded-md bg-slate-100 px-3 text-slate-500">
        <Search className="size-[18px] shrink-0" aria-hidden="true" />
        <label htmlFor="q-mobile" className="sr-only">
          Хайх
        </label>
        <input
          key={current}
          id="q-mobile"
          name="q"
          type="search"
          defaultValue={current}
          placeholder="Бараа хайх…"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-body text-slate-900 placeholder:text-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
      </form>
    );
  }

  return (
    <form
      action="/search"
      role="search"
      className="flex h-11 min-w-0 flex-[1_1_360px] overflow-hidden rounded-md border-[1.5px] border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-100)]"
    >
      <label htmlFor="q-desktop" className="sr-only">
        Бараа хайх
      </label>
      <input
        key={current}
        id="q-desktop"
        name="q"
        type="search"
        defaultValue={current}
        placeholder="Бараа, брэнд, ангиллаар хайх…"
        className="min-w-0 flex-1 px-4 text-body text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <button type="submit" aria-label="Хайх" className="grid w-[52px] place-items-center bg-brand text-white transition-colors hover:bg-brand-700">
        <Search className="size-5" aria-hidden="true" />
      </button>
    </form>
  );
}
