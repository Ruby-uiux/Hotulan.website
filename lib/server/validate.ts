import type { CategoryId, Product } from "../catalog";
import {
  DISTRICTS,
  ORDER_STATUSES,
  PAYMENT_LABEL,
  type OrderStatus,
  type PaymentMethod,
  type StoreSettings,
} from "../admin-data";

/**
 * Server-side validation. The UI validates for friendliness; this layer validates for
 * correctness — every write path re-checks types and ranges because any client
 * (or curl) can call the API directly.
 */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;

const CATEGORIES: CategoryId[] = ["toys", "home", "electronics", "sports"];
const BADGES = ["Шинэ", "Хямдрал", "Эрэлттэй"] as const;

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

/**
 * Builds a full Product from client input. Only editable fields are taken from the body;
 * ratings, reviews, specs etc. come from `existing` (edit) or safe defaults (create).
 */
export function parseProductInput(body: unknown, existing: Product | null, newId: string): Product {
  const b = asObject(body);
  const title = str(b.title, "Барааны нэр", { min: 2, max: 200 });
  if (!CATEGORIES.includes(b.category as CategoryId)) throw new HttpError(400, "Ангилал буруу байна.");
  const price = int(b.price, "Үнэ", { min: 1 });
  const compareAtPrice = b.compareAtPrice === undefined || b.compareAtPrice === null ? undefined : int(b.compareAtPrice, "Үндсэн үнэ", { min: 1 });
  if (compareAtPrice !== undefined && compareAtPrice <= price) {
    throw new HttpError(400, "Хямдралтай үнэ үндсэн үнээс бага байх ёстой.");
  }
  const stock = int(b.stock, "Үлдэгдэл", { min: 0, max: 1_000_000 });
  const description = b.description === undefined ? "" : str(b.description, "Тодорхойлолт", { max: 5000 });
  const image = b.image === undefined ? "" : str(b.image, "Зургийн URL", { max: 2000 });
  if (image && !/^https?:\/\/\S+$/i.test(image)) throw new HttpError(400, "Зургийн URL http(s)://-ээр эхлэх ёстой.");
  const badge = b.badge === undefined || b.badge === null ? undefined : (BADGES as readonly unknown[]).includes(b.badge) ? (b.badge as Product["badge"]) : undefined;

  const base: Product = existing ?? {
    id: newId,
    title,
    brand: "hotulan",
    category: b.category as CategoryId,
    price,
    rating: 0,
    reviewCount: 0,
    image,
    stock,
    warrantyMonths: 12,
    summary: "",
    description: "",
    features: [],
    specs: [],
  };

  return {
    ...base,
    title,
    category: b.category as CategoryId,
    price,
    compareAtPrice,
    stock,
    description,
    summary: description.slice(0, 120),
    image,
    badge,
  };
}

export function parseStock(body: unknown): number {
  return int(asObject(body).stock, "Үлдэгдэл", { min: 0, max: 1_000_000 });
}

export function parseStatus(body: unknown): OrderStatus {
  const status = asObject(body).status;
  if (!ORDER_STATUSES.some((s) => s.id === status)) throw new HttpError(400, "Захиалгын төлөв буруу байна.");
  return status as OrderStatus;
}

export interface CheckoutInput {
  customer: string;
  phone: string;
  district: string;
  payment: PaymentMethod;
  lines: { productId: string; quantity: number }[];
}

export function parseCheckout(body: unknown): CheckoutInput {
  const b = asObject(body);
  const customer = str(b.customer, "Нэр", { min: 2, max: 80 });
  const phoneDigits = str(b.phone, "Утас", { max: 20 }).replace(/[\s-]/g, "");
  if (!/^\d{8}$/.test(phoneDigits)) throw new HttpError(400, "Утасны дугаар 8 оронтой байх ёстой.");
  const phone = `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}`;
  const district = str(b.district, "Дүүрэг", { max: 40 });
  if (!(DISTRICTS as readonly string[]).includes(district)) throw new HttpError(400, "Дүүрэг буруу байна.");
  if (typeof b.payment !== "string" || !Object.hasOwn(PAYMENT_LABEL, b.payment)) {
    throw new HttpError(400, "Төлбөрийн хэлбэр буруу байна.");
  }

  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > 50) {
    throw new HttpError(400, "Сагс хоосон байна.");
  }
  // Merge duplicate product lines so stock checks see the true requested quantity.
  const merged = new Map<string, number>();
  for (const raw of b.lines) {
    const l = asObject(raw);
    const productId = str(l.productId, "Бараа", { min: 1, max: 100 });
    const quantity = int(l.quantity, "Тоо ширхэг", { min: 1, max: 99 });
    merged.set(productId, (merged.get(productId) ?? 0) + quantity);
  }

  return {
    customer,
    phone,
    district,
    payment: b.payment as PaymentMethod,
    lines: [...merged].map(([productId, quantity]) => ({ productId, quantity })),
  };
}

export function parseSettings(body: unknown): StoreSettings {
  const b = asObject(body);
  return {
    storeName: str(b.storeName, "Дэлгүүрийн нэр", { min: 1, max: 80 }),
    supportPhone: str(b.supportPhone, "Лавлах утас", { min: 1, max: 30 }),
    supportEmail: str(b.supportEmail, "Имэйл", { max: 120 }),
    lowStockThreshold: int(b.lowStockThreshold, "Бага үлдэгдлийн босго", { min: 0, max: 100_000 }),
    freeDeliveryThreshold: int(b.freeDeliveryThreshold, "Үнэгүй хүргэлтийн дүн", { min: 0 }),
    notifyNewOrder: Boolean(b.notifyNewOrder),
    notifyLowStock: Boolean(b.notifyLowStock),
  };
}
