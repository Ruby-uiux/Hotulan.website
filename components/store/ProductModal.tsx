"use client";

import { CheckCircle2, Minus, Plus, RotateCcw, ShieldCheck, ShoppingCart, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MAX_PER_PRODUCT, formatMNT, purchaseLimit, type Product } from "@/lib/catalog";
import { useCatalog } from "./CatalogContext";
import { useOverlay } from "@/lib/useOverlay";
import Rating from "./Rating";
import SafeImage from "./SafeImage";

interface ProductModalProps {
  product: Product | null;
  quantityInCart: number;
  onClose: () => void;
  onAddToCart: (productId: string, quantity: number) => void;
}

export default function ProductModal({ product, ...rest }: ProductModalProps) {
  if (!product) return null;
  // Keyed by id so the quantity stepper resets when a different product is opened.
  return <ProductDialog key={product.id} product={product} {...rest} />;
}

function ProductDialog({
  product,
  quantityInCart,
  onClose,
  onAddToCart,
}: Omit<ProductModalProps, "product"> & { product: Product }) {
  const { categoryName } = useCatalog();
  const available = Math.max(0, purchaseLimit(product) - quantityInCart);
  const [quantity, setQuantity] = useState(available > 0 ? 1 : 0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useOverlay(true, onClose);
  useEffect(() => closeRef.current?.focus(), []);

  const soldOut = product.stock === 0;
  const savings = product.compareAtPrice ? product.compareAtPrice - product.price : 0;
  const warrantyText =
    product.warrantyMonths >= 12 && product.warrantyMonths % 12 === 0
      ? `${product.warrantyMonths / 12} жил`
      : `${product.warrantyMonths} сар`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div onClick={onClose} className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-dialog-title"
        className="relative flex max-h-[92vh] w-full max-w-5xl animate-pop-in flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl md:flex-row"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-slate-600 shadow-md backdrop-blur transition hover:bg-white hover:text-slate-900"
          aria-label="Хаах"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative shrink-0 bg-slate-100 md:w-1/2">
          <SafeImage
            eager
            src={product.image.replace("w=900", "w=1400")}
            alt={product.title}
            className="aspect-[4/3] h-full w-full object-cover md:aspect-auto"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">
              {product.brand} · {categoryName(product.category)}
            </p>
            <h2 id="product-dialog-title" className="mt-2 pr-8 text-2xl font-bold leading-tight text-slate-900">
              {product.title}
            </h2>
            <div className="mt-3">
              <Rating value={product.rating} count={product.reviewCount} size="md" />
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-extrabold tracking-tight text-slate-900">{formatMNT(product.price)}</p>
              {product.compareAtPrice && (
                <>
                  <p className="text-base text-slate-400 line-through">{formatMNT(product.compareAtPrice)}</p>
                  <p className="rounded-sm bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">
                    {formatMNT(savings)} хэмнэнэ
                  </p>
                </>
              )}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-slate-600">{product.description}</p>

            <section className="mt-6" aria-labelledby="features-heading">
              <h3 id="features-heading" className="text-sm font-bold text-slate-900">
                Онцлог
              </h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {product.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6" aria-labelledby="specs-heading">
              <h3 id="specs-heading" className="text-sm font-bold text-slate-900">
                Техникийн үзүүлэлт
              </h3>
              <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 text-sm">
                {product.specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5 odd:bg-slate-50/70">
                    <dt className="text-slate-500">{s.label}</dt>
                    <dd className="font-medium text-slate-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section
              aria-label="Баталгаа ба хүргэлт"
              className="mt-6 grid gap-3 rounded-2xl border border-brand/15 bg-brand-soft/60 p-4 text-sm sm:grid-cols-3"
            >
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <strong className="block text-slate-900">{warrantyText} баталгаа</strong>
                  <span className="text-xs text-slate-600">Албан ёсны засвар үйлчилгээ</span>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <strong className="block text-slate-900">24 цагт хүргэнэ</strong>
                  <span className="text-xs text-slate-600">Улаанбаатар хот дотор</span>
                </span>
              </p>
              <p className="flex items-start gap-2">
                <RotateCcw className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <strong className="block text-slate-900">7 хоногт буцаалт</strong>
                  <span className="text-xs text-slate-600">Савлагаа гэмтээгүй бол</span>
                </span>
              </p>
            </section>
          </div>

          <div className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:px-8">
            {soldOut ? (
              <p className="rounded-lg bg-slate-100 py-3 text-center text-sm font-semibold text-slate-600">
                Энэ бараа одоогоор дууссан байна
              </p>
            ) : available === 0 ? (
              <p className="rounded-lg bg-amber-50 py-3 text-center text-sm font-semibold text-amber-700">
                {product.stock > MAX_PER_PRODUCT
                  ? `Нэг захиалгад ${MAX_PER_PRODUCT} ширхэг хүртэл — сагсанд ${quantityInCart} байна`
                  : `Үлдэгдэл бүхэлдээ таны сагсанд байна (${quantityInCart} ширхэг)`}
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <div className="inline-flex h-12 items-center rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="grid h-12 w-11 place-items-center text-slate-600 transition hover:text-brand disabled:text-slate-300"
                    aria-label="Тоо хэмжээ хасах"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(available, q + 1))}
                    disabled={quantity >= available}
                    className="grid h-12 w-11 place-items-center text-slate-600 transition hover:text-brand disabled:text-slate-300"
                    aria-label="Тоо хэмжээ нэмэх"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onAddToCart(product.id, quantity)}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-brand text-sm font-bold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark active:scale-[0.99]"
                >
                  <ShoppingCart className="h-4.5 w-4.5" aria-hidden="true" />
                  Сагсанд хийх · {formatMNT(product.price * quantity)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
