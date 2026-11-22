import { can } from "@/lib/permissions";
import { getStaffSession, requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { createProduct, listProducts, listStoreProducts } from "@/lib/server/repo/products";
import { parseProductInput } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/**
 * Public GET (storefront): published products only, without purchase cost.
 * Staff with products:view also get drafts and cost.
 */
export const GET = handle(async () => {
  const staff = await getStaffSession();
  return { products: staff && can(staff.role, "products", "view") ? await listProducts() : await listStoreProducts() };
});

export const POST = handle(async (request: Request) => {
  await requireStaff("products", "edit");
  const input = parseProductInput(await readJson(request), null);
  const id = `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return Response.json({ product: await createProduct(id, input) }, { status: 201 });
});
