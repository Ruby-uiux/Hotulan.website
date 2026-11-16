import { handle, readJson } from "@/lib/server/http";
import { mutateStore } from "@/lib/server/store";
import { HttpError, parseProductInput, parseStock } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Full edit from the product form. */
export const PUT = handle(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const body = await readJson(request);
  const product = await mutateStore((data) => {
    const index = data.products.findIndex((p) => p.id === id);
    if (index === -1) throw new HttpError(404, "Бараа олдсонгүй. Өөр хэрэглэгч устгасан байж магадгүй.");
    const updated = parseProductInput(body, data.products[index], id);
    data.products[index] = updated;
    return updated;
  });
  return { product };
});

/** Stock-only update from the inline stepper — small payload, no risk of clobbering other edits. */
export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const stock = parseStock(await readJson(request));
  const product = await mutateStore((data) => {
    const product = data.products.find((p) => p.id === id);
    if (!product) throw new HttpError(404, "Бараа олдсонгүй.");
    product.stock = stock;
    return product;
  });
  return { product };
});

export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  await mutateStore((data) => {
    const before = data.products.length;
    data.products = data.products.filter((p) => p.id !== id);
    if (data.products.length === before) throw new HttpError(404, "Бараа олдсонгүй.");
  });
  // Past orders keep their own title/price snapshot, so nothing else needs cleanup.
  return { ok: true };
});
