import { handle, readJson } from "@/lib/server/http";
import { mutateStore, readStore } from "@/lib/server/store";
import { parseProductInput } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { products } = await readStore();
  return { products };
});

export const POST = handle(async (request: Request) => {
  const body = await readJson(request);
  const product = await mutateStore((data) => {
    const taken = new Set(data.products.map((p) => p.id));
    let id: string;
    do id = `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    while (taken.has(id));

    const created = parseProductInput(body, null, id);
    data.products.unshift(created);
    return created;
  });
  return Response.json({ product }, { status: 201 });
});
