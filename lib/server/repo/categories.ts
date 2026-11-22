import { asc, count, eq, inArray, isNull, or } from "drizzle-orm";
import { isPublished } from "@/lib/catalog";
import { buildCategoryTree, storefrontCategories, type Category, type CategoryNode } from "@/lib/categories";
import { getDb, nowIso, writeTx } from "../db/client";
import * as t from "../db/schema";
import { HttpError } from "../errors";

type CategoryRow = typeof t.categories.$inferSelect;

function toCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    parentId: r.parentId,
    icon: r.icon,
    image: r.image,
    sortOrder: r.sortOrder,
    hidden: r.hidden,
    showOnHome: r.showOnHome,
    showInMenu: r.showInMenu,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.select().from(t.categories).orderBy(asc(t.categories.sortOrder), asc(t.categories.name));
  return rows.map(toCategory);
}

/**
 * Products per category id (root and child counted separately — buildCategoryTree sums).
 * `publishedOnly` counts what shoppers can see.
 */
export async function productCountsByCategory(publishedOnly: boolean): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ category: t.products.categoryId, sub: t.products.subcategoryId, status: t.products.status, publishAt: t.products.publishAt })
    .from(t.products);
  const counts: Record<string, number> = {};
  for (const r of rows) {
    if (publishedOnly && !isPublished({ status: r.status, publishAt: r.publishAt })) continue;
    // A product with a subcategory counts there; buildCategoryTree adds it to the root total.
    const key = r.sub ?? r.category;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Admin: full tree with counts of all products. */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const [categories, counts] = await Promise.all([listCategories(), productCountsByCategory(false)]);
  return buildCategoryTree(categories, counts);
}

/** Storefront: hidden and empty categories removed (design: 0-product categories hide automatically). */
export async function getStoreCategoryTree(): Promise<CategoryNode[]> {
  const [categories, counts] = await Promise.all([listCategories(), productCountsByCategory(true)]);
  return storefrontCategories(buildCategoryTree(categories, counts), counts);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const db = await getDb();
  const [row] = await db.select().from(t.categories).where(eq(t.categories.slug, slug));
  return row ? toCategory(row) : null;
}

export type CategoryInput = Omit<Category, "id" | "sortOrder">;

async function assertParent(parentId: string | null, selfId: string | null): Promise<void> {
  if (parentId === null) return;
  if (parentId === selfId) throw new HttpError(400, "Ангилал өөрийгөө эх ангилал болгож болохгүй.");
  const db = await getDb();
  const [parent] = await db.select({ parentId: t.categories.parentId }).from(t.categories).where(eq(t.categories.id, parentId));
  if (!parent) throw new HttpError(400, "Эх ангилал олдсонгүй.");
  // One level only: a subcategory can't have children of its own.
  if (parent.parentId !== null) throw new HttpError(400, "Дэд ангилал дотор дахин ангилал үүсгэх боломжгүй.");
}

function isUniqueViolation(err: unknown): boolean {
  return /UNIQUE constraint failed|23505|duplicate key/i.test(String((err as { message?: string })?.message ?? err) + String((err as { cause?: unknown })?.cause ?? ""));
}

export async function createCategory(id: string, input: CategoryInput): Promise<Category> {
  await assertParent(input.parentId, null);
  try {
    return await writeTx(async (tx) => {
      // New categories go last among their siblings.
      const siblings = await tx
        .select({ n: count() })
        .from(t.categories)
        .where(input.parentId ? eq(t.categories.parentId, input.parentId) : isNull(t.categories.parentId));
      const stamp = nowIso();
      const [row] = await tx
        .insert(t.categories)
        .values({ id, ...input, sortOrder: siblings[0]?.n ?? 0, createdAt: stamp, updatedAt: stamp })
        .returning();
      return toCategory(row);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "Ийм URL холбоостой ангилал аль хэдийн байна.");
    throw err;
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  await assertParent(input.parentId, id);
  try {
    return await writeTx(async (tx) => {
      if (input.parentId !== null) {
        const [child] = await tx.select({ id: t.categories.id }).from(t.categories).where(eq(t.categories.parentId, id)).limit(1);
        if (child) throw new HttpError(400, "Дэд ангилалтай ангиллыг өөр ангилал дотор оруулах боломжгүй.");
      }
      const [row] = await tx.update(t.categories).set({ ...input, updatedAt: nowIso() }).where(eq(t.categories.id, id)).returning();
      if (!row) throw new HttpError(404, "Ангилал олдсонгүй.");
      return toCategory(row);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, "Ийм URL холбоостой ангилал аль хэдийн байна.");
    throw err;
  }
}

/** Refuses while products or subcategories still point at it — nothing is deleted implicitly. */
export async function deleteCategory(id: string): Promise<void> {
  await writeTx(async (tx) => {
    const [{ n: productCount }] = await tx
      .select({ n: count() })
      .from(t.products)
      .where(or(eq(t.products.categoryId, id), eq(t.products.subcategoryId, id)));
    if (productCount > 0) throw new HttpError(409, `Энэ ангилалд ${productCount} бараа байна. Эхлээд барааг өөр ангилалд шилжүүлнэ үү.`);
    const [{ n: childCount }] = await tx.select({ n: count() }).from(t.categories).where(eq(t.categories.parentId, id));
    if (childCount > 0) throw new HttpError(409, "Энэ ангилалд дэд ангилал байна. Эхлээд тэдгээрийг устгана уу.");
    const deleted = await tx.delete(t.categories).where(eq(t.categories.id, id)).returning({ id: t.categories.id });
    if (deleted.length === 0) throw new HttpError(404, "Ангилал олдсонгүй.");
  });
}

/** Sets sortOrder from the given order (drag-and-drop in admin). Ids must be siblings. */
export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await writeTx(async (tx) => {
    const rows = await tx.select({ id: t.categories.id, parentId: t.categories.parentId }).from(t.categories).where(inArray(t.categories.id, orderedIds));
    if (rows.length !== orderedIds.length) throw new HttpError(400, "Ангиллын жагсаалт буруу байна.");
    if (new Set(rows.map((r) => r.parentId)).size > 1) throw new HttpError(400, "Зөвхөн нэг түвшний ангиллуудыг хамт эрэмбэлнэ.");
    for (const [i, id] of orderedIds.entries()) {
      await tx.update(t.categories).set({ sortOrder: i, updatedAt: nowIso() }).where(eq(t.categories.id, id));
    }
  });
}
