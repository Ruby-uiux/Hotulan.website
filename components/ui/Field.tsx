"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Text inputs, select and textarea share one shell: label 13/600 above, helper or
 * error text 12px below, linked to the control through aria-describedby.
 */

interface FieldOwnProps {
  label?: ReactNode;
  /** Helper text under the control. Hidden while `error` is shown. */
  hint?: ReactNode;
  /** Error message. Turns the field red and sets aria-invalid. */
  error?: ReactNode;
  /** Adds a red asterisk to the label and sets `required`. */
  required?: boolean;
  /** Class for the outer wrapper (layout only). */
  className?: string;
  /** Class for the box around the control — width (`w-32`) or `tabular-nums`, never colours or height. */
  controlClassName?: string;
}

const CONTROL =
  "w-full rounded-md border bg-white px-3 text-body text-slate-900 placeholder:text-slate-400 transition-[border-color,box-shadow] " +
  "focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden " +
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500";

/** Design: 1.5px border (1px + 0.5px inset-free shadow) and a 3px soft ring on focus. Error stays red while focused. */
const CONTROL_OK =
  "border-slate-300 focus:border-brand focus:shadow-[0_0_0_0.5px_var(--color-brand),0_0_0_3px_var(--color-brand-100)]";
const CONTROL_ERROR =
  "border-danger shadow-[0_0_0_0.5px_var(--color-danger)] focus:shadow-[0_0_0_0.5px_var(--color-danger),0_0_0_3px_var(--color-danger-soft)]";

function useFieldIds(id: string | undefined) {
  const auto = useId();
  const controlId = id ?? auto;
  return { controlId, messageId: `${controlId}-msg` };
}

function FieldShell({
  controlId,
  messageId,
  label,
  hint,
  error,
  required,
  disabled,
  className,
  controlClassName,
  children,
}: FieldOwnProps & { controlId: string; messageId: string; disabled?: boolean; children: ReactNode }) {
  const message = error || hint;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={controlId}
          className={cn("text-[13px] font-semibold", error ? "text-danger-ink" : disabled ? "text-slate-500" : "text-slate-900")}
        >
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
      )}
      <div className={cn("relative", controlClassName)}>{children}</div>
      {message && (
        <p
          id={messageId}
          className={cn("text-xs", error ? "font-medium text-danger-ink" : "text-slate-500")}
          // Errors appear after a submit attempt; announce them.
          role={error ? "alert" : undefined}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function controlA11y(
  own: { "aria-invalid"?: ComponentProps<"input">["aria-invalid"]; "aria-describedby"?: string },
  error: ReactNode,
  hint: ReactNode,
  messageId: string,
) {
  const hasMessage = Boolean(error || hint);
  return {
    "aria-invalid": error ? true : own["aria-invalid"],
    "aria-describedby": [own["aria-describedby"], hasMessage ? messageId : undefined].filter(Boolean).join(" ") || undefined,
  };
}

export type InputProps = FieldOwnProps &
  Omit<ComponentProps<"input">, "className"> & {
    /** Decorative icon inside the left edge (e.g. a search glass). Not clickable. */
    leading?: ReactNode;
    /** Interactive slot inside the right edge (clear ✕, show password). Give buttons an aria-label. */
    trailing?: ReactNode;
  };

export function Input({ label, hint, error, required, className, controlClassName, id, leading, trailing, ...rest }: InputProps) {
  const { controlId, messageId } = useFieldIds(id);
  return (
    <FieldShell
      {...{ controlId, messageId, label, hint, error, required, className, controlClassName }}
      disabled={rest.disabled}
    >
      {leading && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 grid -translate-y-1/2 place-items-center text-slate-400"
        >
          {leading}
        </span>
      )}
      <input
        {...rest}
        {...controlA11y(rest, error, hint, messageId)}
        id={controlId}
        required={required}
        className={cn(CONTROL, "h-11", leading ? "pl-9" : undefined, trailing ? "pr-11" : undefined, error ? CONTROL_ERROR : CONTROL_OK)}
      />
      {trailing && <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">{trailing}</span>}
    </FieldShell>
  );
}

export type TextareaProps = FieldOwnProps & Omit<ComponentProps<"textarea">, "className">;

export function Textarea({ label, hint, error, required, className, controlClassName, id, rows = 4, ...rest }: TextareaProps) {
  const { controlId, messageId } = useFieldIds(id);
  return (
    <FieldShell
      {...{ controlId, messageId, label, hint, error, required, className, controlClassName }}
      disabled={rest.disabled}
    >
      <textarea
        {...rest}
        {...controlA11y(rest, error, hint, messageId)}
        id={controlId}
        rows={rows}
        required={required}
        className={cn(CONTROL, "block min-h-24 resize-y py-2.5 leading-normal", error ? CONTROL_ERROR : CONTROL_OK)}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = FieldOwnProps &
  Omit<ComponentProps<"select">, "className"> & {
    /** Options to render. Alternatively pass `<option>` children. */
    options?: ReadonlyArray<SelectOption>;
    /** Adds a first, empty option (e.g. "Сонгоно уу"). It can't be re-picked once a value is chosen. */
    placeholder?: string;
  };

/** Native select — best keyboard and mobile behaviour, per design. */
export function Select({
  label,
  hint,
  error,
  required,
  className,
  controlClassName,
  id,
  options,
  placeholder,
  children,
  ...rest
}: SelectProps) {
  const { controlId, messageId } = useFieldIds(id);
  return (
    <FieldShell
      {...{ controlId, messageId, label, hint, error, required, className, controlClassName }}
      disabled={rest.disabled}
    >
      <select
        {...rest}
        {...controlA11y(rest, error, hint, messageId)}
        id={controlId}
        required={required}
        className={cn(CONTROL, "h-11 cursor-pointer pl-2.5 disabled:cursor-not-allowed", error ? CONTROL_ERROR : CONTROL_OK)}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
    </FieldShell>
  );
}

type ChoiceProps = Omit<ComponentProps<"input">, "type" | "className"> & {
  label: ReactNode;
  className?: string;
};

function Choice({ type, label, className, ...rest }: ChoiceProps & { type: "checkbox" | "radio" }) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-900",
        rest.disabled && "cursor-not-allowed text-slate-400",
        className,
      )}
    >
      <input {...rest} type={type} className="size-4.5 shrink-0 accent-brand disabled:cursor-not-allowed" />
      {label}
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} type="checkbox" />;
}

export function Radio(props: ChoiceProps) {
  return <Choice {...props} type="radio" />;
}
