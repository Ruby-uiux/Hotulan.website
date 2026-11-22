/**
 * Public origin of the storefront, for canonical URLs, Open Graph, sitemap and JSON-LD.
 * Set SITE_URL in production (e.g. https://hotulan.mn); local runs fall back to localhost.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export const SITE_NAME = "hotulan.mn";

/** Default description: what the store does, without unprovable claims (flaw #17). */
export const SITE_DESCRIPTION =
  "Хүүхдийн тоглоом, гэр ахуй, цахилгаан бараа, спортын хэрэгсэл. Улаанбаатар хотод хүргэлттэй онлайн дэлгүүр.";
