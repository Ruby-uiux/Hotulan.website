import { requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { HttpError } from "@/lib/server/errors";
import { adjustProductStock, deleteProduct, getProduct, updateProduct } from "@/lib/server/repo/products";
import { parseProductInput, parseStockDelta } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Full edit from the product form. Fields not sent keep their current value; stock is never overwritten here. */
export const PUT = handle(async (request: Request, { params }: Ctx) => {
  await requireStaff("products", "edit");
  const { id } = await params;
  const body = await readJson(request);
  const existing = await getProduct(id);
  if (!existing) throw new HttpError(404, "Бараа олдсонгүй. Өөр хэрэглэгч устгасан байж магадгүй.");
  return { product: await updateProduct(id, parseProductInput(body, existing)) };
});

/** Restock / write-off by `{ delta }` from the inline stepper; concurrent sales are never undone. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const staff = await requireStaff("products", "edit");
  const { id } = await params;
  return { product: await adjustProductStock(id, parseStockDelta(await readJson(request)), staff.username) };
});

/** Deleting is "full" access (super admin only in the matrix). */
export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  await requireStaff("products", "full");
  const { id } = await params;
  await deleteProduct(id);
  return { ok: true };
});
