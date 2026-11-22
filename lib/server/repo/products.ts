import { and, asc, eq, gte, inArray, min, sql } from "drizzle-orm";
import { isPublished, type Product, type ProductBadge, type ProductStatus, type ProductVariant } from "@/lib/catalog";
import { getDb, nowIso, writeTx, type DbOrTx } from "../db/client";
import * as t from "../db/schema";
import { HttpError } from "../errors";

type ProductRow = typeof t.products.$inferSelect;
type VariantRow = typeof t.productVariants.$inferSelect;

function toVariant(v: VariantRow): ProductVariant {
  return { id: v.id, option: v.option, name: v.name, price: v.price, stock: v.stock, sku: v.sku };
}

export function toProduct(row: ProductRow, variants: VariantRow[] = []): Product {
  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    category: row.categoryId,
    subcategory: row.subcategoryId,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    cost: row.cost ?? undefined,
    sku: row.sku,
    barcode: row.barcode,
    rating: row.rating,
    reviewCount: row.reviewCount,
    image: row.image,
    gallery: row.gallery,
    badge: (row.badge as ProductBadge | null) ?? undefined,
    stock: row.stock,
    lowStockAlert: row.lowStockAlert,
    status: row.status,
    publishAt: row.publishAt,
    featured: row.featured,
    warrantyMonths: row.warrantyMonths,
    weightKg: row.weightKg,
    oversized: row.oversized,
    summary: row.summary,
    description: row.description,
    features: row.features,
    specs: row.specs,
    keywords: row.keywords,
    variants: variants.map(toVariant),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function attachVariants(db: DbOrTx, rows: ProductRow[]): Promise<Product[]> {
  if (rows.length === 0) return [];
  const variants = await db
    .select()
    .from(t.productVariants)
    .where(inArray(t.productVariants.productId, rows.map((r) => r.id)))
    .orderBy(asc(t.productVariants.sortOrder));
  const byProduct = new Map<string, VariantRow[]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  return rows.map((r) => toProduct(r, byProduct.get(r.id)));
}

/** Admin list: every product, including drafts and purchase cost. */
export async function listProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.select().from(t.products).orderBy(asc(t.products.position), asc(t.products.createdAt));
  return attachVariants(db, rows);
}

/** Storefront: published products only, with admin-only fields stripped. */
export async function listStoreProducts(): Promise<Product[]> {
  const all = await listProducts();
  return all.filter((p) => isPublished(p)).map(stripPrivate);
}

export function stripPrivate(p: Product): Product {
  const { cost: _cost, ...rest } = p;
  return { ...rest, cost: undefined };
}

export async function getProduct(id: string, db?: DbOrTx): Promise<Product | null> {
  const conn = db ?? (await getDb());
  const [row] = await conn.select().from(t.products).where(eq(t.products.id, id));
  if (!row) return null;
  const [product] = await attachVariants(conn, [row]);
  return product;
}

/** Editable fields, already validated by lib/server/validate.ts. */
export interface ProductInput {
  title: string;
  brand: string;
  category: string;
  subcategory: string | null;
  price: number;
  compareAtPrice: number | null;
  cost: number | null;
  sku: string | null;
  barcode: string | null;
  image: string;
  gallery: string[];
  badge: ProductBadge | null;
  stock: number;
  lowStockAlert: number | null;
  status: ProductStatus;
  publishAt: string | null;
  featured: boolean;
  warrantyMonths: number;
  weightKg: number | null;
  oversized: boolean;
  summary: string;
  description: string;
}

/** Category/subcategory must exist and the subcategory must belong to the category. */
async function assertCategory(db: DbOrTx, category: string, subcategory: string | null): Promise<void> {
  const ids = subcategory ? [category, subcategory] : [category];
  const rows = await db.select({ id: t.categories.id, parentId: t.categories.parentId }).from(t.categories).where(inArray(t.categories.id, ids));
  const root = rows.find((r) => r.id === category);
  if (!root || root.parentId !== null) throw new HttpError(400, "Ангилал буруу байна.");
  if (subcategory && rows.find((r) => r.id === subcategory)?.parentId !== category) {
    throw new HttpError(400, "Дэд ангилал сонгосон ангилалд хамаарахгүй байна.");
  }
}

function toRow(input: ProductInput) {
  return {
    title: input.title,
    brand: input.brand,
    categoryId: input.category,
    subcategoryId: input.subcategory,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    cost: input.cost,
    sku: input.sku,
    barcode: input.barcode,
    image: input.image,
    gallery: input.gallery,
    badge: input.badge,
    stock: input.stock,
    lowStockAlert: input.lowStockAlert,
    status: input.status,
    publishAt: input.publishAt,
    featured: input.featured,
    warrantyMonths: input.warrantyMonths,
    weightKg: input.weightKg,
    oversized: input.oversized,
    summary: input.summary,
    description: input.description,
  };
}

/** SQLite reports unique violations in the message; Postgres as code 23505. */
function isUniqueViolation(err: unknown): boolean {
  const text = String((err as { message?: string })?.message ?? err) + String((err as { cause?: unknown })?.cause ?? "");
  return /UNIQUE constraint failed|23505|duplicate key/i.test(text);
}

export async function createProduct(id: string, input: ProductInput): Promise<Product> {
  try {
    return await writeTx(async (tx) => {
      await assertCategory(tx, input.category, input.subcategory);
      // New products go to the top of the admin list.
      const [{ top }] = await tx.select({ top: min(t.products.position) }).from(t.products);
      const stamp = nowIso();
      await tx.insert(t.products).values({ id, ...toRow(input), position: (top ?? 0) - 1, createdAt: stamp, updatedAt: stamp });
      return (await getProduct(id, tx))!;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "Ийм SKU-тай бараа аль хэдийн байна.");
    throw err;
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  try {
    return await writeTx(async (tx) => {
      await assertCategory(tx, input.category, input.subcategory);
      const updated = await tx.update(t.products).set({ ...toRow(input), updatedAt: nowIso() }).where(eq(t.products.id, id)).returning({ id: t.products.id });
      if (updated.length === 0) throw new HttpError(404, "Бараа олдсонгүй. Өөр хэрэглэгч устгасан байж магадгүй.");
      return (await getProduct(id, tx))!;
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "Ийм SKU-тай бараа аль хэдийн байна.");
    throw err;
  }
}

export async function setProductStock(id: string, stock: number): Promise<Product> {
  return writeTx(async (tx) => {
    const updated = await tx.update(t.products).set({ stock, updatedAt: nowIso() }).where(eq(t.products.id, id)).returning({ id: t.products.id });
    if (updated.length === 0) throw new HttpError(404, "Бараа олдсонгүй.");
    return (await getProduct(id, tx))!;
  });
}

/** Past orders keep their own title/price snapshot, so nothing else needs cleanup. */
export async function deleteProduct(id: string): Promise<void> {
  await writeTx(async (tx) => {
    const deleted = await tx.delete(t.products).where(eq(t.products.id, id)).returning({ id: t.products.id });
    if (deleted.length === 0) throw new HttpError(404, "Бараа олдсонгүй.");
  });
}

/**
 * Atomically takes `quantity` from stock; false if not enough is left. The WHERE guard
 * makes this safe even without the write queue (and on Postgres under concurrency).
 */
export async function takeStock(tx: DbOrTx, productId: string, variantId: string | null, quantity: number): Promise<boolean> {
  if (variantId) {
    const taken = await tx
      .update(t.productVariants)
      .set({ stock: sql`${t.productVariants.stock} - ${quantity}` })
      .where(and(eq(t.productVariants.id, variantId), eq(t.productVariants.productId, productId), gte(t.productVariants.stock, quantity)))
      .returning({ id: t.productVariants.id });
    if (taken.length === 0) return false;
  }
  // Product stock is the total across variants, so it moves too.
  const taken = await tx
    .update(t.products)
    .set({ stock: sql`${t.products.stock} - ${quantity}`, updatedAt: nowIso() })
    .where(and(eq(t.products.id, productId), gte(t.products.stock, quantity)))
    .returning({ id: t.products.id });
  return taken.length > 0;
}

/** Puts stock back (order cancelled). Silently skips products/variants deleted since. */
export async function returnStock(tx: DbOrTx, productId: string, variantId: string | null, quantity: number): Promise<void> {
  if (variantId) {
    await tx.update(t.productVariants).set({ stock: sql`${t.productVariants.stock} + ${quantity}` }).where(eq(t.productVariants.id, variantId));
  }
  await tx.update(t.products).set({ stock: sql`${t.products.stock} + ${quantity}`, updatedAt: nowIso() }).where(eq(t.products.id, productId));
}
