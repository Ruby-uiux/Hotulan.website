import { and, asc, count, desc, eq, gt, inArray, ne, notInArray, sql } from "drizzle-orm";
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
import { isPublished } from "@/lib/catalog";
import { evaluateCoupon, normalizeCouponCode, type Coupon } from "@/lib/coupons";
import { computeDeliveryFee } from "@/lib/delivery";
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

/**
 * Creates an order. Prices, stock, delivery fee and discount all come from the database,
 * never from the request — the client only says what, how many, where and how to pay.
 * Everything happens in one transaction: any failure leaves stock and coupons untouched.
 */
export async function createOrder(input: CheckoutInput): Promise<Order> {
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
    }

    // Resolve every line first; stock is only touched once all lines are valid.
    const resolved = [];
    for (const l of input.lines) {
      const product = await getProduct(l.productId, tx);
      if (!product || !isPublished(product)) {
        throw new HttpError(409, "Сагсанд байсан нэг бараа дэлгүүрээс хасагдсан байна.", { productId: l.productId, available: 0 });
      }
      const variant = l.variantId ? product.variants.find((v) => v.id === l.variantId) : null;
      if (l.variantId && !variant) throw new HttpError(409, `“${product.title}” — сонгосон хувилбар олдсонгүй.`, { productId: product.id, available: 0 });
      if (!l.variantId && product.variants.length > 0) throw new HttpError(400, `“${product.title}” — хувилбараа сонгоно уу.`, { productId: product.id });
      const available = variant ? variant.stock : product.stock;
      if (available < l.quantity) {
        throw new HttpError(
          409,
          available === 0 ? `“${product.title}” дууссан байна.` : `“${product.title}” — зөвхөн ${available} ширхэг үлдсэн байна.`,
          { productId: product.id, variantId: variant?.id ?? null, available },
        );
      }
      resolved.push({ product, variant: variant ?? null, quantity: l.quantity, unitPrice: variant?.price ?? product.price });
    }

    const subtotal = resolved.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    let discount = 0;
    let freeShipping = false;
    let couponCode: string | null = null;
    let couponId: string | null = null;
    if (input.couponCode) {
      const code = normalizeCouponCode(input.couponCode);
      const [row] = await tx.select().from(t.coupons).where(eq(t.coupons.code, code));
      if (!row) throw new HttpError(400, "Купон код олдсонгүй.", { field: "coupon" });
      const stats = await customerOrderStats(tx, input.phone, code);
      const result = evaluateCoupon(toCoupon(row), {
        lines: resolved.map((l) => ({ category: l.product.category, lineTotal: l.unitPrice * l.quantity })),
        customerOrderCount: stats.orders,
        customerUses: stats.uses,
      });
      if (!result.ok) throw new HttpError(400, result.reason, { field: "coupon" });
      ({ discount, freeShipping } = result);
      couponCode = code;
      couponId = row.id;
    }

    const deliveryFee = computeDeliveryFee({
      zone,
      subtotal: subtotal - discount,
      freeDeliveryThreshold: settings.freeDeliveryThreshold,
      hasOversized: resolved.some((l) => l.product.oversized),
      oversizedFee: settings.oversizedFee,
      freeShipping,
    });

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
 * Moves an order along the flow (see canTransition). Cancelling puts the items back
 * in stock; a return does not, because returned goods are inspected before resale.
 */
export async function changeOrderStatus(id: string, to: OrderStatus, actor: string): Promise<Order> {
  return writeTx(async (tx) => {
    const order = await getOrder(id, tx);
    if (!order) throw new HttpError(404, "Захиалга олдсонгүй.");
    if (!canTransition(order.status, to)) {
      throw new HttpError(409, `“${STATUS_META[order.status].label}” төлөвөөс “${STATUS_META[to].label}” руу шилжих боломжгүй.`);
    }
    if (to === "cancelled") {
      for (const l of order.lines) await returnStock(tx, l.productId, l.variantId, l.quantity);
      if (order.couponCode) {
        // Free the redemption again (guarded so it never goes below zero).
        await tx
          .update(t.coupons)
          .set({ usedCount: sql`${t.coupons.usedCount} - 1` })
          .where(and(eq(t.coupons.code, order.couponCode), gt(t.coupons.usedCount, 0)));
      }
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
