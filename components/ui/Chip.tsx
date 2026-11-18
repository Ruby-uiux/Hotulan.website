import type { ComponentProps } from "react";
import { cn } from "./cn";

export interface ChipProps extends ComponentProps<"button"> {
  selected?: boolean;
}

/** Pill toggle for filters and quick picks (36px tall). Announces state via aria-pressed. */
export function Chip({ selected = false, className, type = "button", children, ...rest }: ChipProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "bg-slate-900 font-semibold text-white"
          : "border border-slate-300 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
