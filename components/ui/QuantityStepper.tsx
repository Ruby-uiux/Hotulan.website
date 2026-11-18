"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "./cn";

export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Usually the product's stock. The + button disables at this value. */
  max?: number;
  /** md is 44px (design default); sm is 36px for dense lists like the cart. */
  size?: "sm" | "md";
  disabled?: boolean;
  /** What is being counted, for screen readers — e.g. the product title. */
  itemLabel?: string;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  size = "md",
  disabled,
  itemLabel,
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;
  const btn = cn(
    "grid h-full place-items-center text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent",
    size === "md" ? "w-11" : "w-9",
  );
  const suffix = itemLabel ? ` — ${itemLabel}` : "";

  return (
    <div
      role="group"
      aria-label={itemLabel ? `Тоо ширхэг — ${itemLabel}` : "Тоо ширхэг"}
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-md border border-slate-300 bg-white",
        size === "md" ? "h-11" : "h-9",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        className={btn}
        aria-label={`Хасах${suffix}`}
        disabled={disabled || atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" className="grid w-9 place-items-center text-sm font-bold tabular-nums text-slate-900">
        {value}
      </output>
      <button
        type="button"
        className={btn}
        aria-label={`Нэмэх${suffix}`}
        disabled={disabled || atMax}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
