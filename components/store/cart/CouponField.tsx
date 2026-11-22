"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Quote } from "./useQuote";

/**
 * Coupon input + "Ашиглах" (design/Checkout, design/MCart). The code is kept in the cart;
 * whether it applies — and why not — comes from the server quote.
 */
export default function CouponField({
  coupon,
  setCoupon,
  result,
}: {
  coupon: string | null;
  setCoupon: (code: string | null) => void;
  result: Quote["coupon"] | undefined;
}) {
  const [draft, setDraft] = useState(coupon ?? "");
  useEffect(() => setDraft(coupon ?? ""), [coupon]);

  if (coupon && result?.ok) {
    return (
      <div className="flex h-11 items-center justify-between rounded-md border border-success-border bg-success-soft px-3 text-sm">
        <span>
          Купон <b className="font-bold">{coupon}</b> хэрэглэгдлээ
        </span>
        <button type="button" onClick={() => setCoupon(null)} aria-label="Купон хасах" className="-mr-1.5 grid size-8 place-items-center rounded-sm text-success-ink hover:bg-black/5">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const error = coupon && result && !result.ok ? result.message : null;
  return (
    <div className="flex flex-col gap-1.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCoupon(draft);
        }}
      >
        <label htmlFor="coupon" className="sr-only">
          Купон код
        </label>
        <input
          id="coupon"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Купон код"
          autoCapitalize="characters"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-msg" : undefined}
          className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-body uppercase placeholder:normal-case focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-100)] focus:outline-none aria-invalid:border-danger"
        />
        <button type="submit" disabled={!draft.trim()} className="h-11 shrink-0 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400">
          Ашиглах
        </button>
      </form>
      {error && (
        <p id="coupon-msg" role="alert" className="text-xs font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
