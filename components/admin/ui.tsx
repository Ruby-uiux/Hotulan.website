"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { STATUS_META, type OrderStatus } from "@/lib/admin-data";
import { useOverlay } from "@/lib/useOverlay";

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

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "lg";
}

export function Modal({ open, onClose, title, description, children, footer, size = "lg" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose);

  // Focus the first field (or the panel) so keyboard users land inside the dialog.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    (first ?? panelRef.current)?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/40" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex max-h-[94vh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-2xl outline-none sm:rounded-2xl ${
          size === "sm" ? "max-w-md" : "max-w-2xl"
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="modal-title" className="text-base font-bold text-slate-900">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Хаах"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3.5 sm:flex-row sm:justify-end">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Shared button recipes — keeps primary blue reserved for the one confirming action per surface. */
export const btn = {
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50",
  danger:
    "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700",
};

export const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-100";
