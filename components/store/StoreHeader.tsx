import { Heart, Truck, User } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { formatMNT } from "@/lib/catalog";
import CartButton from "./shell/CartButton";
import { AllCategoriesButton, MenuButton, MobileCategoryDrawer, type MenuCategory } from "./shell/CategoryMenu";
import Logo from "./shell/Logo";
import SearchForm from "./shell/SearchForm";

export interface StoreHeaderProps {
  storeName: string;
  supportPhone: string;
  freeDeliveryThreshold: number;
  /** Admin announcement (Харагдах байдал); replaces the delivery line when enabled. */
  announcement: { text: string; href: string | null } | null;
  /** Visible root categories with their subcategories, in admin order. */
  categories: MenuCategory[];
  /** Roots flagged "show in menu", for the category row. */
  menuCategories: MenuCategory[];
}

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

/** design/StoreHeader (desktop) and the header of design/MHome (phones). */
export default function StoreHeader({ storeName, supportPhone, freeDeliveryThreshold, announcement, categories, menuCategories }: StoreHeaderProps) {
  const deliveryLine = `Зөвхөн Улаанбаатар хотод хүргэнэ · ${formatMNT(freeDeliveryThreshold)}-өөс дээш үнэгүй`;
  const barText = announcement?.text || deliveryLine;
  const bar = announcement?.href ? (
    <Link href={announcement.href} className="hover:text-white">
      {barText}
    </Link>
  ) : (
    barText
  );

  return (
    <header id="site-header" className="relative z-30 border-b border-slate-200 bg-white text-slate-900">
      {/* ——— Phones ——— */}
      <div className="lg:hidden">
        <div className="bg-[#020617] px-4 py-2 text-center text-xs text-slate-200">
          {announcement ? bar : `Зөвхөн Улаанбаатарт · ${formatMNT(freeDeliveryThreshold)}-өөс дээш үнэгүй`}
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <MenuButton />
            <Logo name={storeName} withMark={false} className="flex-1 [&>span]:text-[19px]" />
            <CartButton compact />
          </div>
          <Suspense fallback={<div className="h-11 rounded-md bg-slate-100" />}>
            <SearchForm variant="mobile" />
          </Suspense>
        </div>
        <MobileCategoryDrawer categories={categories} />
      </div>

      {/* ——— Desktop ——— */}
      <div className="hidden lg:block">
        <div className="bg-[#020617] text-[13px] text-slate-300">
          <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-x-6 gap-y-2 px-6 py-[9px]">
            <span className="flex items-center gap-2">
              <Truck className="size-4" aria-hidden="true" />
              {bar}
            </span>
            <span className="flex gap-5">
              <Link href="/track" className="hover:text-white">
                Захиалга хянах
              </Link>
              <Link href="/info/delivery" className="hover:text-white">
                Хүргэлт, буцаалт
              </Link>
              <a href={telHref(supportPhone)} className="font-semibold text-white">
                {supportPhone}
              </a>
            </span>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-6 py-4">
          <Logo name={storeName} />
          <AllCategoriesButton categories={categories} />
          <Suspense fallback={<div className="h-11 flex-[1_1_360px] rounded-md border-[1.5px] border-brand" />}>
            <SearchForm variant="desktop" />
          </Suspense>
          <nav aria-label="Хэрэглэгч" className="flex items-center gap-1">
            <Link href="/login" className="flex h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors hover:bg-slate-50">
              <User className="size-5" strokeWidth={1.8} aria-hidden="true" />
              Нэвтрэх
            </Link>
            <Link href="/saved" className="flex h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-medium transition-colors hover:bg-slate-50">
              <Heart className="size-5" strokeWidth={1.8} aria-hidden="true" />
              Хадгалсан
            </Link>
            <CartButton />
          </nav>
        </div>

        <nav aria-label="Ангилал" className="border-t border-slate-100">
          <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-6 text-sm font-medium whitespace-nowrap [scrollbar-width:none]">
            <Link href="/search?sale=1" className="px-3 py-3 font-bold text-danger hover:underline">
              Хямдрал
            </Link>
            <Link href="/search?sort=new" className="px-3 py-3 hover:text-brand">
              Шинэ бараа
            </Link>
            {menuCategories.map((c) => (
              <Link key={c.id} href={`/c/${c.slug}`} className="px-3 py-3 hover:text-brand">
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
