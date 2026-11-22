import { requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { changeOrderStatus } from "@/lib/server/repo/orders";
import { parseStatus } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Status change (orders:edit); illegal moves (e.g. delivered → new) are rejected with 409. */
export const PATCH = handle(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaff("orders", "edit");
  const { id } = await params;
  const status = parseStatus(await readJson(request));
  return { order: await changeOrderStatus(id, status, staff.username) };
});
