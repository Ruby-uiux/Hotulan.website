import { CATEGORY_ICONS, isCategoryIcon } from "@/lib/categories";

/** The admin-chosen line icon for a category (24×24 stroke paths from the design). */
export default function CategoryIcon({ icon, className = "size-5" }: { icon: string | null; className?: string }) {
  const d = isCategoryIcon(icon) ? CATEGORY_ICONS[icon] : CATEGORY_ICONS.bag;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}
