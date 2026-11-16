import { handle, readJson } from "@/lib/server/http";
import { mutateStore, readStore } from "@/lib/server/store";
import { parseSettings } from "@/lib/server/validate";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { settings } = await readStore();
  return { settings };
});

export const PUT = handle(async (request: Request) => {
  const next = parseSettings(await readJson(request));
  const settings = await mutateStore((data) => {
    data.settings = next;
    return next;
  });
  return { settings };
});
