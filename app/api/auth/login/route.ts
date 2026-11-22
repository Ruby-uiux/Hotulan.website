import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, readSessionSecret } from "@/lib/auth/session";
import { findStaffForLogin, touchLastLogin } from "@/lib/server/repo/people";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Brute-force brake: 5 failed attempts per client per 15 minutes. In-memory is enough
 * for a single-process deployment; behind several instances move this to Redis.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

/**
 * X-Forwarded-For is client-controlled unless a trusted proxy overwrites it, so it is only
 * honoured with TRUST_PROXY=1. Otherwise all attempts share one bucket: an attacker can
 * at worst delay logins for 15 minutes, but can never rotate headers to brute-force.
 */
function clientKey(request: Request): string {
  if (process.env.TRUST_PROXY !== "1") return "all";
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Verified against when the username doesn't exist, so timing doesn't reveal valid usernames. */
let dummyHash: Promise<string> | null = null;

function json(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

export async function POST(request: Request) {
  const secret = readSessionSecret();
  if (!secret) {
    return json("Админ нэвтрэлт тохируулагдаагүй байна. .env.local файлыг шалгана уу.", 503);
  }

  const key = clientKey(request);
  const now = Date.now();
  const record = failures.get(key);
  if (record && record.resetAt > now && record.count >= MAX_FAILURES) {
    const minutes = Math.ceil((record.resetAt - now) / 60_000);
    return json(`Олон удаа буруу оролдлоо. ${minutes} минутын дараа дахин оролдоно уу.`, 429, {
      "Retry-After": String(Math.ceil((record.resetAt - now) / 1000)),
    });
  }

  let username = "";
  let password = "";
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    username = typeof body.username === "string" ? body.username.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return json("Хүсэлтийн бүтэц буруу байна.", 400);
  }
  if (!username || !password || password.length > 256) {
    return json("Нэвтрэх нэр, нууц үгээ оруулна уу.", 400);
  }

  // Always run the hash, even for an unknown username, so response time doesn't reveal which part was wrong.
  const staff = await findStaffForLogin(username);
  dummyHash ??= hashPassword("not-a-real-password");
  const passwordOk = await verifyPassword(password, staff?.passwordHash ?? (await dummyHash));
  // Deactivated staff get the same generic answer — no hint that the account exists.
  const ok = passwordOk && staff !== null && staff.active && staff.passwordHash !== null;

  if (!ok) {
    const current = record && record.resetAt > now ? record : { count: 0, resetAt: now + WINDOW_MS };
    current.count += 1;
    failures.set(key, current);
    const left = MAX_FAILURES - current.count;
    return json(
      left > 0 ? `Нэвтрэх нэр эсвэл нууц үг буруу байна. (${left} оролдлого үлдлээ)` : "Олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.",
      401,
    );
  }

  failures.delete(key);
  await touchLastLogin(staff.id);
  const token = await createSessionToken({ id: staff.id, role: staff.role }, secret);
  const response = NextResponse.json({ ok: true, username: staff.username, role: staff.role });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, // unreadable from page scripts — an XSS bug can't exfiltrate the session
    sameSite: "lax", // not sent on cross-site POSTs (CSRF)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
