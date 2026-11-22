/**
 * Database schema (Drizzle, SQLite).
 *
 * Portability rules so a later move to PostgreSQL is a schema-file swap, not a rewrite:
 *  - ids are text (no autoincrement in business tables except append-only logs);
 *  - money is integer ₮; timestamps are ISO-8601 text (→ timestamptz in PG);
 *  - booleans use integer({ mode: "boolean" }) (→ boolean); JSON uses text({ mode: "json" }) (→ jsonb);
 *  - all queries go through the Drizzle query builder in lib/server/repo — no raw SQLite SQL.
 * To migrate: copy this file to pgTable/pg-core types, point drizzle.config.ts at Postgres,
 * `npm run db:generate`, and swap the client in ./client.ts.
 */
import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { ProductSpec } from "@/lib/catalog";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const createdAt = () => text("created_at").notNull().default(now);
const updatedAt = () => text("updated_at").notNull().default(now);
const bool = (name: string) => integer(name, { mode: "boolean" });
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

/* ---------------------------------------------------------------- Catalogue */

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id, { onDelete: "restrict" }),
    icon: text("icon"),
    image: text("image"),
    sortOrder: integer("sort_order").notNull().default(0),
    hidden: bool("hidden").notNull().default(false),
    showOnHome: bool("show_on_home").notNull().default(true),
    showInMenu: bool("show_in_menu").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    brand: text("brand").notNull().default(""),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    subcategoryId: text("subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    cost: integer("cost"),
    sku: text("sku"),
    barcode: text("barcode"),
    rating: real("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    image: text("image").notNull().default(""),
    gallery: json<string[]>("gallery").notNull().default([]),
    badge: text("badge"),
    stock: integer("stock").notNull().default(0),
    lowStockAlert: integer("low_stock_alert"),
    status: text("status", { enum: ["active", "draft", "scheduled"] }).notNull().default("active"),
    publishAt: text("publish_at"),
    featured: bool("featured").notNull().default(false),
    warrantyMonths: integer("warranty_months").notNull().default(12),
    weightKg: real("weight_kg"),
    oversized: bool("oversized").notNull().default(false),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    features: json<string[]>("features").notNull().default([]),
    specs: json<ProductSpec[]>("specs").notNull().default([]),
    keywords: json<string[]>("keywords").notNull().default([]),
    /** Keeps the admin list order stable (newest first) independent of id format. */
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_subcategory_idx").on(t.subcategoryId),
    index("products_status_idx").on(t.status),
    uniqueIndex("products_sku_uq").on(t.sku),
  ],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    option: text("option").notNull(),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    stock: integer("stock").notNull().default(0),
    sku: text("sku"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId), uniqueIndex("variants_sku_uq").on(t.sku)],
);

/* ---------------------------------------------------------------- Customers */

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    /** Normalised "9911-2345". */
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    district: text("district"),
    vip: bool("vip").notNull().default(false),
    note: text("note").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_phone_uq").on(t.phone)],
);

/**
 * One-time SMS codes for customer phone login. Only an HMAC of the code is stored;
 * a row is single-use (consumed_at) and dies after expires_at or too many attempts.
 */
export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: text("id").primaryKey(),
    /** Normalised "9911-2345". */
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_phone_created_idx").on(t.phone, t.createdAt)],
);

/* ------------------------------------------------------------------- Staff */

export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull().default(""),
    role: text("role", { enum: ["super_admin", "manager", "warehouse", "driver"] }).notNull(),
    /** scrypt hash (lib/auth/password.ts); null = cannot sign in to the panel. */
    passwordHash: text("password_hash"),
    phone: text("phone"),
    zoneIds: json<string[]>("zone_ids").notNull().default([]),
    twoFactorEnabled: bool("two_factor_enabled").notNull().default(false),
    active: bool("active").notNull().default(true),
    lastLoginAt: text("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("staff_username_uq").on(t.username)],
);

/* ---------------------------------------------------------------- Delivery */

export const deliveryZones = sqliteTable("delivery_zones", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  region: text("region", { enum: ["central", "remote"] }).notNull(),
  fee: integer("fee").notNull(),
  etaHours: integer("eta_hours").notNull().default(24),
  khorooCount: integer("khoroo_count").notNull().default(1),
  active: bool("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const deliverySlots = sqliteTable("delivery_slots", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  capacity: integer("capacity"),
  active: bool("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ------------------------------------------------------------------ Orders */

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    district: text("district").notNull(),
    zoneId: text("zone_id").references(() => deliveryZones.id, { onDelete: "set null" }),
    khoroo: integer("khoroo"),
    address: text("address").notNull().default(""),
    deliveryNote: text("delivery_note").notNull().default(""),
    deliveryDate: text("delivery_date"),
    deliverySlot: text("delivery_slot"),
    /** qpay | bank | cod — or a legacy value (socialpay, card, cash) on imported orders. */
    payment: text("payment").notNull(),
    paymentStatus: text("payment_status", { enum: ["pending", "paid", "failed", "refunded"] }).notNull().default("pending"),
    status: text("status", {
      enum: ["new", "paid", "packing", "shipping", "delivered", "cancelled", "returned"],
    }).notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    couponCode: text("coupon_code"),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    ebarimtType: text("ebarimt_type", { enum: ["person", "company"] }).notNull().default("person"),
    ebarimtRegNo: text("ebarimt_reg_no"),
    driverId: text("driver_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_phone_idx").on(t.phone),
    index("orders_customer_idx").on(t.customerId),
    index("orders_driver_idx").on(t.driverId),
  ],
);

export const orderLines = sqliteTable(
  "order_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** No FK: products can be deleted while history stays intact. */
    productId: text("product_id").notNull(),
    variantId: text("variant_id"),
    title: text("title").notNull(),
    variantName: text("variant_name"),
    sku: text("sku"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("order_lines_order_idx").on(t.orderId), index("order_lines_product_idx").on(t.productId)],
);

export const orderEvents = sqliteTable(
  "order_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["created", "status", "payment", "note", "assign", "imported"] }).notNull(),
    message: text("message").notNull().default(""),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actor: text("actor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/* --------------------------------------------------------------- Marketing */

export const coupons = sqliteTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type", { enum: ["percent", "amount", "free_shipping"] }).notNull(),
    value: integer("value").notNull().default(0),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    categoryIds: json<string[]>("category_ids").notNull().default([]),
    firstOrderOnly: bool("first_order_only").notNull().default(false),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    active: bool("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_code_uq").on(t.code)],
);

export const banners = sqliteTable("banners", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default(""),
  href: text("href").notNull().default("/"),
  imageDesktop: text("image_desktop"),
  imageMobile: text("image_mobile"),
  background: text("background").notNull().default("#0000ff"),
  foreground: text("foreground").notNull().default("#ffffff"),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  active: bool("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const homeSections = sqliteTable("home_sections", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  enabled: bool("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  config: json<Record<string, unknown>>("config").notNull().default({}),
});

/* ------------------------------------------------------------------ System */

/** Key/value JSON settings: "store" (StoreSettings), "appearance" (AppearanceSettings). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: json<unknown>("value").notNull(),
  updatedAt: updatedAt(),
});

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
