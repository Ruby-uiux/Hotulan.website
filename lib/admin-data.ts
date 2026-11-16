import { PRODUCTS, type CategoryId, type Product } from "./catalog";

export type AdminView = "dashboard" | "products" | "orders" | "settings";

export type OrderStatus = "new" | "paid" | "delivery" | "completed";
export type PaymentMethod = "qpay" | "socialpay" | "card" | "cash";

export interface OrderLine {
  productId: string;
  /** Title and price are snapshotted at purchase time — later catalog edits or deletes must not rewrite history. */
  title: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  customer: string;
  phone: string;
  district: string;
  /** ISO 8601 with offset, Ulaanbaatar time. */
  createdAt: string;
  payment: PaymentMethod;
  status: OrderStatus;
  lines: OrderLine[];
  deliveryFee: number;
}

export interface StoreSettings {
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  lowStockThreshold: number;
  freeDeliveryThreshold: number;
  notifyNewOrder: boolean;
  notifyLowStock: boolean;
}

export const ORDER_STATUSES: ReadonlyArray<{
  id: OrderStatus;
  label: string;
  /** Badge + select styling. Status colors are reserved for state and always paired with a label. */
  tone: string;
  dot: string;
}> = [
  { id: "new", label: "Шинэ", tone: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500" },
  { id: "paid", label: "Төлөгдсөн", tone: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  { id: "delivery", label: "Хүргэлтэд гарсан", tone: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  { id: "completed", label: "Бүрэн дууссан", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
];

export const STATUS_META = Object.fromEntries(ORDER_STATUSES.map((s) => [s.id, s])) as Record<
  OrderStatus,
  (typeof ORDER_STATUSES)[number]
>;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  qpay: "QPay",
  socialpay: "SocialPay",
  card: "Банкны карт",
  cash: "Бэлнээр",
};

export const CATEGORY_OPTIONS: ReadonlyArray<{ id: CategoryId; label: string }> = [
  { id: "toys", label: "Тоглоом" },
  { id: "home", label: "Гэр ахуй" },
  { id: "electronics", label: "Цахилгаан бараа" },
  { id: "sports", label: "Спорт" },
];

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "hotulan.mn",
  supportPhone: "7700-0000",
  supportEmail: "info@hotulan.mn",
  lowStockThreshold: 10,
  freeDeliveryThreshold: 200_000,
  notifyNewOrder: true,
  notifyLowStock: true,
};

export const DISTRICTS = [
  "Баянгол",
  "Баянзүрх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
  "Налайх",
  "Багануур",
  "Багахангай",
] as const;

/** Mirrors the storefront rule; the server uses it to compute the authoritative order total. */
export const ORDER_DELIVERY_FEE = 5_000;

/** Orders mix "+08:00" and "Z" timestamps, so compare instants — never the raw strings. */
export function byNewest(a: Order, b: Order): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function orderTotal(order: Order): number {
  return order.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) + order.deliveryFee;
}

export function orderItemCount(order: Order): number {
  return order.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** "2026.11.08 14:32" in Ulaanbaatar time regardless of the viewer's machine timezone. */
export function formatDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Calendar day key (YYYY-MM-DD) in Ulaanbaatar time, used for daily revenue buckets. */
export function dayKey(date: Date): string {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}

const byId = new Map(PRODUCTS.map((p) => [p.id, p]));

function line(productId: string, quantity: number): OrderLine {
  const p = byId.get(productId) as Product;
  return { productId, title: p.title, unitPrice: p.price, quantity };
}

/** Delivery fee mirrors the storefront rule so totals in admin match what shoppers paid. */
function makeOrder(o: Omit<Order, "deliveryFee">): Order {
  const subtotal = o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  return { ...o, deliveryFee: subtotal >= DEFAULT_SETTINGS.freeDeliveryThreshold ? 0 : 5_000 };
}

export const INITIAL_ORDERS: Order[] = [
  makeOrder({ id: "HTL-482913", customer: "Б. Сарангэрэл", phone: "9911-2345", district: "Хан-Уул", createdAt: "2026-11-08T14:32:00+08:00", payment: "qpay", status: "new", lines: [line("elec-anc-headphones", 1), line("toy-teddy-60", 1)] }),
  makeOrder({ id: "HTL-482907", customer: "Г. Тэмүүлэн", phone: "8800-4512", district: "Баянзүрх", createdAt: "2026-11-08T12:05:00+08:00", payment: "socialpay", status: "new", lines: [line("home-kettle", 2)] }),
  makeOrder({ id: "HTL-482889", customer: "Д. Номин-Эрдэнэ", phone: "9505-7781", district: "Сүхбаатар", createdAt: "2026-11-08T09:47:00+08:00", payment: "card", status: "paid", lines: [line("home-air-purifier", 1)] }),
  makeOrder({ id: "HTL-482861", customer: "Э. Батбаяр", phone: "9119-0032", district: "Чингэлтэй", createdAt: "2026-11-07T19:22:00+08:00", payment: "qpay", status: "paid", lines: [line("toy-blocks-1000", 2), line("toy-wood-puzzle", 1)] }),
  makeOrder({ id: "HTL-482840", customer: "О. Анужин", phone: "8611-9087", district: "Баянгол", createdAt: "2026-11-07T15:10:00+08:00", payment: "qpay", status: "delivery", lines: [line("elec-smartwatch", 1)] }),
  makeOrder({ id: "HTL-482812", customer: "Ц. Мөнхбат", phone: "9900-1188", district: "Сонгинохайрхан", createdAt: "2026-11-06T20:41:00+08:00", payment: "cash", status: "delivery", lines: [line("sport-yoga-mat", 1), line("sport-adjustable-dumbbell", 1)] }),
  makeOrder({ id: "HTL-482790", customer: "Ж. Хулан", phone: "9977-6655", district: "Хан-Уул", createdAt: "2026-11-06T11:18:00+08:00", payment: "card", status: "completed", lines: [line("elec-tv-55", 1)] }),
  makeOrder({ id: "HTL-482755", customer: "С. Билгүүн", phone: "8080-3434", district: "Баянзүрх", createdAt: "2026-11-05T17:56:00+08:00", payment: "socialpay", status: "completed", lines: [line("toy-rc-car", 1), line("toy-mini-drone", 1)] }),
  makeOrder({ id: "HTL-482731", customer: "Н. Оюунчимэг", phone: "9191-2020", district: "Сүхбаатар", createdAt: "2026-11-05T10:02:00+08:00", payment: "qpay", status: "completed", lines: [line("home-bedding-set", 2)] }),
  makeOrder({ id: "HTL-482702", customer: "А. Энхжин", phone: "9444-8181", district: "Баянгол", createdAt: "2026-11-04T13:29:00+08:00", payment: "qpay", status: "completed", lines: [line("home-robot-vacuum", 1)] }),
  makeOrder({ id: "HTL-482688", customer: "П. Ганзориг", phone: "8899-5050", district: "Чингэлтэй", createdAt: "2026-11-03T18:44:00+08:00", payment: "card", status: "completed", lines: [line("elec-laptop-14", 1)] }),
  makeOrder({ id: "HTL-482650", customer: "Т. Мишээл", phone: "9933-7171", district: "Хан-Уул", createdAt: "2026-11-03T09:15:00+08:00", payment: "socialpay", status: "completed", lines: [line("elec-bt-speaker", 1), line("home-desk-lamp", 2)] }),
  makeOrder({ id: "HTL-482611", customer: "Х. Ариунбилэг", phone: "8686-2424", district: "Баянзүрх", createdAt: "2026-11-02T16:37:00+08:00", payment: "qpay", status: "completed", lines: [line("sport-mtb-275", 1)] }),
  makeOrder({ id: "HTL-482598", customer: "М. Дөлгөөн", phone: "9595-1313", district: "Сонгинохайрхан", createdAt: "2026-11-02T10:50:00+08:00", payment: "cash", status: "completed", lines: [line("home-espresso", 1)] }),
];
