/**
 * Dynamic categories (admin-managed). Client-safe: types, icon set and tree helpers.
 * One level of nesting: root categories and their subcategories.
 */

export interface Category {
  id: string;
  /** URL segment: /c/[slug]. Unique across all categories. */
  slug: string;
  name: string;
  /** null for a root category. */
  parentId: string | null;
  /** Key into CATEGORY_ICONS. */
  icon: string | null;
  /** Header/banner image for the category page. */
  image: string | null;
  sortOrder: number;
  /** Hidden by an admin. Separately, roots with 0 visible products are auto-hidden on the storefront. */
  hidden: boolean;
  showOnHome: boolean;
  showInMenu: boolean;
}

export interface CategoryNode extends Category {
  children: Category[];
  /** Visible products in this category including its subcategories. */
  productCount: number;
}

/** Line icons from design/Main.dc.html (24×24, stroke). Admin picks one per category. */
export const CATEGORY_ICONS = {
  toys: "M4 4h7v7H4zM13 4h7v7h-7zM8.5 13h7v7h-7z",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  tv: "M3 6h18v11H3zM8 21h8M12 17v4",
  sport: "M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12",
  pot: "M3 11h18M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M8 7c0-1 1-2 2-2M14 7c0-1 1-2 2-2",
  beauty:
    "M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  shirt: "M8 3 4 5 2 9l4 2v10h12V11l4-2-2-4-4-2c0 2-2 3-4 3S8 5 8 3z",
  shoe: "M3 16v-5l4-1 3-5 2 1-1 4 9 3a2 2 0 0 1 1 2v1zM3 19h18",
  bag: "M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2",
  book: "M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z",
  phone: "M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2",
  laptop: "M4 5h16v10H4zM2 19h20",
  sofa: "M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M2 12a2 2 0 0 1 4 0v2h12v-2a2 2 0 0 1 4 0v5H2zM5 17v3M19 17v3",
  health: "M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2C3.2 14 12 20 12 20s8.8-6 8.8-11.4zM3.5 12h4l2-3 3 5 2-2h5",
  baby: "M9 3h6M10 3v3L8 8v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8l-2-2V3M8 12h8",
  pet: "M12 11c-3 0-6 4-6 7a2 2 0 0 0 2 2c1.5 0 2.5-1 4-1s2.5 1 4 1a2 2 0 0 0 2-2c0-3-3-7-6-7zM7 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM14 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  car: "M5 17h14M3 17v-4l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4h-2M3 13h18M7 17v2M17 17v2",
  tent: "M3 20 12 4l9 16zM12 4v16M9 20l3-5 3 5",
  food: "M12 7c-2-2-6-1-7 2-1 4 1 9 4 11 1 .7 2 .5 3 0 1 .5 2 .7 3 0 3-2 5-7 4-11-1-3-5-4-7-2zM12 7c0-2 1-4 3-4",
  garden: "M12 21V11M12 11C12 7 9 5 5 5c0 4 3 6 7 6zM12 13c0-4 3-6 7-6 0 4-3 6-7 6z",
} as const;

export type CategoryIconKey = keyof typeof CATEGORY_ICONS;

export function isCategoryIcon(key: unknown): key is CategoryIconKey {
  return typeof key === "string" && Object.hasOwn(CATEGORY_ICONS, key);
}

const bySort = (a: Category, b: Category) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "mn");

/**
 * Builds the root → children tree with product counts.
 * `countsByCategory` maps a category id (root or child) to its own product count.
 */
export function buildCategoryTree(categories: Category[], countsByCategory: Record<string, number> = {}): CategoryNode[] {
  const roots = categories.filter((c) => c.parentId === null).sort(bySort);
  return roots.map((root) => {
    const children = categories.filter((c) => c.parentId === root.id).sort(bySort);
    const productCount = (countsByCategory[root.id] ?? 0) + children.reduce((s, c) => s + (countsByCategory[c.id] ?? 0), 0);
    return { ...root, children, productCount };
  });
}

/**
 * What shoppers see: admin-hidden categories are dropped, and so is any category
 * (root or child) with no visible products.
 */
export function storefrontCategories(tree: CategoryNode[], countsByCategory: Record<string, number>): CategoryNode[] {
  return tree
    .filter((root) => !root.hidden && root.productCount > 0)
    .map((root) => ({ ...root, children: root.children.filter((c) => !c.hidden && (countsByCategory[c.id] ?? 0) > 0) }));
}

/** id → display name, for labels on cards, tables and search. */
export function categoryNameMap(categories: Category[]): Record<string, string> {
  return Object.fromEntries(categories.map((c) => [c.id, c.name]));
}

/** Lowercase latin/cyrillic slug: letters, digits and single dashes. */
export const SLUG_PATTERN = /^[a-z0-9а-яөүё]+(?:-[a-z0-9а-яөүё]+)*$/;
