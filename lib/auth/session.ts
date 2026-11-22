/**
 * Signed staff sessions: `base64url(payload).base64url(HMAC-SHA256(payload))`.
 *
 * Uses only Web Crypto so the same code runs in middleware (edge runtime) and in
 * Node route handlers. The token carries the staff id and the role it was issued for;
 * middleware only checks the signature, while every server handler re-reads the staff
 * row (lib/server/actor.ts) so a deactivated account or a changed role ends the session
 * on the next request. Changing SESSION_SECRET signs everyone out at once.
 */

export const SESSION_COOKIE = "hotulan_admin";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // one working day

export interface SessionPayload {
  /** staff.id the session belongs to. */
  sid: string;
  /** Role at sign-in; a session whose role no longer matches the database is rejected. */
  role: Role;
  /** Expiry, unix seconds. */
  exp: number;
}

import { isRole, type Role } from "@/lib/permissions";

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

export async function createSessionToken(staff: { id: string; role: Role }, secret: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = { sid: staff.id, role: staff.role, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
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
    if (typeof payload.sid !== "string" || !isRole(payload.role) || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Session signing key. Missing or shorter than 32 characters → fail closed: /admin stays locked. */
/** Why SESSION_SECRET is unusable, or null if it's fine (checked at server start in production). */
export function sessionSecretProblem(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return "тохируулагдаагүй байна.";
  if (secret.length < 32) return `хэт богино байна (${secret.length} тэмдэгт, дор хаяж 32 хэрэгтэй).`;
  return null;
}

export function readSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

/**
 * One-time bootstrap account from .env (ADMIN_USERNAME / ADMIN_PASSWORD_HASH). Used only
 * to create the first super admin while no staff member can sign in; after that, logins
 * come from the staff table and these variables are ignored.
 */
export function readBootstrapAdmin(): { username: string; passwordHash: string } | null {
  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  return username && passwordHash ? { username, passwordHash } : null;
}
