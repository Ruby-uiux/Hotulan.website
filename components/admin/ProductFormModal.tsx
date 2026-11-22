"use client";

import { ImageOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { formatMNT, type CategoryId, type Product } from "@/lib/catalog";
import { useCatalog } from "@/components/store/CatalogContext";
import SafeImage from "@/components/store/SafeImage";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui";

interface ProductFormModalProps {
  open: boolean;
  /** null = creating a new product. */
  product: Product | null;
  onClose: () => void;
  onSave: (draft: ProductDraft) => Promise<void>;
}

/** What the form sends. Fields it doesn't edit (cost, SKU, gallery, …) are kept by the server. */
export interface ProductDraft {
  /** Absent when creating. */
  id?: string;
  title: string;
  category: CategoryId;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  description: string;
  summary: string;
  image: string;
  badge: Product["badge"] | null;
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

function toFormState(p: Product | null, defaultCategory: CategoryId): FormState {
  if (!p) {
    return { title: "", category: defaultCategory, regularPrice: "", salePrice: "", stock: "0", description: "", image: "" };
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
      size="lg"
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
  onSave: (draft: ProductDraft) => Promise<void>;
}) {
  const { categories } = useCatalog();
  const categoryOptions = categories.filter((c) => c.id !== "all");
  const [form, setForm] = useState<FormState>(() => toFormState(product, categoryOptions[0]?.id ?? ""));
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

    // A sale badge follows the price data; a manually chosen "Шинэ"/"Эрэлттэй" badge is preserved.
    const badge = salePrice !== undefined ? "Хямдрал" : product?.badge === "Хямдрал" ? null : (product?.badge ?? null);

    // The modal stays open until the server confirms, so a rejected save never loses typed input.
    setSaving(true);
    try {
      await onSave({
        id: product?.id,
        title: form.title.trim(),
        category: form.category,
        price: salePrice ?? regularPrice,
        compareAtPrice: salePrice !== undefined ? regularPrice : null,
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
        <Input
          id="pf-title"
          label="Барааны нэр"
          required
          error={showError("title")}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          onBlur={blur("title")}
          placeholder="Жишээ: Утасгүй чихэвч, ANC"
        />

        <Select
          id="pf-category"
          label="Ангилал"
          required
          value={form.category}
          onChange={(e) => set("category", e.target.value as CategoryId)}
          options={categoryOptions.map((c) => ({ value: c.id, label: c.label }))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="pf-regular"
            label="Үндсэн үнэ (₮)"
            required
            error={showError("regularPrice")}
            hint={regular ? formatMNT(regular) : undefined}
            controlClassName="tabular-nums"
            inputMode="numeric"
            value={form.regularPrice}
            onChange={(e) => set("regularPrice", e.target.value)}
            onBlur={blur("regularPrice")}
            placeholder="129000"
          />
          <Input
            id="pf-sale"
            label="Хямдралтай үнэ (₮)"
            error={showError("salePrice")}
            hint={discountPct > 0 ? `−${discountPct}% хөнгөлөлт` : "Хоосон бол хямдралгүй"}
            controlClassName="tabular-nums"
            inputMode="numeric"
            value={form.salePrice}
            onChange={(e) => set("salePrice", e.target.value)}
            onBlur={blur("salePrice")}
            placeholder="Заавал биш"
          />
        </div>

        <Input
          id="pf-stock"
          label="Үлдэгдэл тоо"
          required
          error={showError("stock")}
          controlClassName="tabular-nums sm:w-40"
          inputMode="numeric"
          value={form.stock}
          onChange={(e) => set("stock", e.target.value)}
          onBlur={blur("stock")}
        />

        <Textarea
          id="pf-description"
          label="Тодорхойлолт"
          rows={4}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Материал, хэмжээ, онцлог, дагалдах хэрэгсэл…"
        />

        <Input
          id="pf-image"
          label="Зургийн URL"
          type="url"
          error={showError("image")}
          value={form.image}
          onChange={(e) => set("image", e.target.value)}
          onBlur={blur("image")}
          placeholder="https://images.unsplash.com/…"
        />
      </div>

      <div className="order-first sm:order-none">
        <p className="mb-1.5 text-[13px] font-semibold text-slate-900">Урьдчилан харах</p>
        <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
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
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Болих
        </Button>
        <Button type="submit" loading={saving} loadingText="Хадгалж байна…">
          {product ? "Өөрчлөлт хадгалах" : "Бараа нэмэх"}
        </Button>
      </div>
    </form>
  );
}
