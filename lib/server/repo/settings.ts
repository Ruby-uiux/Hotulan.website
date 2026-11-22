import { eq } from "drizzle-orm";
import { withSettingsDefaults, type StoreSettings } from "@/lib/admin-data";
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "@/lib/content";
import { getDb, nowIso, writeTx, type DbOrTx } from "../db/client";
import * as t from "../db/schema";

async function readKey<T>(key: string, db?: DbOrTx): Promise<T | null> {
  const conn = db ?? (await getDb());
  const [row] = await conn.select({ value: t.settings.value }).from(t.settings).where(eq(t.settings.key, key));
  return (row?.value as T | undefined) ?? null;
}

async function writeKey(tx: DbOrTx, key: string, value: unknown): Promise<void> {
  const stamp = nowIso();
  await tx
    .insert(t.settings)
    .values({ key, value, updatedAt: stamp })
    .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt: stamp } });
}

/** Settings added in later versions fall back to defaults instead of crashing old rows. */
export async function getStoreSettings(db?: DbOrTx): Promise<StoreSettings> {
  return withSettingsDefaults(await readKey<Partial<StoreSettings>>("store", db));
}

/** Merges a partial update, so a form that edits only some fields never wipes the rest. */
export async function updateStoreSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  return writeTx(async (tx) => {
    const current = await getStoreSettings(tx);
    const next = withSettingsDefaults({ ...current, ...patch, payments: { ...current.payments, ...patch.payments } });
    await writeKey(tx, "store", next);
    return next;
  });
}

export async function getAppearance(db?: DbOrTx): Promise<AppearanceSettings> {
  const stored = await readKey<Partial<AppearanceSettings>>("appearance", db);
  return { ...DEFAULT_APPEARANCE, ...stored, announcement: { ...DEFAULT_APPEARANCE.announcement, ...stored?.announcement } };
}

export async function updateAppearance(patch: Partial<AppearanceSettings>): Promise<AppearanceSettings> {
  return writeTx(async (tx) => {
    const current = await getAppearance(tx);
    const next = { ...current, ...patch, announcement: { ...current.announcement, ...patch.announcement } };
    await writeKey(tx, "appearance", next);
    return next;
  });
}
