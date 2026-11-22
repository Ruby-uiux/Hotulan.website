import { storage } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `next start` only serves public/ files that existed at build time, so images uploaded
 * afterwards are served from here instead. Not needed once storage moves to S3/R2.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const file = await storage()
    .get(key.join("/"))
    .catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": file.contentType,
      // Keys are random and never overwritten, so the file can be cached forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
