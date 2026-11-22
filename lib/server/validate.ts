import { PRODUCT_BADGES, type Product, type ProductBadge, type ProductStatus } from "../catalog";
import { isCategoryIcon, SLUG_PATTERN } from "../categories";
import {
  isOrderStatus,
  isPaymentMethod,
  type EbarimtType,
  type OrderStatus,
  type PaymentSettings,
  type StoreSettings,
} from "../admin-data";
import { HttpError } from "./errors";
import type { CategoryInput } from "./repo/categories";
import type { CheckoutInput } from "./repo/orders";
import type { ProductInput } from "./repo/products";

export { HttpError };

/**
 * Server-side validation. The UI validates for friendliness; this layer validates for
 * correctness — every write path re-checks types and ranges because any client
 * (or curl) can call the API directly.
 */

type Json = Record<string, unknown>;

function asObject(body: unknown): Json {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Хүсэлтийн бүтэц буруу байна.");
  return body as Json;
}

function str(v: unknown, field: string, { min = 0, max = 500 } = {}): string {
  if (typeof v !== "string") throw new HttpError(400, `${field}: текст байх ёстой.`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw new HttpError(400, `${field}: ${min}–${max} тэмдэгт байх ёстой.`);
  return t;
}

function int(v: unknown, field: string, { min = 0, max = 1_000_000_000 } = {}): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) {
    throw new HttpError(400, `${field}: ${min}–${max} хооронд бүхэл тоо байх ёстой.`);
  }
  return v;
}

const absent = (v: unknown) => v === undefined;
const empty = (v: unknown) => v === undefined || v === null || v === "";

/** Optional text: undefined keeps `fallback`, null/"" clears to null. */
function optStr(v: unknown, field: string, fallback: string | null, max = 500): string | null {
  if (absent(v)) return fallback;
  if (empty(v)) return null;
  return str(v, field, { max });
}

function optInt(v: unknown, field: string, fallback: number | null, range: { min?: number; max?: number } = {}): number | null {
  if (absent(v)) return fallback;
  if (v === null || v === "") return null;
  return int(v, field, range);
}

function bool(v: unknown, fallback: boolean): boolean {
  return absent(v) ? fallback : Boolean(v);
}

function url(v: string, field: string): string {
  if (v && !/^https?:\/\/\S+$/i.test(v) && !v.startsWith("/")) throw new HttpError(400, `${field} http(s):// эсвэл /-ээр эхлэх ёстой.`);
  return v;
}

function isoDate(v: unknown, field: string, fallback: string | null): string | null {
  if (absent(v)) return fallback;
  if (empty(v)) return null;
  const s = str(v, field, { max: 40 });
  if (Number.isNaN(Date.parse(s))) throw new HttpError(400, `${field}: огноо буруу байна.`);
  return new Date(s).toISOString();
}

/* ---------------------------------------------------------------- Products */

const STATUSES: ProductStatus[] = ["active", "draft", "scheduled"];

/**
 * Builds the editable product fields from client input. Fields the client didn't send
 * keep their current value (edit) or a safe default (create), so the older, smaller
 * product form never wipes fields added later (cost, SKU, gallery, …).
 */
export function parseProductInput(body: unknown, existing: Product | null): ProductInput {
  const b = asObject(body);
  const e = existing;

  const title = str(b.title ?? e?.title, "Барааны нэр", { min: 2, max: 200 });
  const category = str(b.category ?? e?.category, "Ангилал", { min: 1, max: 80 });
  const subcategory = optStr(b.subcategory, "Дэд ангилал", e && e.category === category ? e.subcategory : null, 80);
  const price = int(b.price ?? e?.price, "Үнэ", { min: 1 });
  const compareAtPrice = optInt(b.compareAtPrice, "Хуучин үнэ", e?.compareAtPrice ?? null, { min: 1 });
  if (compareAtPrice !== null && compareAtPrice <= price) {
    throw new HttpError(400, "Хуучин (зураастай) үнэ одоогийн үнээс их байх ёстой.");
  }
  const image = url(str(b.image ?? e?.image ?? "", "Зургийн URL", { max: 2000 }), "Зургийн URL");
  let gallery = e?.gallery ?? [];
  if (!absent(b.gallery)) {
    if (!Array.isArray(b.gallery) || b.gallery.length > 20) throw new HttpError(400, "Зургийн жагсаалт буруу байна.");
    gallery = b.gallery.map((g) => url(str(g, "Зургийн URL", { min: 1, max: 2000 }), "Зургийн URL"));
  }
  const badge: ProductBadge | null = absent(b.badge)
    ? (e?.badge ?? null)
    : (PRODUCT_BADGES as readonly unknown[]).includes(b.badge)
      ? (b.badge as ProductBadge)
      : null;
  const status = absent(b.status) ? (e?.status ?? "active") : (b.status as ProductStatus);
  if (!STATUSES.includes(status)) throw new HttpError(400, "Барааны төлөв буруу байна.");
  const publishAt = isoDate(b.publishAt, "Нийтлэх огноо", e?.publishAt ?? null);
  if (status === "scheduled" && !publishAt) throw new HttpError(400, "Товлосон бараанд нийтлэх огноо заавал хэрэгтэй.");
  const description = str(b.description ?? e?.description ?? "", "Тодорхойлолт", { max: 5000 });
  const summary = absent(b.summary) ? (e?.summary || description.slice(0, 120)) : str(b.summary, "Товч тайлбар", { max: 200 });
  const weight = absent(b.weightKg) ? (e?.weightKg ?? null) : empty(b.weightKg) ? null : Number(b.weightKg);
  if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 10_000)) throw new HttpError(400, "Жин буруу байна.");

  return {
    title,
    brand: str(b.brand ?? e?.brand ?? "hotulan", "Брэнд", { max: 80 }),
    category,
    subcategory,
    price,
    compareAtPrice,
    cost: optInt(b.cost, "Өртөг", e?.cost ?? null, { min: 0 }),
    sku: optStr(b.sku, "SKU", e?.sku ?? null, 64),
    barcode: optStr(b.barcode, "Баркод", e?.barcode ?? null, 64),
    image,
    gallery,
    badge,
    stock: int(b.stock ?? e?.stock, "Үлдэгдэл", { min: 0, max: 1_000_000 }),
    lowStockAlert: optInt(b.lowStockAlert, "Анхааруулах үлдэгдэл", e?.lowStockAlert ?? null, { min: 0, max: 100_000 }),
    status,
    publishAt,
    featured: bool(b.featured, e?.featured ?? false),
    warrantyMonths: int(b.warrantyMonths ?? e?.warrantyMonths ?? 12, "Баталгаа (сар)", { min: 0, max: 120 }),
    weightKg: weight,
    oversized: bool(b.oversized, e?.oversized ?? false),
    summary,
    description,
  };
}

export function parseStock(body: unknown): number {
  return int(asObject(body).stock, "Үлдэгдэл", { min: 0, max: 1_000_000 });
}

export function parseStatus(body: unknown): OrderStatus {
  const status = asObject(body).status;
  if (!isOrderStatus(status)) throw new HttpError(400, "Захиалгын төлөв буруу байна.");
  return status;
}

/* ---------------------------------------------------------------- Checkout */

export function parseCheckout(body: unknown): CheckoutInput {
  const b = asObject(body);
  const customer = str(b.customer, "Нэр", { min: 2, max: 80 });
  const phoneDigits = str(b.phone, "Утас", { max: 20 }).replace(/[\s-]/g, "");
  if (!/^\d{8}$/.test(phoneDigits)) throw new HttpError(400, "Утасны дугаар 8 оронтой байх ёстой.");
  const phone = `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
  const zoneId = str(b.zoneId, "Дүүрэг", { min: 1, max: 40 });
  if (!isPaymentMethod(b.payment)) throw new HttpError(400, "Төлбөрийн хэлбэр буруу байна.");

  const ebarimtType: EbarimtType = b.ebarimtType === "company" ? "company" : "person";
  const ebarimtRegNo = ebarimtType === "company" ? str(b.ebarimtRegNo, "Байгууллагын РД", { min: 7, max: 7 }) : null;
  // Organisation registration numbers are 7 digits.
  if (ebarimtRegNo !== null && !/^\d{7}$/.test(ebarimtRegNo)) {
    throw new HttpError(400, "Байгууллагын регистрийн дугаар буруу байна.");
  }

  let deliveryDate: string | null = null;
  if (!empty(b.deliveryDate)) {
    deliveryDate = str(b.deliveryDate, "Хүргэх өдөр", { max: 10 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) throw new HttpError(400, "Хүргэх өдөр буруу байна.");
  }

  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 50) {
    throw new HttpError(400, "Сагс хоосон байна.");
  }
  // Merge duplicate product/variant lines so stock checks see the true requested quantity.
  const merged = new Map<string, { productId: string; variantId: string | null; quantity: number }>();
  for (const raw of b.lines) {
    const l = asObject(raw);
    const productId = str(l.productId, "Бараа", { min: 1, max: 100 });
    const variantId = empty(l.variantId) ? null : str(l.variantId, "Хувилбар", { min: 1, max: 100 });
    const quantity = int(l.quantity, "Тоо ширхэг", { min: 1, max: 99 });
    const key = `${productId}::${variantId ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, { productId, variantId, quantity: (prev?.quantity ?? 0) + quantity });
  }

  return {
    customer,
    phone,
    zoneId,
    // Khoroo and street address become required with the new checkout page (phase 4).
    khoroo: empty(b.khoroo) ? null : int(b.khoroo, "Хороо", { min: 1, max: 60 }),
    address: empty(b.address) ? "" : str(b.address, "Хаяг", { max: 300 }),
    deliveryNote: empty(b.deliveryNote) ? "" : str(b.deliveryNote, "Тэмдэглэл", { max: 300 }),
    deliveryDate,
    slotId: empty(b.slotId) ? null : str(b.slotId, "Хүргэлтийн цаг", { max: 40 }),
    payment: b.payment,
    couponCode: empty(b.couponCode) ? null : str(b.couponCode, "Купон", { max: 40 }),
    ebarimtType,
    ebarimtRegNo,
    lines: [...merged.values()],
  };
}

/* ---------------------------------------------------------------- Settings */

/** Partial update: only fields present in the body are validated and returned. */
export function parseSettings(body: unknown): Partial<StoreSettings> {
  const b = asObject(body);
  const out: Partial<StoreSettings> = {};
  const text = (k: keyof StoreSettings, label: string, min: number, max: number) => {
    if (!absent(b[k])) (out as Record<string, unknown>)[k] = str(b[k], label, { min, max });
  };
  const num = (k: keyof StoreSettings, label: string, max = 1_000_000_000) => {
    if (!absent(b[k])) (out as Record<string, unknown>)[k] = int(b[k], label, { min: 0, max });
  };
  const flag = (k: keyof StoreSettings) => {
    if (!absent(b[k])) (out as Record<string, unknown>)[k] = Boolean(b[k]);
  };

  text("storeName", "Дэлгүүрийн нэр", 1, 80);
  text("supportPhone", "Лавлах утас", 1, 30);
  text("supportEmail", "Имэйл", 0, 120);
  text("workingHours", "Ажлын цаг", 0, 120);
  text("address", "Хаяг", 0, 300);
  num("lowStockThreshold", "Бага үлдэгдлийн босго", 100_000);
  num("returnDays", "Буцаалтын хугацаа", 365);
  num("freeDeliveryThreshold", "Үнэгүй хүргэлтийн дүн");
  num("oversizedFee", "Том оврын нэмэлт төлбөр");
  if (!absent(b.nextDayCutoff)) {
    const cutoff = str(b.nextDayCutoff, "Маргааш хүргэх хаалт", { max: 5 });
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) throw new HttpError(400, "Хаалтын цаг ЦЦ:ММ хэлбэртэй байна.");
    out.nextDayCutoff = cutoff;
  }
  flag("notifyNewOrder");
  flag("notifyLowStock");
  flag("smsOrderConfirm");
  flag("smsShipping");

  if (!absent(b.payments)) {
    const p = asObject(b.payments);
    const payments: Partial<PaymentSettings> = {};
    for (const k of ["qpay", "bank", "cod"] as const) if (!absent(p[k])) payments[k] = Boolean(p[k]);
    for (const k of ["bankName", "bankAccount", "bankAccountName"] as const) if (!absent(p[k])) payments[k] = str(p[k], "Дансны мэдээлэл", { max: 80 });
    out.payments = payments as PaymentSettings;
  }
  return out;
}

/* -------------------------------------------------------------- Categories */

export function parseCategoryInput(body: unknown): CategoryInput {
  const b = asObject(body);
  const slug = str(b.slug, "URL холбоос", { min: 1, max: 60 }).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, "URL холбоос зөвхөн жижиг үсэг, тоо, зураас агуулна.");
  const icon = empty(b.icon) ? null : b.icon;
  if (icon !== null && !isCategoryIcon(icon)) throw new HttpError(400, "Икон буруу байна.");
  const image = optStr(b.image, "Зураг", null, 2000);
  return {
    slug,
    name: str(b.name, "Нэр", { min: 1, max: 80 }),
    parentId: empty(b.parentId) ? null : str(b.parentId, "Эх ангилал", { max: 80 }),
    icon,
    image: image === null ? null : url(image, "Зураг"),
    hidden: bool(b.hidden, false),
    showOnHome: bool(b.showOnHome, true),
    showInMenu: bool(b.showInMenu, true),
  };
}
