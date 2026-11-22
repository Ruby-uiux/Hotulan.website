import { requireStaff } from "@/lib/server/actor";
import { HttpError } from "@/lib/server/errors";
import { handle } from "@/lib/server/http";
import { recordAudit } from "@/lib/server/repo/people";
import { getDb } from "@/lib/server/db/client";
import { newImageKey, sniffImageType, storage } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/** Product image upload (products:edit). multipart/form-data with a single "file" field. */
export const POST = handle(async (request: Request) => {
  const staff = await requireStaff("products", "edit");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES + 64 * 1024) throw new HttpError(413, "Зураг 5MB-аас ихгүй байх ёстой.");

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    throw new HttpError(400, "Файл илгээгдсэнгүй.");
  }
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, "Файл илгээгдсэнгүй.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Зураг 5MB-аас ихгүй байх ёстой.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new HttpError(415, "Зөвхөн JPG, PNG, WEBP, AVIF зураг оруулна уу.");

  const stored = await storage().put(newImageKey("products", type), bytes, type);
  await recordAudit(await getDb(), { actor: staff.username, action: "upload", entity: "file", entityId: stored.key, summary: `${stored.size} байт` });
  return Response.json({ file: stored }, { status: 201 });
});
