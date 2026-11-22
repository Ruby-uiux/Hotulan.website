import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/store/listing/Listing";
import CategoryIcon from "@/components/store/shell/CategoryIcon";
import { getStoreShell } from "@/lib/server/storefront";

export const metadata: Metadata = {
  title: "Бүх ангилал",
  description: "Дэлгүүрийн бүх ангилал, дэд ангилал.",
  alternates: { canonical: "/c" },
};

/** Every visible category with its subcategories ("Бүгдийг харах" on the home page). */
export default async function AllCategoriesPage() {
  const { tree } = await getStoreShell();
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 pt-4 pb-16 lg:px-6 lg:pt-5">
      <Breadcrumbs items={[{ label: "Нүүр", href: "/" }, { label: "Бүх ангилал" }]} />
      <h1 className="text-2xl font-extrabold tracking-[-0.02em] lg:text-[32px]">Бүх ангилал</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tree.map((c) => (
          <section key={c.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <Link href={`/c/${c.slug}`} className="flex items-center gap-3 font-bold hover:text-brand">
              <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand">
                <CategoryIcon icon={c.icon} />
              </span>
              <span className="flex flex-col">
                {c.name}
                <span className="text-[13px] font-normal text-slate-500">{c.productCount} бараа</span>
              </span>
            </Link>
            {c.children.length > 0 && (
              <ul className="mt-3 space-y-1.5 pl-14 text-sm text-slate-600">
                {c.children.map((s) => (
                  <li key={s.id}>
                    <Link href={`/c/${s.slug}`} className="hover:text-brand">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
