"use client";

import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { useCart } from "../cart/CartProvider";
import { useShell } from "./ShellProvider";

const item = "relative flex flex-col items-center justify-center gap-[3px] text-[11px]";
const tone = (active: boolean) => (active ? "font-bold text-brand" : "font-medium text-slate-600");

function Tab({ active, label, icon, children }: { active: boolean; label: string; icon: ReactNode; children?: ReactNode }) {
  return (
    <>
      {icon}
      {label}
      {children}
      {active && <span className="sr-only">(одоогийн хуудас)</span>}
    </>
  );
}

/** Fixed bottom navigation on phones (design/MHome): Нүүр · Ангилал · Сагс · Миний. */
export default function MobileTabBar() {
  const pathname = usePathname();
  const { openMenu, menuOpen } = useShell();
  const { count, ready, open, isOpen } = useCart();
  const shown = ready ? count : 0;

  const home = pathname === "/";
  const browsing = menuOpen || pathname.startsWith("/c");
  const mine = pathname.startsWith("/orders") || pathname.startsWith("/login");

  return (
    <nav
      aria-label="Үндсэн"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Link href="/" aria-current={home ? "page" : undefined} className={cn(item, tone(home))}>
        <Tab active={home} label="Нүүр" icon={<Home className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />} />
      </Link>
      <button type="button" onClick={openMenu} className={cn(item, tone(browsing))}>
        <Tab active={false} label="Ангилал" icon={<LayoutGrid className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />} />
      </button>
      <button type="button" onClick={open} aria-label={shown > 0 ? `Сагс, ${shown} бараа` : "Сагс"} className={cn(item, tone(isOpen))}>
        <Tab active={false} label="Сагс" icon={<ShoppingCart className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />}>
          {shown > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-2 left-[calc(50%+4px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-[5px] text-[11px] leading-none font-bold text-white tabular-nums"
            >
              {shown > 99 ? "99+" : shown}
            </span>
          )}
        </Tab>
      </button>
      <Link href="/orders" aria-current={mine ? "page" : undefined} className={cn(item, tone(mine))}>
        <Tab active={mine} label="Миний" icon={<User className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />} />
      </Link>
    </nav>
  );
}
