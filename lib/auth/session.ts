/**
 * Stateless admin sessions: `base64url(payload).base64url(HMAC-SHA256(payload))`.
 *
 * Uses only Web Crypto so the same code runs in middleware (edge runtime) and in
 * Node route handlers. No session table is needed; changing SESSION_SECRET signs
 * everyone out at once.
 */

export const SESSION_COOKIE = "hotulan_admin";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // one working day

export interface SessionPayload {
  /** Username the session belongs to. */
  u: string;
  /** Expiry, unix seconds. */
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(username: string, secret: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = { u: username, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

/** Returns the payload only if the signature is valid and the session hasn't expired. */
export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;

  try {
    // crypto.subtle.verify compares in constant time — no hand-rolled string comparison.
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), fromBase64Url(signature), encoder.encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.u !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Auth is "configured" only when every piece is present and the secret is long enough
 * to resist brute force. Anything less fails closed: /admin stays locked.
 */
export function readAuthConfig(): { username: string; passwordHash: string; secret: string } | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const secret = process.env.SESSION_SECRET;
  if (!username || !passwordHash || !secret || secret.length < 32) return null;
  return { username, passwordHash, secret };
}
