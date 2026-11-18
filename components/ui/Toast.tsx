"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export type NoticeTone = "success" | "warning" | "danger" | "info";

/** Toast/Alert colours per design: -50 background, semantic border/ink, solid icon disc. */
const TONE: Record<NoticeTone, { box: string; disc: string; glyph: string }> = {
  success: { box: "bg-green-50 border-success-border text-success-ink", disc: "bg-success", glyph: "✓" },
  warning: { box: "bg-amber-50 border-warning-border text-warning-ink", disc: "bg-warning", glyph: "!" },
  danger: { box: "bg-red-50 border-danger-border text-danger-ink", disc: "bg-danger", glyph: "✕" },
  info: { box: "bg-sky-50 border-info-border text-info-ink", disc: "bg-info", glyph: "i" },
};

interface NoticeBodyProps {
  tone: NoticeTone;
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
}

function NoticeBody({ tone, title, description, onClose }: NoticeBodyProps) {
  const t = TONE[tone];
  return (
    <>
      <span
        aria-hidden="true"
        className={cn("grid size-5.5 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white", t.disc)}
      >
        {t.glyph}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <b className="font-bold">{title}</b>
        {description && <span>{description}</span>}
      </span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Хаах"
          className="-my-1.5 -mr-2 grid size-8 shrink-0 place-items-center rounded-sm transition-colors hover:bg-black/5"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </>
  );
}

const BOX = "flex items-start gap-3 rounded-[10px] border px-4 py-3.5";

/** In-page message. Stays until the condition changes — no close button by default. */
export function Alert({
  tone = "info",
  title,
  description,
  onClose,
  className,
}: Partial<Pick<NoticeBodyProps, "tone">> & Omit<NoticeBodyProps, "tone"> & { className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn(BOX, TONE[tone].box, className)}>
      <NoticeBody tone={tone} title={title} description={description} onClose={onClose} />
    </div>
  );
}

/* ---------------------------------------------------------------- Toasts */

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: NoticeTone;
  /** ms; default 4000 (errors 6000). */
  duration?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, "tone" | "duration">> {
  id: number;
  title: ReactNode;
  description?: ReactNode;
}

interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

/** Mount once near the root. Toasts stack bottom-centre, newest last. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((o: ToastOptions) => {
    const id = nextId.current++;
    const tone = o.tone ?? "success";
    const duration = o.duration ?? (tone === "danger" ? 6000 : 4000);
    setItems((list) => [...list, { id, tone, duration, title: o.title, description: o.description }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [paused, item.id, item.duration, onDismiss]);

  return (
    <div
      role={item.tone === "danger" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(BOX, TONE[item.tone].box, "pointer-events-auto w-full max-w-md animate-pop-in shadow-md")}
    >
      <NoticeBody tone={item.tone} title={item.title} description={item.description} onClose={() => onDismiss(item.id)} />
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider>.");
  return ctx;
}
