"use client";

import {
  ChevronsLeft,
  ExternalLink,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import type { AdminView } from "@/lib/admin-data";

export const NAV_ITEMS: ReadonlyArray<{ id: AdminView; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Хяналтын панел", icon: LayoutDashboard },
  { id: "products", label: "Барааны удирдлага", icon: Package },
  { id: "orders", label: "Захиалгын удирдлага", icon: ShoppingBag },
  { id: "settings", label: "Тохиргоо", icon: Settings },
];

interface SidebarProps {
  view: AdminView;
  onNavigate: (view: AdminView) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Per-item counters that need attention (new orders, low stock). */
  badges: Partial<Record<AdminView, number>>;
}

export default function Sidebar({
  view,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  badges,
}: SidebarProps) {
  // On mobile the drawer always shows labels; "collapsed" only applies from lg up.
  const compact = collapsed;

  return (
    <>
      <div
        onClick={onCloseMobile}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Админ цэс"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-[transform,width] duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${compact ? "lg:w-[4.5rem]" : "lg:w-64"}`}
      >
        <div className={`flex h-16 items-center gap-2.5 border-b border-slate-200 px-4 ${compact ? "lg:justify-center lg:px-0" : ""}`}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-white">
            <Store className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className={`min-w-0 leading-tight ${compact ? "lg:hidden" : ""}`}>
            <p className="truncate text-sm font-extrabold tracking-tight text-slate-900">
              hotulan<span className="text-brand">.mn</span>
            </p>
            <span className="mt-0.5 inline-block rounded bg-slate-900 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">
              Admin
            </span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Цэс хаах"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${compact ? "lg:sr-only" : ""}`}>
            Үндсэн цэс
          </p>
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = id === view;
              const badge = badges[id];
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(id)}
                    aria-current={active ? "page" : undefined}
                    title={compact ? label : undefined}
                    className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      compact ? "lg:justify-center lg:px-0" : ""
                    } ${active ? "bg-brand-soft text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" aria-hidden="true" />}
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={`flex-1 text-left ${compact ? "lg:sr-only" : ""}`}>{label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
                          active ? "bg-brand text-white" : "bg-slate-200 text-slate-700"
                        } ${compact ? "lg:absolute lg:right-1.5 lg:top-1 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]" : ""}`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-1 border-t border-slate-200 p-3">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            title={compact ? "Дэлгүүр харах" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 ${
              compact ? "lg:justify-center lg:px-0" : ""
            }`}
          >
            <ExternalLink className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={compact ? "lg:sr-only" : ""}>Дэлгүүр харах</span>
          </a>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={`hidden w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:flex ${
              compact ? "lg:justify-center lg:px-0" : ""
            }`}
            aria-label={compact ? "Цэсийг дэлгэх" : "Цэсийг хураах"}
          >
            <ChevronsLeft className={`h-5 w-5 shrink-0 transition-transform ${compact ? "rotate-180" : ""}`} aria-hidden="true" />
            <span className={compact ? "lg:sr-only" : ""}>Цэс хураах</span>
          </button>
        </div>
      </aside>
    </>
  );
}
