/**
 * Seeding and legacy conversion. Shared by:
 *  - first run on an empty DB (demo store),
 *  - "reset demo data" in admin,
 *  - scripts/import-json.ts (one-time migration from data/store.json).
 */
import { inArray } from "drizzle-orm";
import { PRODUCT_BADGES, type ProductBadge } from "@/lib/catalog";
import {
  DEFAULT_SETTINGS,
  LEGACY_STATUS_MAP,
  isOrderStatus,
  withSettingsDefaults,
  type OrderStatus,
  type PaymentStatus,
  type StoreSettings,
} from "@/lib/admin-data";
import { DEFAULT_APPEARANCE } from "@/lib/content";
import { newId, nowIso, type DbOrTx } from "../db/client";
import * as t from "../db/schema";
import { CATEGORY_SEED, HOME_SECTION_SEED, SLOT_SEED, SUBCATEGORY_BY_PRODUCT, ZONE_SEED } from "./baseline";
import { DEMO_ORDERS } from "./demo-orders";
import { DEMO_PRODUCTS } from "./demo-products";
import type { LegacyOrder, SeedProduct } from "./types";

/* ----------------------------------------------------------------- Baseline */

export async function seedBaseline(db: DbOrTx, settings: Partial<StoreSettings> = {}): Promise<void> {
  const stamp = nowIso();
  const categoryRows: (typeof t.categories.$inferInsert)[] = [];
  CATEGORY_SEED.forEach((root, i) => {
    categoryRows.push({ id: root.id, slug: root.id, name: root.name, icon: root.icon, sortOrder: i, createdAt: stamp, updatedAt: stamp });
    root.children?.forEach((child, j) =>
      categoryRows.push({ id: child.id, slug: child.id, name: child.name, parentId: root.id, sortOrder: j, createdAt: stamp, updatedAt: stamp }),
    );
  });
  // Parents first so the self-referencing FK is satisfied.
  await db.insert(t.categories).values(categoryRows.filter((c) => !c.parentId));
  await db.insert(t.categories).values(categoryRows.filter((c) => c.parentId));

  await db.insert(t.deliveryZones).values(ZONE_SEED);
  await db.insert(t.deliverySlots).values(SLOT_SEED);
  await db.insert(t.homeSections).values(HOME_SECTION_SEED);
  await db.insert(t.settings).values([
    { key: "store", value: withSettingsDefaults(settings), updatedAt: stamp },
    { key: "appearance", value: DEFAULT_APPEARANCE, updatedAt: stamp },
  ]);
}

/* ----------------------------------------------------------------- Products */

function toBadge(value: unknown): ProductBadge | null {
  return (PRODUCT_BADGES as readonly unknown[]).includes(value) ? (value as ProductBadge) : null;
}

/** Inserts v1-shaped products. `position` keeps the given order (first = top of the admin list). */
export async function insertSeedProducts(db: DbOrTx, items: SeedProduct[]): Promise<void> {
  if (items.length === 0) return;
  const known = new Set(
    (await db.select({ id: t.categories.id }).from(t.categories)).map((r) => r.id),
  );
  const stamp = nowIso();
  const rows = items.map((p, i): typeof t.products.$inferInsert => {
    if (!known.has(p.category)) {
      throw new Error(`Бараа "${p.title}" (${p.id}): "${p.category}" ангилал олдсонгүй.`);
    }
    const sub = SUBCATEGORY_BY_PRODUCT[p.id];
    return {
      id: p.id,
      title: p.title,
      brand: p.brand ?? "",
      categoryId: p.category,
      subcategoryId: sub && known.has(sub) && sub.startsWith(`${p.category}-`) ? sub : null,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
      rating: p.rating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      image: p.image ?? "",
      gallery: [],
      badge: toBadge(p.badge),
      stock: p.stock,
      status: "active",
      warrantyMonths: p.warrantyMonths ?? 12,
      summary: p.summary ?? "",
      description: p.description ?? "",
      features: p.features ?? [],
      specs: p.specs ?? [],
      keywords: p.keywords ?? [],
      position: i,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });
  await db.insert(t.products).values(rows);
}

/* ------------------------------------------------------------------- Orders */

/** v1 status → v2. Unknown values fail loudly rather than being guessed. */
export function convertLegacyStatus(status: string): OrderStatus {
  if (isOrderStatus(status)) return status;
  const mapped = LEGACY_STATUS_MAP[status];
  if (!mapped) throw new Error(`Танигдаагүй захиалгын төлөв: "${status}"`);
  return mapped;
}

/**
 * v1 had no payment status. Assume money was collected once an order was delivered,
 * or when it was paid online; cash orders still on the road are pending.
 */
function inferPaymentStatus(status: OrderStatus, payment: string): PaymentStatus {
  if (status === "delivered") return "paid";
  if (status === "new") return "pending";
  return payment === "cash" ? "pending" : "paid";
}

/**
 * Inserts v1-shaped orders with customers (one per phone) and history events.
 * Payment values are stored as-is — legacy ones (socialpay, card, cash) are labelled
 * "(хуучин)" in admin, never rewritten.
 */
export async function insertLegacyOrders(db: DbOrTx, legacy: LegacyOrder[], importNote: string): Promise<void> {
  if (legacy.length === 0) return;
  const zones = await db.select({ id: t.deliveryZones.id, name: t.deliveryZones.name }).from(t.deliveryZones);
  const zoneByName = new Map(zones.map((z) => [z.name, z.id]));

  // Oldest first so the newest order's name wins for a returning phone number.
  const sorted = [...legacy].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const customerByPhone = new Map<string, typeof t.customers.$inferInsert>();
  for (const o of sorted) {
    const existing = customerByPhone.get(o.phone);
    if (existing) {
      existing.name = o.customer;
      existing.district = o.district;
      existing.updatedAt = new Date(o.createdAt).toISOString();
    } else {
      const at = new Date(o.createdAt).toISOString();
      customerByPhone.set(o.phone, { id: newId("cus"), phone: o.phone, name: o.customer, district: o.district, createdAt: at, updatedAt: at });
    }
  }
  const phones = [...customerByPhone.keys()];
  // Re-imports or resets may meet customers that already exist — reuse their ids.
  const already = await db.select().from(t.customers).where(inArray(t.customers.phone, phones));
  for (const c of already) customerByPhone.get(c.phone)!.id = c.id;
  const fresh = [...customerByPhone.values()].filter((c) => !already.some((a) => a.phone === c.phone));
  if (fresh.length) await db.insert(t.customers).values(fresh);

  const orderRows: (typeof t.orders.$inferInsert)[] = [];
  const lineRows: (typeof t.orderLines.$inferInsert)[] = [];
  const eventRows: (typeof t.orderEvents.$inferInsert)[] = [];
  const importedAt = nowIso();

  for (const o of sorted) {
    const status = convertLegacyStatus(o.status);
    const subtotal = o.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const createdAt = new Date(o.createdAt).toISOString();
    orderRows.push({
      id: o.id,
      customerId: customerByPhone.get(o.phone)!.id,
      customerName: o.customer,
      phone: o.phone,
      district: o.district,
      zoneId: zoneByName.get(o.district) ?? null,
      payment: o.payment,
      paymentStatus: inferPaymentStatus(status, o.payment),
      status,
      subtotal,
      discount: 0,
      deliveryFee: o.deliveryFee,
      total: subtotal + o.deliveryFee,
      createdAt,
      updatedAt: createdAt,
    });
    o.lines.forEach((l, i) =>
      lineRows.push({ orderId: o.id, productId: l.productId, title: l.title, unitPrice: l.unitPrice, quantity: l.quantity, position: i }),
    );
    eventRows.push({ orderId: o.id, type: "created", message: "Захиалга сайтаас ирсэн", toStatus: "new", actor: "customer", createdAt });
    eventRows.push({
      orderId: o.id,
      type: "imported",
      message: o.status === status ? importNote : `${importNote} (төлөв: ${o.status} → ${status})`,
      toStatus: status,
      actor: "system",
      createdAt: importedAt,
    });
  }

  // SQLite caps bound parameters per statement; insert in chunks.
  for (const chunk of chunks(orderRows, 50)) await db.insert(t.orders).values(chunk);
  for (const chunk of chunks(lineRows, 100)) await db.insert(t.orderLines).values(chunk);
  for (const chunk of chunks(eventRows, 100)) await db.insert(t.orderEvents).values(chunk);
}

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

/* --------------------------------------------------------------------- Demo */

/** Example marketing data from the design, only for a demo store. */
async function seedDemoExtras(db: DbOrTx): Promise<void> {
  const stamp = nowIso();
  await db.insert(t.coupons).values([
    { id: newId("cpn"), code: "WINTER20", type: "amount", value: 20_000, minSubtotal: 150_000, usageLimit: 300, endsAt: "2026-12-31T15:59:59.000Z", createdAt: stamp },
    { id: newId("cpn"), code: "FIRST10", type: "percent", value: 10, firstOrderOnly: true, perCustomerLimit: 1, createdAt: stamp },
    { id: newId("cpn"), code: "FREESHIP", type: "free_shipping", value: 0, usageLimit: 100, endsAt: "2026-11-30T15:59:59.000Z", createdAt: stamp },
    { id: newId("cpn"), code: "BABY5", type: "percent", value: 5, categoryIds: ["baby"], usageLimit: 200, endsAt: "2026-12-15T15:59:59.000Z", createdAt: stamp },
  ]);
  await db.insert(t.banners).values([
    { id: newId("bnr"), title: "Өвлийн их хямдрал — 40% хүртэл", subtitle: "Гэр ахуй, цахилгаан бараа, тоглоом", ctaLabel: "Хямдрал үзэх", href: "/search?sale=1", background: "#0000ff", foreground: "#ffffff", startsAt: "2026-11-19T16:00:00.000Z", endsAt: "2026-12-05T15:59:59.000Z", sortOrder: 0, createdAt: stamp },
    { id: newId("bnr"), title: "Шинэ жилийн бэлэг · тоглоом 1+1", subtitle: "Хүүхдийн тоглоомын ангилалд", ctaLabel: "Тоглоом үзэх", href: "/c/toys", background: "#eef0ff", foreground: "#0000c2", startsAt: "2026-10-31T16:00:00.000Z", endsAt: "2026-12-31T15:59:59.000Z", sortOrder: 1, createdAt: stamp },
    { id: newId("bnr"), title: "Ухаалаг гэр ахуйн бараа", subtitle: "Робот тоос сорогч, агаар цэвэршүүлэгч", ctaLabel: "Гэр ахуй", href: "/c/home", background: "#0f172a", foreground: "#ffffff", sortOrder: 2, createdAt: stamp },
  ]);
  // Drivers can be assigned to orders but have no panel password.
  await db.insert(t.staff).values([
    { id: newId("stf"), username: "batbayar", name: "Батбаяр", title: "Жолооч", role: "driver", phone: "9900-1111", zoneIds: ["khan-uul", "bayangol"], createdAt: stamp, updatedAt: stamp },
    { id: newId("stf"), username: "ganzorig", name: "Ганзориг", title: "Жолооч", role: "driver", phone: "9900-2222", zoneIds: ["bayanzurkh", "sukhbaatar"], createdAt: stamp, updatedAt: stamp },
  ]);
}

/**
 * Demo products, orders, coupons and drivers exist only outside production. A live store
 * must never show made-up customers in its order list or count them in revenue.
 */
export function demoDataAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Brand-new production database: categories, zones, slots, settings — no demo rows at all. */
export async function seedEmptyStore(db: DbOrTx): Promise<void> {
  await db.transaction(async (tx) => {
    await seedBaseline(tx, DEFAULT_SETTINGS);
  });
}

/** Brand-new database with no legacy JSON: structure + demo catalogue, orders and marketing. Dev only. */
export async function seedDemoStore(db: DbOrTx): Promise<void> {
  if (!demoDataAllowed()) throw new Error("Demo data is disabled in production.");
  await db.transaction(async (tx) => {
    await seedBaseline(tx, DEFAULT_SETTINGS);
    await insertSeedProducts(tx, DEMO_PRODUCTS);
    await insertLegacyOrders(tx, DEMO_ORDERS, "Жишээ өгөгдөл");
    await seedDemoExtras(tx);
  });
}

/**
 * Admin "reset demo data": restores demo products and orders. Categories, zones,
 * settings, staff, coupons and banners are kept. Must run inside writeTx.
 */
export async function resetDemoCatalog(tx: DbOrTx): Promise<void> {
  // Second guard behind the route's: this wipes every order.
  if (!demoDataAllowed()) throw new Error("Demo reset is disabled in production.");
  await tx.delete(t.orderEvents);
  await tx.delete(t.orderLines);
  await tx.delete(t.orders);
  await tx.delete(t.customers);
  await tx.delete(t.productVariants);
  await tx.delete(t.products);
  await insertSeedProducts(tx, DEMO_PRODUCTS);
  await insertLegacyOrders(tx, DEMO_ORDERS, "Жишээ өгөгдөл");
}
