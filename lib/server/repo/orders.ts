import { and, asc, count, desc, eq, gt, inArray, isNull, ne, notInArray, sql } from "drizzle-orm";
import {
  STATUS_META,
  canTransition,
  enabledPaymentMethods,
  type EbarimtType,
  type Order,
  type OrderEvent,
  type OrderEventType,
  type OrderLine,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/admin-data";
import { isPublished, type Product, type ProductVariant } from "@/lib/catalog";
import { evaluateCoupon, normalizeCouponCode, type Coupon } from "@/lib/coupons";
import { computeDeliveryFee, estimateDelivery } from "@/lib/delivery";
import { getDb, newId, nowIso, writeTx, type DbOrTx } from "../db/client";
import * as t from "../db/schema";
import { HttpError } from "../errors";
import { uniqueId } from "../http";
import { getProduct, returnStock, takeStock } from "./products";
import { getStoreSettings } from "./settings";

type OrderRow = typeof t.orders.$inferSelect;
type LineRow = typeof t.orderLines.$inferSelect;

function toOrder(r: OrderRow, lines: LineRow[]): Order {
  return {
    id: r.id,
    customerId: r.customerId,
    customer: r.customerName,
    phone: r.phone,
    district: r.district,
    zoneId: r.zoneId,
    khoroo: r.khoroo,
    address: r.address,
    deliveryNote: r.deliveryNote,
    deliveryDate: r.deliveryDate,
    deliverySlot: r.deliverySlot,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    payment: r.payment as Order["payment"],
    paymentStatus: r.paymentStatus,
    status: r.status,
    lines: lines.map(
      (l): OrderLine => ({
        productId: l.productId,
        variantId: l.variantId,
        title: l.title,
        variantName: l.variantName,
        sku: l.sku,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
      }),
    ),
    subtotal: r.subtotal,
    discount: r.discount,
    couponCode: r.couponCode,
    deliveryFee: r.deliveryFee,
    total: r.total,
    ebarimtType: r.ebarimtType,
    ebarimtRegNo: r.ebarimtRegNo,
    driverId: r.driverId,
  };
}

async function withLines(db: DbOrTx, rows: OrderRow[]): Promise<Order[]> {
  if (rows.length === 0) return [];
  const lines = await db
    .select()
    .from(t.orderLines)
    .where(inArray(t.orderLines.orderId, rows.map((r) => r.id)))
    .orderBy(asc(t.orderLines.position));
  const byOrder = new Map<string, LineRow[]>();
  for (const l of lines) byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), l]);
  return rows.map((r) => toOrder(r, byOrder.get(r.id) ?? []));
}

/** Newest first. */
export async function listOrders(filter: { status?: OrderStatus; phone?: string; driverId?: string; limit?: number } = {}): Promise<Order[]> {
  // Staff should never see a stale "new" QPay order whose reservation has already lapsed.
  await releaseExpiredReservations();
  const db = await getDb();
  const where = and(
    filter.status ? eq(t.orders.status, filter.status) : undefined,
    filter.phone ? eq(t.orders.phone, filter.phone) : undefined,
    filter.driverId ? eq(t.orders.driverId, filter.driverId) : undefined,
  );
  const q = db.select().from(t.orders).where(where).orderBy(desc(t.orders.createdAt));
  const rows = filter.limit ? await q.limit(filter.limit) : await q;
  return withLines(db, rows);
}

export async function getOrder(id: string, db?: DbOrTx): Promise<Order | null> {
  const conn = db ?? (await getDb());
  const [row] = await conn.select().from(t.orders).where(eq(t.orders.id, id));
  if (!row) return null;
  return (await withLines(conn, [row]))[0];
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const db = await getDb();
  const rows = await db.select().from(t.orderEvents).where(eq(t.orderEvents.orderId, orderId)).orderBy(desc(t.orderEvents.createdAt), desc(t.orderEvents.id));
  return rows.map((e) => ({
    id: e.id,
    orderId: e.orderId,
    type: e.type,
    message: e.message,
    fromStatus: e.fromStatus as OrderStatus | null,
    toStatus: e.toStatus as OrderStatus | null,
    actor: e.actor,
    createdAt: e.createdAt,
  }));
}

async function addEvent(
  tx: DbOrTx,
  e: { orderId: string; type: OrderEventType; message: string; actor: string; fromStatus?: OrderStatus | null; toStatus?: OrderStatus | null },
): Promise<void> {
  await tx.insert(t.orderEvents).values({ ...e, fromStatus: e.fromStatus ?? null, toStatus: e.toStatus ?? null, createdAt: nowIso() });
}

/* ----------------------------------------------------------------- Checkout */

export interface CheckoutInput {
  customer: string;
  phone: string;
  zoneId: string;
  khoroo: number | null;
  address: string;
  deliveryNote: string;
  deliveryDate: string | null;
  slotId: string | null;
  payment: PaymentMethod;
  couponCode: string | null;
  ebarimtType: EbarimtType;
  ebarimtRegNo: string | null;
  lines: { productId: string; variantId: string | null; quantity: number }[];
}

/** Non-cancelled orders a phone number placed before — for first-order coupons. */
async function customerOrderStats(tx: DbOrTx, phone: string, couponCode: string | null) {
  const [{ orders }] = await tx
    .select({ orders: count() })
    .from(t.orders)
    .where(and(eq(t.orders.phone, phone), ne(t.orders.status, "cancelled")));
  const [{ uses }] = couponCode
    ? await tx
        .select({ uses: count() })
        .from(t.orders)
        .where(and(eq(t.orders.phone, phone), eq(t.orders.couponCode, couponCode), ne(t.orders.status, "cancelled")))
    : [{ uses: 0 }];
  return { orders, uses };
}

function toCoupon(r: typeof t.coupons.$inferSelect): Coupon {
  return { ...r };
}

/* ------------------------------------------------------------------ Pricing */

type ZoneRow = typeof t.deliveryZones.$inferSelect;
type Settings = Awaited<ReturnType<typeof getStoreSettings>>;

export interface QuoteLine {
  productId: string;
  variantId: string | null;
  title: string;
  variantName: string | null;
  image: string;
  unitPrice: number;
  quantity: number;
  /** Units purchasable right now (stock). */
  available: number;
  /** Why this line can't be ordered as is, if it can't. */
  problem: string | null;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  coupon: { code: string; ok: boolean; message: string } | null;
  /** null until a district is chosen. */
  deliveryFee: number | null;
  freeShipping: boolean;
  total: number;
  zone: { id: string; name: string } | null;
}

interface PriceInput {
  lines: { productId: string; variantId: string | null; quantity: number }[];
  couponCode: string | null;
  /** For first-order / per-customer coupon limits; skipped when unknown (quote before the phone is typed). */
  phone: string | null;
  zone: ZoneRow | null;
}

type Resolved = { product: Product; variant: ProductVariant | null; quantity: number; unitPrice: number };
type Problem = { available: number; problem: string; product: Product | null };

/**
 * The one pricing routine for both the checkout quote and order creation: unit prices,
 * stock, coupon and delivery fee all come from the database. `strict` (order creation)
 * throws on the first problem; otherwise problems are reported per line and the coupon
 * result is returned instead of thrown.
 */
async function priceCart(db: DbOrTx, input: PriceInput, settings: Settings, opts: { strict: boolean }) {
  const resolved: Resolved[] = [];
  const problems = new Map<number, Problem>();

  for (const [i, l] of input.lines.entries()) {
    const product = await getProduct(l.productId, db);
    const visible = product && isPublished(product) ? product : null;
    const fail = (status: number, message: string, available: number) => {
      if (opts.strict) throw new HttpError(status, message, { productId: l.productId, variantId: l.variantId, available });
      problems.set(i, { available, problem: message, product: visible });
    };
    if (!visible) {
      fail(409, "Сагсанд байсан нэг бараа дэлгүүрээс хасагдсан байна.", 0);
      continue;
    }
    const variant = l.variantId ? (visible.variants.find((v) => v.id === l.variantId) ?? null) : null;
    if (l.variantId && !variant) {
      fail(409, `“${visible.title}” — сонгосон хувилбар олдсонгүй.`, 0);
      continue;
    }
    if (!l.variantId && visible.variants.length > 0) {
      fail(400, `“${visible.title}” — хувилбараа сонгоно уу.`, 0);
      continue;
    }
    const available = Math.max(0, variant ? variant.stock : visible.stock);
    if (available < l.quantity) {
      fail(409, available === 0 ? `“${visible.title}” дууссан байна.` : `“${visible.title}” — зөвхөн ${available} ширхэг үлдсэн байна.`, available);
      continue;
    }
    resolved.push({ product: visible, variant, quantity: l.quantity, unitPrice: variant?.price ?? visible.price });
  }

  const subtotal = resolved.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  let discount = 0;
  let freeShipping = false;
  let couponCode: string | null = null;
  let couponId: string | null = null;
  let coupon: Quote["coupon"] = null;
  if (input.couponCode) {
    const code = normalizeCouponCode(input.couponCode);
    const [row] = await db.select().from(t.coupons).where(eq(t.coupons.code, code));
    let reason: string | null = null;
    if (!row) reason = "Купон код олдсонгүй.";
    else {
      const stats = input.phone ? await customerOrderStats(db, input.phone, code) : { orders: 0, uses: 0 };
      const result = evaluateCoupon(toCoupon(row), {
        lines: resolved.map((l) => ({ category: l.product.category, lineTotal: l.unitPrice * l.quantity })),
        customerOrderCount: stats.orders,
        customerUses: stats.uses,
      });
      if (result.ok) {
        ({ discount, freeShipping } = result);
        couponCode = code;
        couponId = row.id;
      } else reason = result.reason;
    }
    if (reason && opts.strict) throw new HttpError(400, reason, { field: "coupon" });
    coupon = { code, ok: !reason, message: reason ?? "Купон хэрэглэгдлээ" };
  }

  const deliveryFee = input.zone
    ? computeDeliveryFee({
        zone: input.zone,
        subtotal: subtotal - discount,
        freeDeliveryThreshold: settings.freeDeliveryThreshold,
        hasOversized: resolved.some((l) => l.product.oversized),
        oversizedFee: settings.oversizedFee,
        freeShipping,
      })
    : 0;

  return { resolved, problems, subtotal, discount, couponCode, couponId, coupon, deliveryFee, freeShipping, hasZone: input.zone !== null };
}

/** Read-only checkout preview (POST /api/checkout/quote): the same numbers the order will get. */
export async function quoteCart(input: Omit<PriceInput, "zone"> & { zoneId: string | null }): Promise<Quote> {
  const db = await getDb();
  const settings = await getStoreSettings(db);
  const [zone] = input.zoneId ? await db.select().from(t.deliveryZones).where(eq(t.deliveryZones.id, input.zoneId)) : [];
  const live = zone && zone.active ? zone : null;
  const priced = await priceCart(db, { ...input, zone: live }, settings, { strict: false });

  const ok = new Map(priced.resolved.map((r) => [`${r.product.id}::${r.variant?.id ?? ""}`, r]));
  const lines: QuoteLine[] = input.lines.flatMap((l, i) => {
    const r = ok.get(`${l.productId}::${l.variantId ?? ""}`);
    const bad = priced.problems.get(i);
    const product = r?.product ?? bad?.product ?? null;
    if (!product) return [];
    const variant = r?.variant ?? (l.variantId ? (product.variants.find((v) => v.id === l.variantId) ?? null) : null);
    return [
      {
        productId: product.id,
        variantId: variant?.id ?? null,
        title: product.title,
        variantName: variant ? `${variant.option}: ${variant.name}` : null,
        image: product.image,
        unitPrice: variant?.price ?? product.price,
        quantity: l.quantity,
        available: bad ? bad.available : Math.max(0, variant ? variant.stock : product.stock),
        problem: bad?.problem ?? null,
      },
    ];
  });
  const fee = priced.hasZone ? priced.deliveryFee : null;
  return {
    lines,
    subtotal: priced.subtotal,
    discount: priced.discount,
    coupon: priced.coupon,
    deliveryFee: fee,
    freeShipping: priced.freeShipping,
    total: priced.subtotal - priced.discount + (fee ?? 0),
    zone: live ? { id: live.id, name: live.name } : null,
  };
}

/**
 * Creates an order. Prices, stock, delivery fee and discount all come from the database,
 * never from the request — the client only says what, how many, where and how to pay.
 * Everything happens in one transaction: any failure leaves stock and coupons untouched.
 */
export async function createOrder(input: CheckoutInput): Promise<Order> {
  // Free lapsed QPay reservations first, so their units are buyable again by this shopper.
  await releaseExpiredReservations();
  return writeTx(async (tx) => {
    const settings = await getStoreSettings(tx);
    if (!enabledPaymentMethods(settings).includes(input.payment)) {
      throw new HttpError(400, "Энэ төлбөрийн хэлбэр одоогоор боломжгүй байна.");
    }

    const [zone] = await tx.select().from(t.deliveryZones).where(eq(t.deliveryZones.id, input.zoneId));
    if (!zone || !zone.active) throw new HttpError(400, "Энэ дүүрэгт одоогоор хүргэлт хийгдэхгүй байна.");
    if (input.khoroo !== null && input.khoroo > zone.khorooCount) throw new HttpError(400, "Хорооны дугаар буруу байна.");

    let slotLabel: string | null = null;
    if (input.slotId) {
      const [slot] = await tx.select().from(t.deliverySlots).where(eq(t.deliverySlots.id, input.slotId));
      if (!slot || !slot.active) throw new HttpError(400, "Сонгосон хүргэлтийн цаг боломжгүй байна.");
      slotLabel = slot.label;
      if (slot.capacity !== null && input.deliveryDate) {
        const [{ n }] = await tx
          .select({ n: count() })
          .from(t.orders)
          .where(and(eq(t.orders.deliveryDate, input.deliveryDate), eq(t.orders.deliverySlot, slot.label), notInArray(t.orders.status, ["cancelled", "returned"])));
        if (n >= slot.capacity) throw new HttpError(409, "Сонгосон хүргэлтийн цаг дүүрсэн байна. Өөр цаг сонгоно уу.", { field: "slot" });
      }
    }
    if (input.deliveryDate) {
      // Not before the zone's earliest day, and at most a week ahead.
      const earliest = estimateDelivery(zone, settings.nextDayCutoff).date;
      const latest = new Date(Date.parse(earliest) + 7 * 86_400_000).toISOString().slice(0, 10);
      if (input.deliveryDate < earliest || input.deliveryDate > latest) {
        throw new HttpError(400, "Хүргэх өдөр боломжгүй байна. Дахин сонгоно уу.", { field: "slot" });
      }
    }

    // Same pricing as the cart/checkout quote; here any problem aborts the order.
    const { resolved, subtotal, discount, couponCode, couponId, deliveryFee } = await priceCart(
      tx,
      { lines: input.lines, couponCode: input.couponCode, phone: input.phone, zone },
      settings,
      { strict: true },
    );

    for (const l of resolved) {
      if (!(await takeStock(tx, l.product.id, l.variant?.id ?? null, l.quantity))) {
        throw new HttpError(409, `“${l.product.title}” — нөөц хүрэлцэхгүй байна.`, { productId: l.product.id });
      }
    }
    if (couponId) {
      // Guarded increment: two orders can't both take the last redemption.
      const taken = await tx
        .update(t.coupons)
        .set({ usedCount: sql`${t.coupons.usedCount} + 1` })
        .where(and(eq(t.coupons.id, couponId), sql`(${t.coupons.usageLimit} IS NULL OR ${t.coupons.usedCount} < ${t.coupons.usageLimit})`))
        .returning({ id: t.coupons.id });
      if (taken.length === 0) throw new HttpError(400, "Купоны ашиглах хязгаар дууссан байна.", { field: "coupon" });
    }

    const stamp = nowIso();
    const customerId = await upsertCustomer(tx, input.phone, input.customer, zone.name, stamp);
    const taken = new Set((await tx.select({ id: t.orders.id }).from(t.orders)).map((r) => r.id));
    const id = uniqueId("HTL-", taken);

    await tx.insert(t.orders).values({
      id,
      customerId,
      customerName: input.customer,
      phone: input.phone,
      district: zone.name,
      zoneId: zone.id,
      khoroo: input.khoroo,
      address: input.address,
      deliveryNote: input.deliveryNote,
      deliveryDate: input.deliveryDate,
      deliverySlot: slotLabel,
      payment: input.payment,
      paymentStatus: "pending",
      status: "new",
      subtotal,
      discount,
      couponCode,
      deliveryFee,
      total: subtotal - discount + deliveryFee,
      ebarimtType: input.ebarimtType,
      ebarimtRegNo: input.ebarimtType === "company" ? input.ebarimtRegNo : null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    await tx.insert(t.orderLines).values(
      resolved.map((l, i) => ({
        orderId: id,
        productId: l.product.id,
        variantId: l.variant?.id ?? null,
        title: l.product.title,
        variantName: l.variant ? `${l.variant.option}: ${l.variant.name}` : null,
        sku: l.variant?.sku ?? l.product.sku,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        position: i,
      })),
    );
    await addEvent(tx, { orderId: id, type: "created", message: "Захиалга сайтаас ирсэн", actor: "customer", toStatus: "new" });
    return (await getOrder(id, tx))!;
  });
}

async function upsertCustomer(tx: DbOrTx, phone: string, name: string, district: string, stamp: string): Promise<string> {
  const [existing] = await tx.select({ id: t.customers.id }).from(t.customers).where(eq(t.customers.phone, phone));
  if (existing) {
    await tx.update(t.customers).set({ name, district, updatedAt: stamp }).where(eq(t.customers.id, existing.id));
    return existing.id;
  }
  const id = newId("cus");
  await tx.insert(t.customers).values({ id, phone, name, district, createdAt: stamp, updatedAt: stamp });
  return id;
}

/* -------------------------------------------------------------- Admin edits */

/**
 * Puts an order's items back in stock — at most once per order, ever.
 *
 * The guarded UPDATE claims the order (stock_released_at NULL → now) before any stock
 * moves; a second caller (double click, two admins, the QPay sweeper racing an admin)
 * finds it already claimed and does nothing. Must run inside the caller's transaction so
 * the claim and the stock change commit or roll back together.
 *
 * @returns false when this order's stock had already been released.
 */
async function releaseOrderStock(tx: DbOrTx, order: Order, opts: { freeCoupon: boolean }): Promise<boolean> {
  const claimed = await tx
    .update(t.orders)
    .set({ stockReleasedAt: nowIso() })
    .where(and(eq(t.orders.id, order.id), isNull(t.orders.stockReleasedAt)))
    .returning({ id: t.orders.id });
  if (claimed.length === 0) return false;

  for (const l of order.lines) await returnStock(tx, l.productId, l.variantId, l.quantity);
  if (opts.freeCoupon && order.couponCode) {
    // Free the redemption again (guarded so it never goes below zero).
    await tx
      .update(t.coupons)
      .set({ usedCount: sql`${t.coupons.usedCount} - 1` })
      .where(and(eq(t.coupons.code, order.couponCode), gt(t.coupons.usedCount, 0)));
  }
  return true;
}

/**
 * Moves an order along the flow (see canTransition). Cancelled and returned orders put
 * their items back in stock (once — see releaseOrderStock); a cancelled order also frees
 * its coupon redemption, a returned one doesn't (the discount was used).
 */
export async function changeOrderStatus(id: string, to: OrderStatus, actor: string): Promise<Order> {
  return writeTx(async (tx) => {
    const order = await getOrder(id, tx);
    if (!order) throw new HttpError(404, "Захиалга олдсонгүй.");
    if (!canTransition(order.status, to)) {
      throw new HttpError(409, `“${STATUS_META[order.status].label}” төлөвөөс “${STATUS_META[to].label}” руу шилжих боломжгүй.`);
    }
    if (to === "cancelled" || to === "returned") {
      await releaseOrderStock(tx, order, { freeCoupon: to === "cancelled" });
    }
    // "Paid" status implies the money arrived.
    const payment: { paymentStatus?: PaymentStatus } = to === "paid" ? { paymentStatus: "paid" } : {};
    await tx.update(t.orders).set({ status: to, ...payment, updatedAt: nowIso() }).where(eq(t.orders.id, id));
    await addEvent(tx, {
      orderId: id,
      type: "status",
      message: `${STATUS_META[order.status].label} → ${STATUS_META[to].label}`,
      actor,
      fromStatus: order.status,
      toStatus: to,
    });
    return (await getOrder(id, tx))!;
  });
}

export async function setPaymentStatus(id: string, status: PaymentStatus, actor: string): Promise<Order> {
  return writeTx(async (tx) => {
    const updated = await tx.update(t.orders).set({ paymentStatus: status, updatedAt: nowIso() }).where(eq(t.orders.id, id)).returning({ id: t.orders.id });
    if (updated.length === 0) throw new HttpError(404, "Захиалга олдсонгүй.");
    await addEvent(tx, { orderId: id, type: "payment", message: `Төлбөр: ${status}`, actor });
    return (await getOrder(id, tx))!;
  });
}

export async function assignDriver(id: string, driverId: string | null, actor: string): Promise<Order> {
  return writeTx(async (tx) => {
    let name = "—";
    if (driverId) {
      const [driver] = await tx.select().from(t.staff).where(and(eq(t.staff.id, driverId), eq(t.staff.role, "driver"), eq(t.staff.active, true)));
      if (!driver) throw new HttpError(400, "Жолооч олдсонгүй.");
      name = driver.name;
    }
    const updated = await tx.update(t.orders).set({ driverId, updatedAt: nowIso() }).where(eq(t.orders.id, id)).returning({ id: t.orders.id });
    if (updated.length === 0) throw new HttpError(404, "Захиалга олдсонгүй.");
    await addEvent(tx, { orderId: id, type: "assign", message: `Жолооч: ${name}`, actor });
    return (await getOrder(id, tx))!;
  });
}

/** Internal staff note on the order timeline ("Дотоод тэмдэглэл"). */
export async function addOrderNote(id: string, message: string, actor: string): Promise<void> {
  await writeTx(async (tx) => {
    const [row] = await tx.select({ id: t.orders.id }).from(t.orders).where(eq(t.orders.id, id));
    if (!row) throw new HttpError(404, "Захиалга олдсонгүй.");
    await addEvent(tx, { orderId: id, type: "note", message, actor });
  });
}

/** Paid/active order counts per slot for a date — to enforce slot capacity in checkout (phase 4). */
export async function slotUsage(deliveryDate: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ slot: t.orders.deliverySlot, n: count() })
    .from(t.orders)
    .where(and(eq(t.orders.deliveryDate, deliveryDate), notInArray(t.orders.status, ["cancelled", "returned"])))
    .groupBy(t.orders.deliverySlot);
  return Object.fromEntries(rows.filter((r) => r.slot).map((r) => [r.slot!, r.n]));
}

/**
 * Units sold per product over the last `days` (cancelled and returned orders excluded) —
 * what "Эрэлттэй нь эхэнд" sorts by, instead of an invented popularity score.
 */
export async function salesByProduct(days = 90, now = Date.now()): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ productId: t.orderLines.productId, quantity: t.orderLines.quantity, createdAt: t.orders.createdAt })
    .from(t.orderLines)
    .innerJoin(t.orders, eq(t.orderLines.orderId, t.orders.id))
    .where(notInArray(t.orders.status, ["cancelled", "returned"]));
  const cutoff = now - days * 86_400_000;
  const out: Record<string, number> = {};
  // Compare instants in JS: stored timestamps mix "Z" and "+08:00" offsets.
  for (const r of rows) if (Date.parse(r.createdAt) >= cutoff) out[r.productId] = (out[r.productId] ?? 0) + r.quantity;
  return out;
}

/**
 * Products most often in the same order as `productId` (cancelled/returned excluded) —
 * the product page's "Хамт авдаг", from real orders rather than a guess.
 */
export async function boughtTogether(productId: string, limit = 3): Promise<string[]> {
  const db = await getDb();
  const orderIds = (
    await db
      .select({ id: t.orderLines.orderId })
      .from(t.orderLines)
      .innerJoin(t.orders, eq(t.orderLines.orderId, t.orders.id))
      .where(and(eq(t.orderLines.productId, productId), notInArray(t.orders.status, ["cancelled", "returned"])))
  ).map((r) => r.id);
  if (orderIds.length === 0) return [];
  const rows = await db
    .select({ productId: t.orderLines.productId, n: count() })
    .from(t.orderLines)
    .where(and(inArray(t.orderLines.orderId, orderIds), ne(t.orderLines.productId, productId)))
    .groupBy(t.orderLines.productId)
    .orderBy(desc(count()))
    .limit(limit);
  return rows.map((r) => r.productId);
}

/* ------------------------------------------------------- QPay reservations */

/**
 * An unpaid QPay order holds its stock for this long; then it is cancelled and the
 * units go back on sale. QPAY_RESERVATION_MINUTES overrides it (e.g. for testing).
 */
export function reservationMinutes(): number {
  const fromEnv = Number(process.env.QPAY_RESERVATION_MINUTES);
  return Number.isFinite(fromEnv) && fromEnv >= 1 ? fromEnv : 30;
}

/**
 * A cash-on-delivery order that staff haven't confirmed (moved on from "new") within this
 * many hours is cancelled and its stock released. COD_CONFIRM_HOURS overrides it.
 */
export function codConfirmHours(): number {
  const fromEnv = Number(process.env.COD_CONFIRM_HOURS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 24;
}

/** When a still-"new" order stops holding its stock, or null if it never expires on its own. */
export function reservationDeadline(order: Pick<Order, "payment" | "paymentStatus" | "status" | "createdAt">): string | null {
  if (order.status !== "new") return null;
  const created = Date.parse(order.createdAt);
  if (order.payment === "qpay" && order.paymentStatus === "pending") return new Date(created + reservationMinutes() * 60_000).toISOString();
  if (order.payment === "cod") return new Date(created + codConfirmHours() * 3_600_000).toISOString();
  return null;
}

const SWEEP_EVERY_MS = 60_000;
/** Lazy sweeps (on checkout / order list) run at most this often. */
const SWEEP_THROTTLE_MS = 30_000;

const sweepState = globalThis as unknown as {
  __hotulanSweep?: { last: number; running: Promise<number> | null; timer: ReturnType<typeof setInterval> | null };
};
function sweeper() {
  return (sweepState.__hotulanSweep ??= { last: 0, running: null, timer: null });
}

/**
 * Cancels orders whose reservation lapsed and releases their stock:
 *  - QPay orders still unpaid after reservationMinutes() (30 min);
 *  - cash-on-delivery orders staff haven't confirmed within codConfirmHours() (24 h).
 *
 * Only orders placed through checkout qualify: orders imported from store.json predate
 * online payment, so their "pending" QPay status says nothing about an abandoned payment.
 * Each order is cancelled in its own transaction that re-checks the state, so an admin
 * marking it paid at the same moment wins cleanly.
 *
 * @returns how many orders were released.
 */
export async function releaseExpiredReservations(opts: { force?: boolean; now?: number } = {}): Promise<number> {
  const s = sweeper();
  const now = opts.now ?? Date.now();
  if (s.running) return s.running;
  if (!opts.force && now - s.last < SWEEP_THROTTLE_MS) return 0;
  s.last = now;
  s.running = (async () => {
    const db = await getDb();
    const candidates = await db
      .select({ id: t.orders.id, createdAt: t.orders.createdAt, payment: t.orders.payment, paymentStatus: t.orders.paymentStatus, status: t.orders.status })
      .from(t.orders)
      .where(and(inArray(t.orders.payment, ["qpay", "cod"]), eq(t.orders.status, "new"), isNull(t.orders.stockReleasedAt)));
    // Compare instants in JS: stored timestamps mix "Z" and "+08:00" offsets.
    const expired = candidates
      .filter((c) => {
        const deadline = reservationDeadline({ ...c, payment: c.payment as Order["payment"] });
        return deadline !== null && Date.parse(deadline) <= now;
      })
      .map((c) => c.id);
    if (expired.length === 0) return 0;
    const imported = new Set(
      (await db.select({ id: t.orderEvents.orderId }).from(t.orderEvents).where(and(inArray(t.orderEvents.orderId, expired), eq(t.orderEvents.type, "imported")))).map((r) => r.id),
    );

    let released = 0;
    for (const id of expired.filter((x) => !imported.has(x))) {
      const done = await writeTx(async (tx) => {
        const order = await getOrder(id, tx);
        // Re-check inside the transaction: it may have been paid, confirmed or cancelled meanwhile.
        const deadline = order ? reservationDeadline(order) : null;
        if (!order || deadline === null || Date.parse(deadline) > now) return false;
        if (!(await releaseOrderStock(tx, order, { freeCoupon: true }))) return false;
        const qpay = order.payment === "qpay";
        await tx
          .update(t.orders)
          .set({ status: "cancelled", ...(qpay ? { paymentStatus: "failed" as const } : {}), updatedAt: nowIso() })
          .where(eq(t.orders.id, id));
        await addEvent(tx, {
          orderId: id,
          type: "status",
          message: qpay
            ? `QPay төлбөр ${reservationMinutes()} минутад хийгдээгүй тул автоматаар цуцлагдаж, нөөц суллагдлаа`
            : `Ажилтан ${codConfirmHours()} цагийн дотор баталгаажуулаагүй тул автоматаар цуцлагдаж, нөөц суллагдлаа`,
          actor: "system",
          fromStatus: "new",
          toStatus: "cancelled",
        });
        return true;
      });
      if (done) released++;
    }
    if (released > 0) console.log(`[orders] ${released} хугацаа дууссан захиалгын нөөц суллагдлаа.`);
    return released;
  })().finally(() => {
    s.running = null;
  });
  return s.running;
}

/** Background timer for long-running servers (`next start`); one per process. */
export function startReservationSweeper(): void {
  const s = sweeper();
  if (s.timer) return;
  s.timer = setInterval(() => {
    releaseExpiredReservations().catch((err) => console.error("[orders] reservation sweep failed", err));
  }, SWEEP_EVERY_MS);
  // Never keep a script or a shutting-down server alive just for this.
  s.timer.unref?.();
}
