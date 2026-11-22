import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionSecret, verifySessionToken } from "@/lib/auth/session";

/**
 * Gatekeeper for /admin and the API.
 *
 * Public (shoppers):  GET /api/products, GET /api/settings, POST /api/orders,
 *                     POST /api/checkout/quote, /api/auth/*
 * Everything else under /api and /admin requires a validly signed session cookie.
 * Notably GET /api/orders is private — it contains customer names and phone numbers.
 *
 * This is only the first, cheap layer (edge runtime, no database). The real check —
 * staff still active, role unchanged, role allowed for this module — runs in every
 * handler via requireStaff() (lib/server/actor.ts + lib/permissions.ts).
 */

const PUBLIC_API: ReadonlyArray<{ path: string; method: string }> = [
  { path: "/api/products", method: "GET" },
  { path: "/api/settings", method: "GET" },
  { path: "/api/orders", method: "POST" },
  { path: "/api/checkout/quote", method: "POST" },
];

function isPublicApi(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/auth/")) return true;
  return PUBLIC_API.some((r) => r.path === pathname && r.method === method);
}

/**
 * Extra CSRF layer on top of SameSite=Lax: a state-changing request must come from
 * our own origin. Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE.
 */
function crossOrigin(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== request.nextUrl.origin;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isLoginPage = pathname === "/admin/login";

  if (isApi && crossOrigin(request)) {
    return NextResponse.json({ error: "Зөвшөөрөгдөөгүй эх сурвалж." }, { status: 403 });
  }
  if (isApi && isPublicApi(pathname, request.method)) return NextResponse.next();

  // The login page decides itself (against the database) whether the visitor is still signed in;
  // redirecting here on the signature alone would loop for a deactivated account.
  if (isLoginPage) return NextResponse.next();

  const secret = readSessionSecret();
  const session = secret ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;
  if (session) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай." }, { status: 401 });
  }

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", pathname + request.nextUrl.search);
  if (request.cookies.has(SESSION_COOKIE)) login.searchParams.set("expired", "1");
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
