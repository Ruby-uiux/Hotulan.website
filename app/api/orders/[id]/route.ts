import { handle, readJson } from "@/lib/server/http";
import { mutateStore } from "@/lib/server/store";
import { HttpError, parseStatus } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const PATCH = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const status = parseStatus(await readJson(request));
  const order = await mutateStore((data) => {
    const order = data.orders.find((o) => o.id === id);
    if (!order) throw new HttpError(404, "Захиалга олдсонгүй.");
    order.status = status;
    return order;
  });
  return { order };
});
