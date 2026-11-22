import { asc, eq } from "drizzle-orm";
import type { DeliverySlot, DeliveryZone } from "@/lib/delivery";
import { getDb, writeTx, type DbOrTx } from "../db/client";
import * as t from "../db/schema";
import { HttpError } from "../errors";

export async function listZones(options: { activeOnly?: boolean } = {}, db?: DbOrTx): Promise<DeliveryZone[]> {
  const conn = db ?? (await getDb());
  const rows = await conn.select().from(t.deliveryZones).orderBy(asc(t.deliveryZones.sortOrder));
  return options.activeOnly ? rows.filter((z) => z.active) : rows;
}

export async function getZone(id: string, db?: DbOrTx): Promise<DeliveryZone | null> {
  const conn = db ?? (await getDb());
  const [row] = await conn.select().from(t.deliveryZones).where(eq(t.deliveryZones.id, id));
  return row ?? null;
}

export async function listSlots(options: { activeOnly?: boolean } = {}, db?: DbOrTx): Promise<DeliverySlot[]> {
  const conn = db ?? (await getDb());
  const rows = await conn.select().from(t.deliverySlots).orderBy(asc(t.deliverySlots.sortOrder));
  return options.activeOnly ? rows.filter((s) => s.active) : rows;
}

export type ZonePatch = Partial<Pick<DeliveryZone, "region" | "fee" | "etaHours" | "khorooCount" | "active">>;

/** Zones are a fixed set (UB's 9 districts); admin edits price, ETA and availability. */
export async function updateZone(id: string, patch: ZonePatch): Promise<DeliveryZone> {
  return writeTx(async (tx) => {
    const [row] = await tx.update(t.deliveryZones).set(patch).where(eq(t.deliveryZones.id, id)).returning();
    if (!row) throw new HttpError(404, "Хүргэлтийн бүс олдсонгүй.");
    return row;
  });
}
