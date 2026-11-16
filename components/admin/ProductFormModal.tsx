"use client";

import { ImageOff } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { formatMNT, type CategoryId, type Product } from "@/lib/catalog";
import { CATEGORY_OPTIONS } from "@/lib/admin-data";
import SafeImage from "@/components/store/SafeImage";
import { Modal, btn, inputClass } from "./ui";

interface ProductFormModalProps {
  open: boolean;
  /** null = creating a new product. */
  product: Product | null;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

interface FormState {
  title: string;
  category: CategoryId;
  regularPrice: string;
  salePrice: string;
  stock: string;
  description: string;
  image: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

function toFormState(p: Product | null): FormState {
  if (!p) {
    return { title: "", category: "toys", regularPrice: "", salePrice: "", stock: "0", description: "", image: "" };
  }
  // Catalog stores the selling price in `price` and the pre-discount price in `compareAtPrice`.
  const onSale = p.compareAtPrice !== undefined && p.compareAtPrice > p.price;
  return {
    title: p.title,
    category: p.category,
    regularPrice: String(onSale ? p.compareAtPrice : p.price),
    salePrice: onSale ? String(p.price) : "",
    stock: String(p.stock),
    description: p.description,
    image: p.image,
  };
}

/** Accepts "129000", "129,000" or "129 000" — staff often paste prices from spreadsheets. */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[\s,₮']/g, "");
  if (cleaned === "" || !/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

function validate(f: FormState): FormErrors {
  const errors: FormErrors = {};
  const regular = parseAmount(f.regularPrice);
  const sale = f.salePrice.trim() ? parseAmount(f.salePrice) : undefined;
  const stock = parseAmount(f.stock);

  if (f.title.trim().length < 2) errors.title = "Барааны нэрийг оруулна уу (2-оос дээш тэмдэгт).";
  if (regular === null || regular <= 0) errors.regularPrice = "Үнэ 0-ээс их бүхэл тоо байх ёстой.";
  if (sale === null || (sale !== undefined && sale <= 0)) {
    errors.salePrice = "Хямдралтай үнэ 0-ээс их бүхэл тоо байх ёстой.";
  } else if (sale !== undefined && regular !== null && sale >= regular) {
    errors.salePrice = "Хямдралтай үнэ үндсэн үнээс бага байх ёстой.";
  }
  if (stock === null) errors.stock = "Үлдэгдэл 0 эсвэл түүнээс их бүхэл тоо байна.";
  if (f.image.trim() && !/^https?:\/\/\S+$/i.test(f.image.trim())) {
    errors.image = "http:// эсвэл https://-ээр эхэлсэн хаяг оруулна уу.";
  }
  return errors;
}

export default function ProductFormModal({ open, product, onClose, onSave }: ProductFormModalProps) {
  // Re-key on the edited product so a fresh form state is derived each time the modal opens.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Бараа засах" : "Шинэ бараа нэмэх"}
      description={product ? product.title : "Дэлгүүрт шууд нийтлэгдэнэ"}
    >
      {open && <ProductForm key={product?.id ?? "new"} product={product} onCancel={onClose} onSave={onSave} />}
    </Modal>
  );
}

function ProductForm({
  product,
  onCancel,
  onSave,
}: {
  product: Product | null;
  onCancel: () => void;
  onSave: (product: Product) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = validate(form);
  const showError = (field: keyof FormState) => (submitted || touched[field] ? errors[field] : undefined);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }));
  const blur = (field: keyof FormState) => () => setTouched((t) => ({ ...t, [field]: true }));

  const regular = parseAmount(form.regularPrice);
  const sale = form.salePrice.trim() ? parseAmount(form.salePrice) : null;
  const discountPct = regular && sale && sale < regular ? Math.round((1 - sale / regular) * 100) : 0;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setServerError(null);
    if (Object.keys(errors).length > 0) return;

    const regularPrice = regular as number;
    const salePrice = sale ?? undefined;
    const description = form.description.trim();

    const base: Product = product ?? {
      id: `p-${Date.now().toString(36)}`,
      title: "",
      brand: "hotulan",
      category: form.category,
      price: 0,
      rating: 0,
      reviewCount: 0,
      image: "",
      stock: 0,
      warrantyMonths: 12,
      summary: "",
      description: "",
      features: [],
      specs: [],
    };

    // A sale badge follows the price data; a manually chosen "Шинэ"/"Эрэлттэй" badge is preserved.
    const badge = salePrice !== undefined ? "Хямдрал" : base.badge === "Хямдрал" ? undefined : base.badge;

    // The modal stays open until the server confirms, so a rejected save never loses typed input.
    setSaving(true);
    try {
      await onSave({
        ...base,
        title: form.title.trim(),
        category: form.category,
        price: salePrice ?? regularPrice,
        compareAtPrice: salePrice !== undefined ? regularPrice : undefined,
        stock: parseAmount(form.stock) as number,
        description,
        summary: description.slice(0, 120),
        image: form.image.trim(),
        badge,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Хадгалахад алдаа гарлаа.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-[1fr_11rem]">
      <div className="space-y-4">
        <Field label="Барааны нэр" htmlFor="pf-title" error={showError("title")} required>
          <input
            id="pf-title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            onBlur={blur("title")}
            aria-invalid={!!showError("title")}
            placeholder="Жишээ: Утасгүй чихэвч, ANC"
            className={inputClass}
          />
        </Field>

        <Field label="Ангилал" htmlFor="pf-category" required>
          <select
            id="pf-category"
            value={form.category}
            onChange={(e) => set("category", e.target.value as CategoryId)}
            className={inputClass}
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Үндсэн үнэ (₮)"
            htmlFor="pf-regular"
            error={showError("regularPrice")}
            hint={regular ? formatMNT(regular) : undefined}
            required
          >
            <input
              id="pf-regular"
              inputMode="numeric"
              value={form.regularPrice}
              onChange={(e) => set("regularPrice", e.target.value)}
              onBlur={blur("regularPrice")}
              aria-invalid={!!showError("regularPrice")}
              placeholder="129000"
              className={`${inputClass} tabular-nums`}
            />
          </Field>
          <Field
            label="Хямдралтай үнэ (₮)"
            htmlFor="pf-sale"
            error={showError("salePrice")}
            hint={discountPct > 0 ? `−${discountPct}% хөнгөлөлт` : "Хоосон бол хямдралгүй"}
          >
            <input
              id="pf-sale"
              inputMode="numeric"
              value={form.salePrice}
              onChange={(e) => set("salePrice", e.target.value)}
              onBlur={blur("salePrice")}
              aria-invalid={!!showError("salePrice")}
              placeholder="Заавал биш"
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>

        <Field label="Үлдэгдэл тоо" htmlFor="pf-stock" error={showError("stock")} required>
          <input
            id="pf-stock"
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => set("stock", e.target.value)}
            onBlur={blur("stock")}
            aria-invalid={!!showError("stock")}
            className={`${inputClass} tabular-nums sm:w-40`}
          />
        </Field>

        <Field label="Тодорхойлолт" htmlFor="pf-description">
          <textarea
            id="pf-description"
            rows={4}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Материал, хэмжээ, онцлог, дагалдах хэрэгсэл…"
            className={`${inputClass} h-auto resize-y py-2 leading-relaxed`}
          />
        </Field>

        <Field label="Зургийн URL" htmlFor="pf-image" error={showError("image")}>
          <input
            id="pf-image"
            type="url"
            value={form.image}
            onChange={(e) => set("image", e.target.value)}
            onBlur={blur("image")}
            aria-invalid={!!showError("image")}
            placeholder="https://images.unsplash.com/…"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="order-first sm:order-none">
        <p className="mb-1.5 text-sm font-medium text-slate-700">Урьдчилан харах</p>
        <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {form.image.trim() && !errors.image ? (
            <SafeImage key={form.image.trim()} src={form.image.trim()} alt="Барааны зураг" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
              <ImageOff className="h-8 w-8" aria-hidden="true" />
              <span className="text-xs text-slate-400">Зураг алга</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
        {submitted && Object.keys(errors).length > 0 ? (
          <p className="text-sm font-medium text-rose-600 sm:mr-auto sm:self-center" role="alert">
            {Object.keys(errors).length} талбарыг засна уу.
          </p>
        ) : (
          serverError && (
            <p className="text-sm font-medium text-rose-600 sm:mr-auto sm:self-center" role="alert">
              {serverError}
            </p>
          )
        )}
        <button type="button" onClick={onCancel} disabled={saving} className={btn.secondary}>
          Болих
        </button>
        <button type="submit" disabled={saving} className={btn.primary}>
          {saving ? "Хадгалж байна…" : product ? "Өөрчлөлт хадгалах" : "Бараа нэмэх"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
