"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { STATUS_META, type OrderStatus } from "@/lib/admin-data";

/*
 * Admin-only domain pieces. Generic controls (Button, Input, Select, Modal,
 * ConfirmDialog…) live in components/ui — import them from "@/components/ui".
 */

export function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(stock: number, threshold: number): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

const STOCK_BADGE: Record<StockLevel, { label: string; className: string }> = {
  out: { label: "Дууссан", className: "bg-rose-50 text-rose-700 ring-rose-200" },
  low: { label: "Бага үлдэгдэл", className: "bg-amber-50 text-amber-800 ring-amber-200" },
  ok: { label: "Хангалттай", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  const level = stockLevel(stock, threshold);
  const { label, className } = STOCK_BADGE[level];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-lg bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
