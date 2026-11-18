"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label. Without it, pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
  className?: string;
}

/** 40×22 track with an 18px knob; the hit area is padded out to 44px tall. */
export function Switch({ checked, onCheckedChange, label, description, disabled, id, className, ...aria }: SwitchProps) {
  const auto = useId();
  const switchId = id ?? auto;
  const labelId = `${switchId}-label`;
  const descId = `${switchId}-desc`;

  const control = (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ? undefined : aria["aria-label"]}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
        "before:absolute before:-inset-x-1 before:-inset-y-[11px] before:content-['']",
        checked ? "bg-brand" : "bg-slate-300",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-4.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );

  if (!label) return <span className={cn("inline-flex", className)}>{control}</span>;

  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-0.5">
        <span
          id={labelId}
          className={cn("text-sm font-medium", disabled ? "text-slate-400" : "text-slate-900")}
          // Clicking the text toggles too, like a native label.
          onClick={() => !disabled && onCheckedChange(!checked)}
        >
          {label}
        </span>
        {description && (
          <span id={descId} className="text-[13px] text-slate-500">
            {description}
          </span>
        )}
      </div>
      {control}
    </div>
  );
}
