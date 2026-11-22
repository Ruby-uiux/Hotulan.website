import { asc, desc, eq } from "drizzle-orm";
import type { Coupon } from "@/lib/coupons";
import { bannerState, type Banner, type HomeSection, type HomeSectionKey } from "@/lib/content";
import { getDb } from "../db/client";
import * as t from "../db/schema";

/** Coupons, banners and home sections — read side. Admin write APIs come with phase 5. */

export async function listCoupons(): Promise<Coupon[]> {
  const db = await getDb();
  return db.select().from(t.coupons).orderBy(desc(t.coupons.createdAt));
}

export async function listBanners(): Promise<Banner[]> {
  const db = await getDb();
  const rows = await db.select().from(t.banners).orderBy(asc(t.banners.sortOrder));
  return rows.map(({ createdAt: _c, ...b }) => b);
}

/** Banners a shopper should see right now. */
export async function listLiveBanners(now = Date.now()): Promise<Banner[]> {
  return (await listBanners()).filter((b) => bannerState(b, now) === "active");
}

export async function listHomeSections(): Promise<HomeSection[]> {
  const db = await getDb();
  const rows = await db.select().from(t.homeSections).orderBy(asc(t.homeSections.sortOrder));
  return rows.map((r) => ({ ...r, key: r.key as HomeSectionKey }));
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const db = await getDb();
  const [row] = await db.select().from(t.coupons).where(eq(t.coupons.code, code));
  return row ?? null;
}
