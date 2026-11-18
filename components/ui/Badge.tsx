import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Solid tones are the storefront product labels (−20%, Шинэ, Эрэлттэй, Дууссан).
 * Soft tones are for admin state (stock, payment, etc.) — always paired with text.
 */
export type BadgeTone = "sale" | "new" | "hot" | "soldout" | "success" | "warning" | "danger" | "info" | "brand" | "neutral";

const SOLID: Record<BadgeTone, string> = {
  sale: "bg-danger text-white",
  new: "bg-brand text-white",
  hot: "bg-slate-900 text-white",
  soldout: "bg-slate-600 text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-danger text-white",
  info: "bg-info text-white",
  brand: "bg-brand text-white",
  neutral: "bg-slate-600 text-white",
};

const SOFT: Record<BadgeTone, string> = {
  sale: "bg-danger-soft text-danger-ink",
  new: "bg-brand-50 text-brand-700",
  hot: "bg-slate-100 text-slate-900",
  soldout: "bg-slate-100 text-slate-700",
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  info: "bg-info-soft text-info-ink",
  brand: "bg-brand-50 text-brand-700",
  neutral: "bg-slate-100 text-slate-700",
};

export interface BadgeProps {
  tone?: BadgeTone;
  variant?: "solid" | "soft";
  /** Small leading dot (soft variant), useful for status lists. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = "neutral", variant = "solid", dot, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-xs leading-none font-bold",
        variant === "solid" ? SOLID[tone] : SOFT[tone],
        className,
      )}
    >
      {dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Round red counter, e.g. the cart icon. Renders nothing at 0. */
export function CountBadge({ count, max = 99, label, className }: { count: number; max?: number; label?: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] leading-none font-bold text-white tabular-nums",
        className,
      )}
      aria-label={label}
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
