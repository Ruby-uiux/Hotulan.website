import { requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { HttpError } from "@/lib/server/errors";
import { deleteProduct, getProduct, setProductStock, updateProduct } from "@/lib/server/repo/products";
import { parseProductInput, parseStock } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Full edit from the product form. Fields not sent keep their current value. */
export const PUT = handle(async (request: Request, { params }: Ctx) => {
  await requireStaff("products", "edit");
  const { id } = await params;
  const body = await readJson(request);
  const existing = await getProduct(id);
  if (!existing) throw new HttpError(404, "Бараа олдсонгүй. Өөр хэрэглэгч устгасан байж магадгүй.");
  return { product: await updateProduct(id, parseProductInput(body, existing)) };
});

/** Stock-only update from the inline stepper — small payload, no risk of clobbering other edits. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireStaff("products", "edit");
  const { id } = await params;
  return { product: await setProductStock(id, parseStock(await readJson(request))) };
});

/** Deleting is "full" access (super admin only in the matrix). */
export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  await requireStaff("products", "full");
  const { id } = await params;
  await deleteProduct(id);
  return { ok: true };
});
