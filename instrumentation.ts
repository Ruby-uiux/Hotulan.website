/**
 * Runs once when the server starts (Next.js instrumentation hook).
 *
 * In production a missing or short SESSION_SECRET is a hard stop: it signs admin sessions
 * and order links (/order/[id]?t=…), and without it the admin is locked and customers can't
 * open their confirmation page — better to fail loudly at start than to half-work.
 * `next build` also runs with NODE_ENV=production, so the check is skipped while building.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;

  const { sessionSecretProblem } = await import("./lib/auth/session");
  const problem = sessionSecretProblem();
  if (problem) {
    console.error(
      `\n✗ SESSION_SECRET ${problem}\n` +
        "  Production-д сервер асахгүй. 32-оос дээш тэмдэгттэй санамсаргүй утга тохируулна уу:\n" +
        "    npm run admin:hash   (эсвэл: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\")\n" +
        "  дараа нь .env.local эсвэл серверийн орчны хувьсагчид SESSION_SECRET=<утга> гэж оруулна.\n",
    );
    process.exit(1);
  }
}
