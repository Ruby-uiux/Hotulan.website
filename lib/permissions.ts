/**
 * Staff roles and the permission matrix from design/AdminStaff.dc.html.
 * Edge-safe (no imports) so middleware can use it.
 *
 * Enforced on the server, not just in the UI: every admin API handler calls
 * requireStaff(module, access) from lib/server/actor.ts, which re-reads the staff row
 * and checks it against this matrix.
 *
 *   GET    /api/orders          orders:view   (driver → only orders assigned to them)
 *   PATCH  /api/orders/:id      orders:edit
 *   GET    /api/products        public; products:view also sees drafts + cost
 *   POST   /api/products        products:edit
 *   PUT    /api/products/:id    products:edit
 *   PATCH  /api/products/:id    products:edit (stock)
 *   DELETE /api/products/:id    products:full
 *   POST   /api/uploads         products:edit
 *   PUT    /api/settings        staff:full    (store settings sit with staff & settings)
 *   POST   /api/admin/reset     staff:full
 */

export const ROLES = ["super_admin", "manager", "warehouse", "driver"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Супер админ",
  manager: "Менежер",
  warehouse: "Агуулах",
  driver: "Хүргэлт",
};

export const MODULES = [
  "dashboard",
  "orders",
  "products",
  "categories",
  "customers",
  "promotions",
  "appearance",
  "delivery",
  "staff",
] as const;
export type Module = (typeof MODULES)[number];

export const MODULE_LABEL: Record<Module, string> = {
  dashboard: "Хяналтын самбар",
  orders: "Захиалга",
  products: "Бараа",
  categories: "Ангилал",
  customers: "Хэрэглэгчид",
  promotions: "Урамшуулал",
  appearance: "Харагдах байдал",
  delivery: "Хүргэлтийн бүс",
  staff: "Ажилтан, тохиргоо",
};

/** none < view < edit < full (full = edit + delete + settings of that module). */
export type Access = "none" | "view" | "edit" | "full";
const RANK: Record<Access, number> = { none: 0, view: 1, edit: 2, full: 3 };

export const ACCESS_LABEL: Record<Access, string> = { none: "—", view: "Харах", edit: "Засах", full: "Бүрэн" };

const f = "full", e = "edit", v = "view", n = "none";

/** Columns: super_admin, manager, warehouse, driver — copied from the design table. */
const MATRIX: Record<Module, readonly [Access, Access, Access, Access]> = {
  dashboard: [f, v, v, n],
  orders: [f, e, e, v],
  products: [f, e, e, n],
  categories: [f, e, v, n],
  customers: [f, v, n, n],
  promotions: [f, e, n, n],
  appearance: [f, e, n, n],
  delivery: [f, v, n, v],
  staff: [f, n, n, n],
};

export function accessFor(role: Role, module: Module): Access {
  return MATRIX[module][ROLES.indexOf(role)];
}

export function can(role: Role, module: Module, needed: Exclude<Access, "none"> = "view"): boolean {
  return RANK[accessFor(role, module)] >= RANK[needed];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
