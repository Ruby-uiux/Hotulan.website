import { asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { AuditEntry, CustomerSummary, StaffMember } from "@/lib/admin-data";
import type { Role } from "@/lib/permissions";
import { readBootstrapAdmin } from "@/lib/auth/session";
import { getDb, newId, nowIso, type DbOrTx } from "../db/client";
import * as t from "../db/schema";

/** Customers and staff — read side, plus the audit log writer. */

/** Customers with order count, lifetime spend and last order (cancelled/returned excluded from spend). */
export async function listCustomerSummaries(): Promise<CustomerSummary[]> {
  const db = await getDb();
  const counted = sql`${t.orders.status} NOT IN ('cancelled', 'returned')`;
  const rows = await db
    .select({
      c: t.customers,
      orderCount: sql<number>`count(${t.orders.id})`.mapWith(Number),
      totalSpent: sql<number>`coalesce(sum(case when ${counted} then ${t.orders.total} else 0 end), 0)`.mapWith(Number),
      lastOrderAt: sql<string | null>`max(${t.orders.createdAt})`,
    })
    .from(t.customers)
    .leftJoin(t.orders, eq(t.orders.customerId, t.customers.id))
    .groupBy(t.customers.id)
    .orderBy(desc(sql`max(${t.orders.createdAt})`));
  return rows.map(({ c, orderCount, totalSpent, lastOrderAt }) => ({
    id: c.id,
    phone: c.phone,
    name: c.name,
    district: c.district,
    vip: c.vip,
    note: c.note,
    createdAt: c.createdAt,
    orderCount,
    totalSpent,
    lastOrderAt,
  }));
}

type StaffRow = typeof t.staff.$inferSelect;

/** Never exposes the password hash. */
function toStaff(r: StaffRow): StaffMember {
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    title: r.title,
    role: r.role,
    phone: r.phone,
    zoneIds: r.zoneIds,
    twoFactorEnabled: r.twoFactorEnabled,
    active: r.active,
    canLogin: r.passwordHash !== null,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
  };
}

export async function listStaff(filter: { role?: Role } = {}): Promise<StaffMember[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(t.staff)
    .where(filter.role ? eq(t.staff.role, filter.role) : undefined)
    .orderBy(asc(t.staff.createdAt));
  return rows.map(toStaff);
}

/** For the login route only: includes the hash. */
export async function findStaffForLogin(username: string): Promise<(StaffMember & { passwordHash: string | null }) | null> {
  const db = await getDb();
  const [row] = await db.select().from(t.staff).where(eq(t.staff.username, username));
  return row ? { ...toStaff(row), passwordHash: row.passwordHash } : null;
}

/** Minimal row for per-request session checks (lib/server/actor.ts). */
export async function getStaffAuth(id: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: t.staff.id,
      username: t.staff.username,
      name: t.staff.name,
      role: t.staff.role,
      active: t.staff.active,
      passwordHash: t.staff.passwordHash,
    })
    .from(t.staff)
    .where(eq(t.staff.id, id));
  return row ?? null;
}

export async function touchLastLogin(id: string): Promise<void> {
  const db = await getDb();
  await db.update(t.staff).set({ lastLoginAt: nowIso() }).where(eq(t.staff.id, id));
}

/**
 * Creates the first super admin from .env (ADMIN_USERNAME / ADMIN_PASSWORD_HASH), once.
 *
 * Runs only while no staff member can sign in (no row has a password). Once an owner
 * exists the .env values are never read again, so editing or deactivating staff in the
 * panel is never undone by a restart. Rows without a password (drivers) don't count,
 * otherwise demo drivers seeded before .env was filled in would lock the panel forever.
 */
export async function bootstrapOwner(db: DbOrTx): Promise<string | null> {
  const admin = readBootstrapAdmin();
  if (!admin) return null;
  const [{ n }] = await db.select({ n: count() }).from(t.staff).where(isNotNull(t.staff.passwordHash));
  if (n > 0) return null;
  const [taken] = await db.select({ id: t.staff.id }).from(t.staff).where(eq(t.staff.username, admin.username));
  if (taken) return null; // a password-less row already uses that name — don't hijack it
  const stamp = nowIso();
  await db.insert(t.staff).values({
    id: newId("stf"),
    username: admin.username,
    name: process.env.ADMIN_DISPLAY_NAME?.trim() || admin.username,
    title: "Эзэмшигч",
    role: "super_admin",
    passwordHash: admin.passwordHash,
    createdAt: stamp,
    updatedAt: stamp,
  });
  await recordAudit(db, { actor: "system", action: "create", entity: "staff", summary: `Анхны супер админ .env-ээс үүсгэв: ${admin.username}` });
  console.log(`[auth] Анхны супер админ үүсгэв: ${admin.username}`);
  return admin.username;
}

export async function recordAudit(
  db: DbOrTx,
  e: { actor: string; action: string; entity: string; entityId?: string | null; summary: string },
): Promise<void> {
  await db.insert(t.auditLog).values({ ...e, entityId: e.entityId ?? null, createdAt: nowIso() });
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  const db = await getDb();
  return db.select().from(t.auditLog).orderBy(desc(t.auditLog.createdAt), desc(t.auditLog.id)).limit(limit);
}
