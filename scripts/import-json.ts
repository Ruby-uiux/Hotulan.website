/**
 * One-time migration: data/store.json (v1) → SQLite.
 *
 *   npm run db:import             import, then rename store.json to a dated backup
 *   npm run db:import -- --dry-run  check the file and print what would be imported
 *
 * What it does, in one transaction:
 *  - creates the store structure: 20 categories (toys/home/electronics/sports keep their
 *    ids and get the new names), 9 delivery zones, slots, home sections;
 *  - copies settings (new fields get defaults), products, orders and their lines;
 *  - order status: delivery → shipping, completed → delivered; payment values are kept
 *    as-is (socialpay/card/cash show as "(хуучин)" in admin);
 *  - creates one customer per phone number and a history entry per order;
 *  - adds the .env admin (ADMIN_USERNAME) as the first super admin (if staff has no login yet).
 * Refuses to run if the database already has data. The JSON file is never modified —
 * only renamed to store.backup-<timestamp>.json after a successful import.
 */
import { existsSync } from "node:fs";
import { readFile, rename } from "node:fs/promises";
import path from "node:path";
import { count } from "drizzle-orm";
import { withSettingsDefaults, type StoreSettings } from "../lib/admin-data";
import { DATA_DIR, LEGACY_JSON_FILE, databaseUrl, getDbForScript } from "../lib/server/db/client";
import * as t from "../lib/server/db/schema";
import { bootstrapOwner } from "../lib/server/repo/people";
import { convertLegacyStatus, insertLegacyOrders, insertSeedProducts, seedBaseline } from "../lib/server/seed";
import type { LegacyStoreJson } from "../lib/server/seed/types";

const dryRun = process.argv.includes("--dry-run");

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  if (!existsSync(LEGACY_JSON_FILE)) fail(`${LEGACY_JSON_FILE} олдсонгүй — импортлох зүйл алга.`);

  const raw = JSON.parse(await readFile(LEGACY_JSON_FILE, "utf8")) as LegacyStoreJson;
  if (raw.version !== 1 || !Array.isArray(raw.products) || !Array.isArray(raw.orders)) {
    fail("store.json-ийн бүтэц танигдсангүй (version 1 хүлээж байсан).");
  }

  // Validate everything up front so a bad row fails before any write.
  const statusChanges: Record<string, number> = {};
  const payments: Record<string, number> = {};
  for (const o of raw.orders) {
    const to = convertLegacyStatus(o.status);
    if (to !== o.status) statusChanges[`${o.status} → ${to}`] = (statusChanges[`${o.status} → ${to}`] ?? 0) + 1;
    payments[o.payment] = (payments[o.payment] ?? 0) + 1;
  }
  const settings: StoreSettings = withSettingsDefaults(raw.settings as Partial<StoreSettings>);

  console.log(`Эх файл:   ${LEGACY_JSON_FILE}`);
  console.log(`Өгөгдлийн сан: ${databaseUrl()}`);
  console.log(`Бараа: ${raw.products.length} · Захиалга: ${raw.orders.length} · Хэрэглэгч (утсаар): ${new Set(raw.orders.map((o) => o.phone)).size}`);
  console.log(`Төлөв хөрвүүлэлт:`, Object.keys(statusChanges).length ? statusChanges : "байхгүй");
  console.log(`Төлбөрийн хэлбэр (хэвээр):`, payments);

  if (dryRun) {
    console.log("\n--dry-run: юу ч бичээгүй.");
    return;
  }

  const { db, close } = await getDbForScript();
  try {
    const [{ n }] = await db.select({ n: count() }).from(t.categories);
    if (n > 0) fail("Өгөгдлийн сан хоосон биш байна. Дахин импортлох бол эхлээд data/hotulan.db*-г устгана уу.");

    await db.transaction(async (tx) => {
      await seedBaseline(tx, settings);
      const owner = await bootstrapOwner(tx);
      console.log(owner ? `Супер админ: ${owner}` : "⚠ .env-д ADMIN_USERNAME/ADMIN_PASSWORD_HASH алга — супер админ серверийг асаахад үүснэ.");
      await insertSeedProducts(tx, raw.products);
      await insertLegacyOrders(tx, raw.orders, "store.json-оос импортлов");
    });
  } finally {
    close();
  }

  const backup = path.join(DATA_DIR, `store.backup-${stamp()}.json`);
  await rename(LEGACY_JSON_FILE, backup);
  console.log(`\n✓ Импорт амжилттай. Хуучин файл: ${backup}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
