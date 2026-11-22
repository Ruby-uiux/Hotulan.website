/**
 * Orders, customers, staff and store settings — types and pure helpers shared by
 * the admin panel, the storefront and the server. Data lives in the database.
 */
import type { Role } from "./permissions";

export type AdminView = "dashboard" | "products" | "orders" | "settings";

/* ------------------------------------------------------------------ Status */

/** Flow (design/Tokens.dc.html): new → paid → packing → shipping → delivered; any step → cancelled | returned. */
export const ORDER_STATUS_FLOW = ["new", "paid", "packing", "shipping", "delivered"] as const;
export const ORDER_STATUS_IDS = [...ORDER_STATUS_FLOW, "cancelled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUS_IDS)[number];

const TERMINAL: ReadonlySet<OrderStatus> = new Set(["cancelled", "returned"]);

/**
 * Forward moves along the flow may skip steps (a cash-on-delivery order goes
 * new → packing without "paid"). Never backwards; cancelled/returned are final.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to || TERMINAL.has(from)) return false;
  if (TERMINAL.has(to)) return true;
  return ORDER_STATUS_FLOW.indexOf(to as (typeof ORDER_STATUS_FLOW)[number]) > ORDER_STATUS_FLOW.indexOf(from as (typeof ORDER_STATUS_FLOW)[number]);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_IDS.filter((to) => canTransition(from, to));
}

export const ORDER_STATUSES: ReadonlyArray<{
  id: OrderStatus;
  label: string;
  /** Badge/select styling from the status tokens in globals.css. Always paired with the label. */
  tone: string;
  dot: string;
}> = [
  { id: "new", label: "Шинэ", tone: "bg-status-new text-status-new-ink ring-status-new-ink/20", dot: "bg-status-new-ink" },
  { id: "paid", label: "Төлөгдсөн", tone: "bg-status-paid text-status-paid-ink ring-status-paid-ink/20", dot: "bg-status-paid-ink" },
  { id: "packing", label: "Савлаж байна", tone: "bg-status-packing text-status-packing-ink ring-status-packing-ink/20", dot: "bg-warning" },
  { id: "shipping", label: "Хүргэлтэнд", tone: "bg-status-shipping text-status-shipping-ink ring-status-shipping-ink/20", dot: "bg-status-shipping-ink" },
  { id: "delivered", label: "Хүргэгдсэн", tone: "bg-status-delivered text-status-delivered-ink ring-status-delivered-ink/20", dot: "bg-success" },
  { id: "cancelled", label: "Цуцалсан", tone: "bg-status-cancelled text-status-cancelled-ink ring-status-cancelled-ink/20", dot: "bg-danger" },
  { id: "returned", label: "Буцаасан", tone: "bg-status-returned text-status-returned-ink ring-status-returned-ink/20", dot: "bg-slate-500" },
];

export const STATUS_META = Object.fromEntries(ORDER_STATUSES.map((s) => [s.id, s])) as Record<
  OrderStatus,
  (typeof ORDER_STATUSES)[number]
>;

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUS_IDS as readonly string[]).includes(v);
}

/** Pre-2026.11 statuses found in data/store.json. */
export const LEGACY_STATUS_MAP: Record<string, OrderStatus> = { delivery: "shipping", completed: "delivered" };

/* ----------------------------------------------------------------- Payment */

/** Methods offered at checkout. */
export const PAYMENT_METHODS = ["qpay", "bank", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** Values that only exist on old orders. Kept as-is, never converted. */
export type LegacyPaymentMethod = "socialpay" | "card" | "cash";
export type AnyPaymentMethod = PaymentMethod | LegacyPaymentMethod;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  qpay: "QPay",
  bank: "Дансаар шилжүүлэх",
  cod: "Хүлээн авахдаа төлөх",
};

const LEGACY_PAYMENT_LABEL: Record<LegacyPaymentMethod, string> = {
  socialpay: "SocialPay (хуучин)",
  card: "Банкны карт (хуучин)",
  cash: "Бэлнээр (хуучин)",
};

export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === "string" && (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** Label for any stored payment value; unknown values are shown raw rather than hidden. */
export function paymentLabel(method: string): string {
  return (
    (PAYMENT_LABEL as Record<string, string>)[method] ??
    (LEGACY_PAYMENT_LABEL as Record<string, string>)[method] ??
    `${method} (хуучин)`
  );
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Хүлээгдэж буй",
  paid: "Төлөгдсөн",
  failed: "Амжилтгүй",
  refunded: "Буцаан олгосон",
};

/* ------------------------------------------------------------------- Order */

export interface OrderLine {
  productId: string;
  variantId: string | null;
  /** Title, variant, SKU and price are snapshotted — later catalog edits or deletes must not rewrite history. */
  title: string;
  variantName: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
}

export type EbarimtType = "person" | "company";

export interface Order {
  id: string;
  customerId: string | null;
  customer: string;
  phone: string;
  /** District name snapshot ("Хан-Уул"). */
  district: string;
  zoneId: string | null;
  khoroo: number | null;
  address: string;
  /** Shopper's delivery note ("Орцны код 41#"). */
  deliveryNote: string;
  /** YYYY-MM-DD, Ulaanbaatar. */
  deliveryDate: string | null;
  /** Slot label snapshot ("10:00–14:00"). */
  deliverySlot: string | null;
  /** ISO 8601. */
  createdAt: string;
  updatedAt: string;
  payment: AnyPaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  ebarimtType: EbarimtType;
  /** Company registration number when ebarimtType = "company". */
  ebarimtRegNo: string | null;
  driverId: string | null;
}

export type OrderEventType = "created" | "status" | "payment" | "note" | "assign" | "imported";

export interface OrderEvent {
  id: number;
  orderId: string;
  type: OrderEventType;
  message: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  /** Staff username, "customer" or "system". */
  actor: string;
  createdAt: string;
}

/** Orders mix "+08:00" and "Z" timestamps, so compare instants — never the raw strings. */
export function byNewest(a: Order, b: Order): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export function orderTotal(order: Pick<Order, "total">): number {
  return order.total;
}

export function linesSubtotal(lines: ReadonlyArray<Pick<OrderLine, "unitPrice" | "quantity">>): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

export function orderItemCount(order: Pick<Order, "lines">): number {
  return order.lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Revenue counts once money is (or will be) collected — not for cancelled/returned orders. */
export function countsAsRevenue(order: Pick<Order, "status">): boolean {
  return order.status !== "cancelled" && order.status !== "returned";
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

/* ---------------------------------------------------------------- Customer */

/** Guest checkout: a customer is identified by phone number. */
export interface Customer {
  id: string;
  phone: string;
  name: string;
  district: string | null;
  vip: boolean;
  note: string;
  createdAt: string;
}

export interface CustomerSummary extends Customer {
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

/* ------------------------------------------------------------------- Staff */

export interface StaffMember {
  id: string;
  username: string;
  name: string;
  /** Job title shown under the name ("Агуулахын нярав"). */
  title: string;
  role: Role;
  phone: string | null;
  /** Drivers: delivery zone ids they cover. */
  zoneIds: string[];
  twoFactorEnabled: boolean;
  active: boolean;
  /** False when no password is set (e.g. a driver without panel access). */
  canLogin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

/* ---------------------------------------------------------------- Settings */

export interface PaymentSettings {
  qpay: boolean;
  bank: boolean;
  cod: boolean;
  bankName: string;
  bankAccount: string;
  bankAccountName: string;
}

export interface StoreSettings {
  storeName: string;
  supportPhone: string;
  supportEmail: string;
  workingHours: string;
  address: string;
  lowStockThreshold: number;
  returnDays: number;
  /** Central zones only. */
  freeDeliveryThreshold: number;
  /** "HH:MM" — orders after this go to the day after tomorrow. */
  nextDayCutoff: string;
  oversizedFee: number;
  payments: PaymentSettings;
  notifyNewOrder: boolean;
  notifyLowStock: boolean;
  smsOrderConfirm: boolean;
  smsShipping: boolean;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "hotulan.mn",
  supportPhone: "7700-0000",
  supportEmail: "info@hotulan.mn",
  workingHours: "Даваа–Ням 09:00–21:00",
  address: "[ДЭЛГҮҮРИЙН ХАЯГ]",
  lowStockThreshold: 10,
  returnDays: 14,
  freeDeliveryThreshold: 200_000,
  nextDayCutoff: "16:00",
  oversizedFee: 10_000,
  payments: { qpay: true, bank: true, cod: true, bankName: "Хаан банк", bankAccount: "", bankAccountName: "" },
  notifyNewOrder: true,
  notifyLowStock: true,
  smsOrderConfirm: true,
  smsShipping: false,
};

/** Fills in fields added after a settings row was saved, including nested payment settings. */
export function withSettingsDefaults(stored: Partial<StoreSettings> | null | undefined): StoreSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    payments: { ...DEFAULT_SETTINGS.payments, ...stored?.payments },
  };
}

/** Payment methods currently enabled for checkout, in display order. */
export function enabledPaymentMethods(settings: Pick<StoreSettings, "payments">): PaymentMethod[] {
  return PAYMENT_METHODS.filter((m) => settings.payments[m]);
}
