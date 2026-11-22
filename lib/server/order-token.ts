import { createHmac, timingSafeEqual } from "node:crypto";
import { readSessionSecret } from "@/lib/auth/session";

/**
 * Order ids (HTL-123456) are short and guessable, so the confirmation page /order/[id]
 * also needs `?t=<token>`: an HMAC of the id under SESSION_SECRET. Only the shopper who
 * placed the order gets the link; without it the page is a 404 and reveals nothing
 * (name, phone, address).
 */
function sign(orderId: string): string | null {
  const secret = readSessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(`order-access:${orderId}`).digest("base64url").slice(0, 32);
}

export function orderAccessUrl(orderId: string): string {
  const t = sign(orderId);
  return t ? `/order/${encodeURIComponent(orderId)}?t=${t}` : `/order/${encodeURIComponent(orderId)}`;
}

export function verifyOrderToken(orderId: string, token: string | null | undefined): boolean {
  const expected = sign(orderId);
  if (!expected || !token || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}
