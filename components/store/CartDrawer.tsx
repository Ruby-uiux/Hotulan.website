"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatMNT, type Product } from "@/lib/catalog";
import { PAYMENT_LABEL, type PaymentMethod } from "@/lib/admin-data";
import { computeDeliveryFee, type DeliveryZone } from "@/lib/delivery";
import { useOverlay } from "@/lib/useOverlay";
import { Button, Input, Select } from "@/components/ui";
import SafeImage from "./SafeImage";

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CheckoutDetails {
  customer: string;
  phone: string;
  /** Delivery zone id ("khan-uul"). */
  zoneId: string;
  payment: PaymentMethod;
}

export interface PlacedOrder {
  id: string;
  total: number;
  itemCount: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  subtotal: number;
  freeDeliveryThreshold: number;
  oversizedFee: number;
  /** Active delivery districts. */
  zones: DeliveryZone[];
  /** Enabled payment methods, in display order. */
  paymentMethods: PaymentMethod[];
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  /** Submits to the server. Resolves with the stored order or rejects with a user-facing message. */
  onPlaceOrder: (details: CheckoutDetails) => Promise<PlacedOrder>;
}

type Stage = "cart" | "details" | "done";

const emptyDetails = (paymentMethods: PaymentMethod[]): CheckoutDetails => ({
  customer: "",
  phone: "",
  zoneId: "",
  payment: paymentMethods[0] ?? "qpay",
});

export default function CartDrawer({
  open,
  onClose,
  items,
  subtotal,
  freeDeliveryThreshold,
  oversizedFee,
  zones,
  paymentMethods,
  onIncrement,
  onDecrement,
  onRemove,
  onPlaceOrder,
}: CartDrawerProps) {
  const [stage, setStage] = useState<Stage>("cart");
  const [details, setDetails] = useState<CheckoutDetails>(() => emptyDetails(paymentMethods));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmed, setConfirmed] = useState<PlacedOrder | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useOverlay(open, onClose);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
      return;
    }
    // Reset after the slide-out finishes so the panel doesn't visibly jump while closing.
    const timer = window.setTimeout(() => {
      setStage((s) => (s === "done" ? "cart" : s));
      setConfirmed(null);
      setSubmitError(null);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  // If a stock refresh empties the cart while the shopper is on the details step, fall back.
  useEffect(() => {
    if (items.length === 0 && stage === "details") setStage("cart");
  }, [items.length, stage]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const qualifiesForFreeDelivery = subtotal >= freeDeliveryThreshold;
  // Same rule the server charges. Before a district is picked, quote the first central one.
  const zone = zones.find((z) => z.id === details.zoneId) ?? zones.find((z) => z.region === "central") ?? zones[0];
  const deliveryFee =
    subtotal === 0 || !zone
      ? 0
      : computeDeliveryFee({
          zone,
          subtotal,
          freeDeliveryThreshold,
          hasOversized: items.some((i) => i.product.oversized),
          oversizedFee,
        });
  const total = subtotal + deliveryFee;
  const remainingForFree = Math.max(0, freeDeliveryThreshold - subtotal);
  const freeDeliveryProgress = freeDeliveryThreshold > 0 ? Math.min(100, (subtotal / freeDeliveryThreshold) * 100) : 100;

  const phoneDigits = details.phone.replace(/[\s-]/g, "");
  const fieldErrors = {
    customer: details.customer.trim().length < 2 ? "Нэрээ оруулна уу." : undefined,
    phone: /^\d{8}$/.test(phoneDigits) ? undefined : "8 оронтой утасны дугаар оруулна уу.",
    zoneId: details.zoneId ? undefined : "Дүүргээ сонгоно уу.",
  };
  const detailsValid = !fieldErrors.customer && !fieldErrors.phone && !fieldErrors.zoneId;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setShowErrors(true);
    if (!detailsValid) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await onPlaceOrder({ ...details, customer: details.customer.trim(), phone: phoneDigits });
      setConfirmed(order);
      setStage("done");
      setDetails(emptyDetails(paymentMethods));
      setShowErrors(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Захиалга илгээхэд алдаа гарлаа.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = stage === "details" ? "Хүргэлтийн мэдээлэл" : "Таны сагс";

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          {stage === "details" && (
            <button
              type="button"
              onClick={() => setStage("cart")}
              className="-ml-2 grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Сагс руу буцах"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h2 id="cart-title" className="flex flex-1 items-center gap-2 text-lg font-bold text-slate-900">
            {title}
            {itemCount > 0 && stage === "cart" && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{itemCount} бараа</span>
            )}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Сагсыг хаах"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {stage === "done" && confirmed ? (
          <OrderConfirmation order={confirmed} onClose={onClose} />
        ) : items.length === 0 ? (
          <EmptyCart onClose={onClose} freeDeliveryThreshold={freeDeliveryThreshold} />
        ) : stage === "details" ? (
          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <Input
                id="co-name"
                label="Овог нэр"
                autoComplete="name"
                value={details.customer}
                onChange={(e) => setDetails((d) => ({ ...d, customer: e.target.value }))}
                placeholder="Жишээ: Б. Сарангэрэл"
                error={showErrors ? fieldErrors.customer : undefined}
              />
              <Input
                id="co-phone"
                label="Утасны дугаар"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                controlClassName="tabular-nums"
                value={details.phone}
                onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
                placeholder="9911 2345"
                error={showErrors ? fieldErrors.phone : undefined}
              />
              <Select
                label="Дүүрэг (Улаанбаатар)"
                error={showErrors ? fieldErrors.zoneId : undefined}
                placeholder="Сонгох…"
                id="co-district"
                value={details.zoneId}
                onChange={(e) => setDetails((d) => ({ ...d, zoneId: e.target.value }))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.region === "remote" ? `${z.name} (${formatMNT(z.fee)})` : z.name}
                  </option>
                ))}
              </Select>

              <fieldset>
                <legend className="mb-1.5 text-[13px] font-semibold text-slate-900">Төлбөрийн хэлбэр</legend>
                <div className="grid gap-2">
                  {paymentMethods.map((method) => (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        details.payment === method
                          ? "border-brand bg-brand-soft text-brand"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method}
                        checked={details.payment === method}
                        onChange={() => setDetails((d) => ({ ...d, payment: method }))}
                        className="accent-[#0000ff]"
                      />
                      {PAYMENT_LABEL[method]}
                    </label>
                  ))}
                </div>
              </fieldset>

              {submitError && (
                <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {submitError}
                </p>
              )}
            </div>

            <footer className="border-t border-slate-200 px-5 pb-5 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900">Нийт төлөх</span>
                <span className="text-xl font-extrabold tracking-tight text-slate-900">{formatMNT(total)}</span>
              </div>
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={submitting}
                loadingText="Илгээж байна…"
                className="mt-4 shadow-lg shadow-brand/25"
              >
                Захиалга баталгаажуулах
              </Button>
            </footer>
          </form>
        ) : (
          <>
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <p className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <Truck className="h-4 w-4 text-brand" aria-hidden="true" />
                {qualifiesForFreeDelivery ? (
                  <span className="font-semibold text-emerald-700">Танд хүргэлт үнэгүй!</span>
                ) : (
                  <span>
                    Үнэгүй хүргэлтэд <strong className="text-slate-900">{formatMNT(remainingForFree)}</strong> дутуу
                  </span>
                )}
              </p>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(freeDeliveryProgress)}
                aria-label="Үнэгүй хүргэлтийн явц"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${qualifiesForFreeDelivery ? "bg-emerald-500" : "bg-brand"}`}
                  style={{ width: `${freeDeliveryProgress}%` }}
                />
              </div>
            </div>

            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-5">
              {items.map(({ product, quantity }) => {
                const atStockLimit = quantity >= product.stock;
                return (
                  <li key={product.id} className="flex gap-4 py-4">
                    <SafeImage
                      src={product.image}
                      alt={product.title}
                      className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{product.title}</h3>
                        <button
                          type="button"
                          onClick={() => onRemove(product.id)}
                          className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`${product.title} — сагснаас хасах`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">Нэгж үнэ: {formatMNT(product.price)}</p>

                      <div className="mt-auto flex items-end justify-between pt-2">
                        <div>
                          <div className="inline-flex items-center rounded-md border border-slate-200">
                            <button
                              type="button"
                              onClick={() => (quantity === 1 ? onRemove(product.id) : onDecrement(product.id))}
                              className="grid h-8 w-8 place-items-center text-slate-600 transition hover:text-brand"
                              aria-label={quantity === 1 ? "Сагснаас хасах" : "Тоо хэмжээ хасах"}
                            >
                              {quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                            </button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onIncrement(product.id)}
                              disabled={atStockLimit}
                              className="grid h-8 w-8 place-items-center text-slate-600 transition hover:text-brand disabled:cursor-not-allowed disabled:text-slate-300"
                              aria-label="Тоо хэмжээ нэмэх"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {atStockLimit && (
                            <p className="mt-1 text-[11px] font-medium text-amber-600">Үлдэгдэл: {product.stock} ширхэг</p>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900">{formatMNT(product.price * quantity)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <footer className="border-t border-slate-200 bg-white px-5 pb-5 pt-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <dt>Барааны дүн</dt>
                  <dd className="font-medium text-slate-900">{formatMNT(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>Хүргэлт</dt>
                  <dd className={deliveryFee === 0 ? "font-semibold text-emerald-600" : "font-medium text-slate-900"}>
                    {deliveryFee === 0 ? "Үнэгүй" : formatMNT(deliveryFee)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-dashed border-slate-200 pt-3">
                  <dt className="font-semibold text-slate-900">Нийт төлөх</dt>
                  <dd className="text-xl font-extrabold tracking-tight text-slate-900">{formatMNT(total)}</dd>
                </div>
              </dl>
              <p className="mt-1 text-right text-[11px] text-slate-400">НӨАТ орсон үнэ</p>

              <Button
                size="lg"
                fullWidth
                onClick={() => {
                  setSubmitError(null);
                  setStage("details");
                }}
                className="mt-4 shadow-lg shadow-brand/25"
              >
                Захиалга баталгаажуулах
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                QPay, SocialPay, карт — аюулгүй төлбөр
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function EmptyCart({ onClose, freeDeliveryThreshold }: { onClose: () => void; freeDeliveryThreshold: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
        <ShoppingBag className="h-8 w-8" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-slate-900">Таны сагс хоосон байна</h3>
      <p className="mt-2 text-sm text-slate-500">
        Таалагдсан бараагаа “Сагсанд хийх” товчоор нэмээрэй. {formatMNT(freeDeliveryThreshold)}-өөс дээш захиалгад
        хүргэлт үнэгүй.
      </p>
      <Button onClick={onClose} className="mt-6">
        Дэлгүүр хэсэх
      </Button>
    </div>
  );
}

function OrderConfirmation({ order, onClose }: { order: PlacedOrder; onClose: () => void }) {
  return (
    <div className="flex flex-1 animate-pop-in flex-col items-center justify-center px-8 text-center" role="status">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-bold text-slate-900">Захиалга амжилттай баталгаажлаа</h3>
      <p className="mt-2 text-sm text-slate-500">Манай ажилтан 30 минутын дотор тантай холбогдож хүргэлтийн цагийг тохирно.</p>
      <dl className="mt-6 w-full space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Захиалгын дугаар</dt>
          <dd className="font-mono font-bold text-slate-900">{order.id}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Барааны тоо</dt>
          <dd className="font-semibold text-slate-900">{order.itemCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Нийт дүн</dt>
          <dd className="font-bold text-slate-900">{formatMNT(order.total)}</dd>
        </div>
      </dl>
      <Button fullWidth onClick={onClose} className="mt-6">
        Үргэлжлүүлэн дэлгүүр хэсэх
      </Button>
    </div>
  );
}
