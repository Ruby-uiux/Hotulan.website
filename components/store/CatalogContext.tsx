"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/** A storefront filter tab: "all" plus each visible root category. */
export interface NavCategory {
  id: string;
  label: string;
}

interface CatalogContextValue {
  /** "Бүгд" first, then visible root categories in admin order. */
  categories: NavCategory[];
  /** Name for any category id (root or child); unknown ids fall back to "". */
  categoryName: (id: string) => string;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/** Categories are admin-managed data now, so store components read them from here instead of a constant. */
export function CatalogProvider({
  categories,
  names,
  children,
}: {
  categories: NavCategory[];
  names: Record<string, string>;
  children: ReactNode;
}) {
  const value = useMemo<CatalogContextValue>(
    () => ({
      categories: [{ id: "all", label: "Бүгд" }, ...categories],
      categoryName: (id) => names[id] ?? "",
    }),
    [categories, names],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog() must be used inside <CatalogProvider>.");
  return ctx;
}
