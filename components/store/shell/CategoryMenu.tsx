"use client";

import { ChevronRight, LayoutGrid, Menu, Percent, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useOverlay } from "@/lib/useOverlay";
import CategoryIcon from "./CategoryIcon";
import { useShell } from "./ShellProvider";

/** What the menus need from a category: enough to link and label it. */
export interface MenuCategory {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  children: { id: string; slug: string; name: string }[];
}

/** Desktop "Бүх ангилал": a mega panel under the header row with every root and its subcategories. */
export function AllCategoriesButton({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navigating closes it; so do Escape and a click outside.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="static">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        {open ? <X className="size-[18px]" aria-hidden="true" /> : <Menu className="size-[18px]" aria-hidden="true" />}
        Бүх ангилал
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full z-40 animate-fade-in border-t border-slate-100 bg-white shadow-lg"
        >
          <div className="mx-auto grid max-w-[1280px] grid-cols-4 gap-x-8 gap-y-6 px-6 py-8 xl:grid-cols-5">
            {categories.map((c) => (
              <div key={c.id} className="min-w-0">
                <Link href={`/c/${c.slug}`} className="group flex items-center gap-2.5 text-sm font-bold text-slate-900 hover:text-brand">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                    <CategoryIcon icon={c.icon} className="size-[18px]" />
                  </span>
                  {c.name}
                </Link>
                {c.children.length > 0 && (
                  <ul className="mt-2 space-y-1.5 pl-[46px] text-[13px] text-slate-600">
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <Link href={`/c/${s.slug}`} className="hover:text-brand">
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Mobile hamburger; opens the same drawer as the "Ангилал" tab. */
export function MenuButton() {
  const { openMenu } = useShell();
  return (
    <button
      type="button"
      onClick={openMenu}
      aria-label="Цэс"
      className="-ml-2.5 grid size-11 shrink-0 place-items-center text-slate-900"
    >
      <Menu className="size-6" aria-hidden="true" />
    </button>
  );
}

/** Mobile category drawer (left sheet). */
export function MobileCategoryDrawer({ categories }: { categories: MenuCategory[] }) {
  const { menuOpen, closeMenu } = useShell();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(menuOpen, closeMenu);

  useEffect(() => closeMenu(), [pathname, closeMenu]);
  useEffect(() => {
    if (menuOpen) panelRef.current?.focus();
  }, [menuOpen]);

  if (!menuOpen) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={closeMenu} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Ангилал"
        className="absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col bg-white shadow-lg outline-none"
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <span className="text-base font-bold">Ангилал</span>
          <button type="button" onClick={closeMenu} aria-label="Хаах" className="-mr-2 grid size-11 place-items-center text-slate-500">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Ангилал">
          <Link href="/search?sale=1" className="flex min-h-12 items-center gap-3 px-4 text-sm font-bold text-danger">
            <Percent className="size-5" aria-hidden="true" />
            Хямдрал
          </Link>
          <Link href="/search?sort=new" className="flex min-h-12 items-center gap-3 px-4 text-sm font-semibold text-slate-900">
            <Sparkles className="size-5 text-brand" aria-hidden="true" />
            Шинэ бараа
          </Link>
          <div className="my-2 border-t border-slate-100" />
          {categories.map((c) => {
            const isOpen = expanded === c.id;
            return (
              <div key={c.id}>
                <div className="flex items-center">
                  <Link href={`/c/${c.slug}`} className="flex min-h-12 flex-1 items-center gap-3 px-4 text-sm font-semibold text-slate-900">
                    <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand">
                      <CategoryIcon icon={c.icon} className="size-4" />
                    </span>
                    {c.name}
                  </Link>
                  {c.children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      aria-expanded={isOpen}
                      aria-label={`${c.name} — дэд ангилал`}
                      className="grid size-12 place-items-center text-slate-400"
                    >
                      <ChevronRight className={`size-5 transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <ul className="pb-2 pl-[60px]">
                    {c.children.map((s) => (
                      <li key={s.id}>
                        <Link href={`/c/${s.slug}`} className="flex min-h-10 items-center text-sm text-slate-600">
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="my-2 border-t border-slate-100" />
          <Link href="/c" className="flex min-h-12 items-center gap-3 px-4 text-sm text-slate-600">
            <LayoutGrid className="size-5" aria-hidden="true" />
            Бүх ангилал
          </Link>
        </nav>
      </div>
    </div>
  );
}
