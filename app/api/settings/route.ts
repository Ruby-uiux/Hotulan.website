import { requireStaff } from "@/lib/server/actor";
import { handle, readJson } from "@/lib/server/http";
import { getStoreSettings, updateStoreSettings } from "@/lib/server/repo/settings";
import { parseSettings } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

/** Public GET: storefront needs phone, thresholds and enabled payment methods. Bank details are public by design. */
export const GET = handle(async () => {
  return { settings: await getStoreSettings() };
});

/** Partial update (store settings belong to the "staff & settings" module) — fields not in the body are left unchanged. */
export const PUT = handle(async (request: Request) => {
  await requireStaff("staff", "full");
  return { settings: await updateStoreSettings(parseSettings(await readJson(request))) };
});
