import type { MetadataRoute } from "next";
import { getStoreProducts, getStoreShell } from "@/lib/server/storefront";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Home, the category index, every visible category and every published product. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [{ tree }, products] = await Promise.all([getStoreShell(), getStoreProducts()]);
  const categories = tree.flatMap((root) => [root, ...root.children]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/c`, changeFrequency: "weekly", priority: 0.6 },
    ...categories.map((c) => ({ url: `${base}/c/${encodeURIComponent(c.slug)}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: `${base}/p/${encodeURIComponent(p.id)}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
