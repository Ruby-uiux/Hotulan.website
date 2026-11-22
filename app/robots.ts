import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Catalogue pages are crawlable; the admin, API, checkout, order pages and free-text search are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/checkout", "/order/", "/search?q="] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
