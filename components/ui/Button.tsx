import type { ComponentProps } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-700",
  secondary: "bg-slate-900 text-white hover:bg-slate-800",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "bg-transparent text-brand hover:bg-brand-50",
  danger: "bg-danger text-white hover:bg-red-700",
};

/** Heights per design: sm 36 · md 44 · lg 52. */
const HEIGHT: Record<ButtonSize, string> = { sm: "h-9", md: "h-11", lg: "h-13" };
const TEXT: Record<ButtonSize, string> = {
  sm: "px-3.5 text-[13px] font-semibold",
  md: "px-[18px] text-sm font-semibold",
  lg: "px-6 text-base font-bold",
};
const ICON_WIDTH: Record<ButtonSize, string> = { sm: "w-9", md: "w-11", lg: "w-13" };

/** Disabled looks the same for every variant (design: slate-100 / slate-400). */
const DISABLED =
  "disabled:cursor-not-allowed disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button. The caller must pass `aria-label`. */
  iconOnly?: boolean;
  fullWidth?: boolean;
}

/** Class string for anything that should look like a button — e.g. a Next `<Link>`. */
export function buttonClasses({ variant = "primary", size = "md", iconOnly, fullWidth }: ButtonStyleOptions = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md transition-colors",
    VARIANT[variant],
    HEIGHT[size],
    iconOnly ? ICON_WIDTH[size] : TEXT[size],
    fullWidth && "w-full",
  );
}

export interface ButtonProps extends ComponentProps<"button">, ButtonStyleOptions {
  /** Shows a spinner, sets aria-busy and ignores clicks. `loadingText` replaces the label meanwhile. */
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant,
  size,
  iconOnly,
  fullWidth,
  loading = false,
  loadingText,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-busy={loading || undefined}
      // Not `disabled` while loading: that would drop focus out of the button mid-submit.
      aria-disabled={loading || rest["aria-disabled"]}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={cn(buttonClasses({ variant, size, iconOnly, fullWidth }), DISABLED, loading && "cursor-progress opacity-85", className)}
    >
      {loading && <Spinner />}
      {loading && loadingText !== undefined && !iconOnly ? loadingText : children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}
