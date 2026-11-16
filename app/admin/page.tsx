import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminApp from "@/components/admin/AdminApp";
import { SESSION_COOKIE, readAuthConfig, verifySessionToken } from "@/lib/auth/session";
import { readStore } from "@/lib/server/store";

export const metadata: Metadata = {
  title: "Админ — hotulan.mn",
  robots: { index: false, follow: false },
};

// Always render from the live store — the panel must never open on a stale snapshot.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Middleware already gates this route; re-checking here keeps the page safe even if
  // the matcher is ever changed, and gives us the signed-in username.
  const config = readAuthConfig();
  const session = config
    ? await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, config.secret)
    : null;
  if (!session || session.u !== config?.username) redirect("/admin/login");

  const { products, orders, settings } = await readStore();
  return (
    <AdminApp
      initialProducts={products}
      initialOrders={orders}
      initialSettings={settings}
      renderedAt={new Date().toISOString()}
      adminName={process.env.ADMIN_DISPLAY_NAME?.trim() || session.u}
    />
  );
}
