import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { readSessionSecret } from "@/lib/auth/session";
import { newId, nowIso, writeTx } from "../db/client";
import * as t from "../db/schema";
import { HttpError } from "../errors";
import { sms } from "../sms";

/**
 * One-time SMS codes for phone login (customer side, wired to a session in a later phase).
 *
 *  - 6 digits, valid 5 minutes, single use;
 *  - at most 5 wrong guesses per code, then it is dead;
 *  - one new code per 60 s and 5 per hour per phone (SMS cost + brute-force brake);
 *  - only HMAC-SHA256(SESSION_SECRET, phone:code) is stored — a leaked DB doesn't leak codes,
 *    and the 10^6 code space can't be brute-forced offline without the secret.
 */

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 5;

function hashCode(phone: string, code: string): string {
  const secret = readSessionSecret();
  if (!secret) throw new HttpError(503, "Баталгаажуулалт тохируулагдаагүй байна.");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("base64url");
}

/** Issues a code and "sends" it. `phone` must already be normalised ("9911-2345"). */
export async function requestOtp(phone: string, now = Date.now()): Promise<{ expiresAt: string }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();

  await writeTx(async (tx) => {
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const [{ n }] = await tx
      .select({ n: count() })
      .from(t.otpCodes)
      .where(and(eq(t.otpCodes.phone, phone), gt(t.otpCodes.createdAt, hourAgo)));
    if (n >= MAX_PER_HOUR) throw new HttpError(429, "Хэт олон код хүсэлээ. Нэг цагийн дараа дахин оролдоно уу.");

    const [last] = await tx
      .select({ createdAt: t.otpCodes.createdAt })
      .from(t.otpCodes)
      .where(eq(t.otpCodes.phone, phone))
      .orderBy(desc(t.otpCodes.createdAt))
      .limit(1);
    if (last && now - Date.parse(last.createdAt) < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - Date.parse(last.createdAt))) / 1000);
      throw new HttpError(429, `${wait} секундын дараа дахин код авах боломжтой.`, { retryAfter: wait });
    }

    // A new code replaces any older one still open for this phone.
    await tx
      .update(t.otpCodes)
      .set({ consumedAt: new Date(now).toISOString() })
      .where(and(eq(t.otpCodes.phone, phone), isNull(t.otpCodes.consumedAt)));
    await tx.insert(t.otpCodes).values({
      id: newId("otp"),
      phone,
      codeHash: hashCode(phone, code),
      expiresAt,
      createdAt: new Date(now).toISOString(),
    });
  });

  await sms().send(phone, `hotulan.mn баталгаажуулах код: ${code}. 5 минутын турш хүчинтэй.`);
  return { expiresAt };
}

/** True once for the right code; every wrong guess burns an attempt. */
export async function verifyOtp(phone: string, code: string, now = Date.now()): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  return writeTx(async (tx) => {
    const [row] = await tx
      .select()
      .from(t.otpCodes)
      .where(and(eq(t.otpCodes.phone, phone), isNull(t.otpCodes.consumedAt)))
      .orderBy(desc(t.otpCodes.createdAt))
      .limit(1);
    if (!row || Date.parse(row.expiresAt) <= now || row.attempts >= OTP_MAX_ATTEMPTS) return false;

    const expected = Buffer.from(row.codeHash);
    const actual = Buffer.from(hashCode(phone, code));
    const ok = expected.length === actual.length && timingSafeEqual(expected, actual);
    await tx
      .update(t.otpCodes)
      .set(ok ? { consumedAt: nowIso() } : { attempts: row.attempts + 1 })
      .where(eq(t.otpCodes.id, row.id));
    return ok;
  });
}
