/**
 * Fixed-window counters kept in process memory — enough for one Node server. With several
 * instances (or serverless), move the buckets to Redis/Upstash behind the same functions.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const g = globalThis as unknown as { __hotulanRateLimits?: Map<string, Bucket> };
const buckets = (g.__hotulanRateLimits ??= new Map());

export interface Limit {
  /** Max events per window. */
  max: number;
  windowMs: number;
}

/** Seconds until `key` may act again, or 0 if it is under the limit. Doesn't count anything. */
export function retryAfter(key: string, limit: Limit, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now || b.count < limit.max) return 0;
  return Math.ceil((b.resetAt - now) / 1000);
}

/** Counts one event for `key`. */
export function hit(key: string, limit: Limit, now = Date.now()): void {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + limit.windowMs });
    sweep(now);
  } else {
    b.count += 1;
  }
}

/** Drops expired buckets now and then so the map can't grow without bound. */
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

/**
 * The shopper's IP — only when TRUST_PROXY=1, i.e. a reverse proxy (nginx, Cloudflare…)
 * overwrites X-Forwarded-For. Otherwise the header is client-controlled and we return null
 * rather than let an attacker pick a fresh "IP" per request.
 */
export function clientIp(request: Request): string | null {
  if (process.env.TRUST_PROXY !== "1") return null;
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.headers.get("x-real-ip") || null;
}
