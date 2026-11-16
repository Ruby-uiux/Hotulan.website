import { promises as fs } from "node:fs";
import path from "node:path";
import { PRODUCTS, type Product } from "../catalog";
import { DEFAULT_SETTINGS, INITIAL_ORDERS, type Order, type StoreSettings } from "../admin-data";

/**
 * Single-file JSON persistence shared by the storefront and /admin.
 *
 * Deliberately small: one process, one file, writes serialized through a queue and
 * committed with write-temp-then-rename so a crash mid-write never leaves a torn file.
 * Everything goes through readStore()/mutateStore(), so swapping in Postgres/SQLite
 * later means replacing this module only — routes and UI stay untouched.
 */

export interface StoreData {
  version: 1;
  products: Product[];
  orders: Order[];
  settings: StoreSettings;
}

const DATA_DIR = process.env.STORE_DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

export function seedData(): StoreData {
  return {
    version: 1,
    products: structuredClone(PRODUCTS),
    orders: structuredClone(INITIAL_ORDERS),
    settings: { ...DEFAULT_SETTINGS },
  };
}

async function writeAtomic(data: StoreData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  // Windows can briefly refuse the rename while another request has the file open.
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, DATA_FILE);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === "EPERM" || code === "EBUSY") && attempt < 5) {
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        continue;
      }
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }
}

async function readFromDisk(): Promise<StoreData> {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as StoreData;
    // Settings added in later versions fall back to defaults instead of crashing old files.
    return { ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    const seeded = seedData();
    await writeAtomic(seeded);
    return seeded;
  }
}

/**
 * Next can instantiate this module more than once (page layer vs. route-handler layer),
 * so the write queue lives on globalThis to stay process-wide.
 */
const globalQueue = globalThis as unknown as { __hotulanStoreQueue?: Promise<unknown> };

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = (globalQueue.__hotulanStoreQueue ?? Promise.resolve()).then(task, task);
  // Keep the chain alive even when a task rejects; the caller still sees the rejection.
  globalQueue.__hotulanStoreQueue = run.catch(() => undefined);
  return run;
}

/** Reads wait behind pending writes, so a read right after a mutation sees its result. */
export function readStore(): Promise<StoreData> {
  return enqueue(readFromDisk);
}

/**
 * Read-modify-write under the queue. `fn` mutates `data` in place and returns a result;
 * throwing from `fn` aborts without writing anything.
 */
export function mutateStore<T>(fn: (data: StoreData) => T): Promise<T> {
  return enqueue(async () => {
    const data = await readFromDisk();
    const result = fn(data);
    await writeAtomic(data);
    return result;
  });
}

export function resetStore(): Promise<StoreData> {
  return enqueue(async () => {
    const seeded = seedData();
    await writeAtomic(seeded);
    return seeded;
  });
}
