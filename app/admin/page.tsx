import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminApp from "@/components/admin/AdminApp";
import { categoryNameMap } from "@/lib/categories";
import { can } from "@/lib/permissions";
import { getStaffSession } from "@/lib/server/actor";
import { listCategories } from "@/lib/server/repo/categories";
import { listOrders } from "@/lib/server/repo/orders";
import { listProducts, listStoreProducts } from "@/lib/server/repo/products";
import { getStoreSettings } from "@/lib/server/repo/settings";

export const metadata: Metadata = {
  title: "Админ — hotulan.mn",
  robots: { index: false, follow: false },
};

// Always render from the live database — the panel must never open on a stale snapshot.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Middleware only checks the cookie signature; this re-checks the staff row
  // (active, same role) and decides what data this role may see.
  const staff = await getStaffSession();
  if (!staff) redirect("/admin/login?expired=1");

  const [products, orders, settings, categories] = await Promise.all([
    can(staff.role, "products", "view") ? listProducts() : listStoreProducts(),
    staff.role === "driver" ? listOrders({ driverId: staff.id }) : listOrders(),
    getStoreSettings(),
    listCategories(),
  ]);
  return (
    <AdminApp
      initialProducts={products}
      initialOrders={orders}
      initialSettings={settings}
      categories={categories.filter((c) => c.parentId === null).map((c) => ({ id: c.id, label: c.name }))}
      categoryNames={categoryNameMap(categories)}
      renderedAt={new Date().toISOString()}
      adminName={staff.name}
    />
  );
}
