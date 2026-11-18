"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useOverlay } from "@/lib/useOverlay";
import { Button } from "./Button";
import { cn } from "./cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type ModalSize = "sm" | "md" | "lg";
const WIDTH: Record<ModalSize, string> = { sm: "sm:max-w-[400px]", md: "sm:max-w-xl", lg: "sm:max-w-3xl" };

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action row. On phones buttons stack with the primary one on top. */
  footer?: ReactNode;
  size?: ModalSize;
  /** Hide the ✕ in the header (e.g. ConfirmDialog, which has its own Cancel). */
  hideClose?: boolean;
  /** Block backdrop/Escape close while something is saving. */
  dismissible?: boolean;
}

/**
 * Accessible dialog: focus moves inside on open, Tab is trapped, Escape and backdrop
 * close, focus returns to the trigger on close. Bottom sheet on phones, centred above sm.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  hideClose,
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const close = () => {
    if (dismissible) onClose();
  };
  useOverlay(open, close);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Prefer an explicit [data-autofocus], then the first form field, then the panel itself.
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), textarea:not([disabled])");
    (first ?? panel)?.focus();
    return () => trigger?.focus?.();
  }, [open]);

  if (!open) return null;

  const trapTab = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) return e.preventDefault();
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={close} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onKeyDown={trapTab}
        className={cn(
          "relative flex max-h-[94dvh] w-full animate-pop-in flex-col rounded-t-xl bg-white shadow-lg outline-none sm:rounded-[14px]",
          WIDTH[size],
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="min-w-0">
            <h2 id={titleId} className="text-h3 text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-relaxed text-slate-600">
                {description}
              </p>
            )}
          </div>
          {!hideClose && (
            <button
              type="button"
              onClick={close}
              aria-label="Хаах"
              className="-mt-1.5 -mr-2.5 grid size-10 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="size-4.5" aria-hidden="true" />
            </button>
          )}
        </header>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>}
        {footer && (
          <footer className="flex flex-col-reverse gap-2 px-6 pt-2 pb-6 sm:flex-row sm:justify-end">{footer}</footer>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = red icon + red confirm (delete, cancel order). */
  tone?: "danger" | "primary";
  /** While true the confirm button spins and the dialog can't be dismissed. */
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Батлах",
  cancelLabel = "Болих",
  tone = "danger",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      hideClose
      dismissible={!loading}
      title={
        <span className="flex flex-col gap-3.5">
          {tone === "danger" && (
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="size-5" />
            </span>
          )}
          {title}
        </span>
      }
      description={description}
      footer={
        <>
          {/* Focus lands on the safe choice, so a stray Enter never deletes anything. */}
          <Button variant="outline" onClick={onClose} disabled={loading} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
