import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readAuthConfig, verifySessionToken } from "@/lib/auth/session";

/**
 * Gatekeeper for /admin and the API.
 *
 * Public (shoppers):  GET /api/products, GET /api/settings, POST /api/orders, /api/auth/*
 * Everything else under /api and /admin requires a valid signed session cookie.
 * Notably GET /api/orders is private — it contains customer names and phone numbers.
 */

const PUBLIC_API: ReadonlyArray<{ path: string; method: string }> = [
  { path: "/api/products", method: "GET" },
  { path: "/api/settings", method: "GET" },
  { path: "/api/orders", method: "POST" },
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

  const config = readAuthConfig();
  const session = config ? await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, config.secret) : null;
  // A session for a username that was since changed in .env is no longer valid.
  const authenticated = session !== null && session.u === config?.username;

  if (isLoginPage) {
    // Already signed in → skip the form.
    return authenticated ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }
  if (authenticated) return NextResponse.next();

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
