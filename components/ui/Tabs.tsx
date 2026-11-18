"use client";

import { useRef, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "./cn";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Optional trailing count, e.g. orders per status. */
  count?: number;
}

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab/panel ids; use the same one with `tabPanelProps`. */
  idPrefix: string;
  className?: string;
}

const tabId = (prefix: string, value: string) => `${prefix}-tab-${value}`;
const panelId = (prefix: string, value: string) => `${prefix}-panel-${value}`;

/** Spread onto the element that shows the active tab's content. */
export function tabPanelProps(idPrefix: string, value: string): ComponentProps<"div"> {
  return { role: "tabpanel", id: panelId(idPrefix, value), "aria-labelledby": tabId(idPrefix, value), tabIndex: 0 };
}

/** Underline tabs. Arrow keys / Home / End move between tabs (roving tabindex). */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    const i = items.findIndex((t) => t.value === value);
    const next =
      e.key === "ArrowRight" ? (i + 1) % items.length
      : e.key === "ArrowLeft" ? (i - 1 + items.length) % items.length
      : e.key === "Home" ? 0
      : e.key === "End" ? items.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(items[next].value);
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(tabId(idPrefix, items[next].value))}`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex overflow-x-auto border-b border-slate-200 [scrollbar-width:none]", className)}
    >
      {items.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            id={tabId(idPrefix, t.value)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idPrefix, t.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-sm whitespace-nowrap transition-colors",
              selected ? "border-brand font-bold text-brand" : "border-transparent font-medium text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
                  selected ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
