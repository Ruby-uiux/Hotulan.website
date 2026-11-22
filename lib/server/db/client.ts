import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { count } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

/**
 * One libSQL (SQLite) connection per process. Next can load this module more than once
 * (page layer vs. route handlers, and on every dev reload), so the handle lives on globalThis.
 *
 * DATABASE_URL defaults to file:<STORE_DATA_DIR or ./data>/hotulan.db.
 */

export type Db = LibSQLDatabase<typeof schema>;
/** A transaction handle has the same query API as the db. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export const DATA_DIR = process.env.STORE_DATA_DIR ?? path.join(process.cwd(), "data");
export const LEGACY_JSON_FILE = path.join(DATA_DIR, "store.json");
const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, "hotulan.db").replace(/\\/g, "/")}`;
}

interface DbState {
  client: Client;
  db: Db;
  ready: Promise<void>;
  writeQueue: Promise<unknown>;
}

const g = globalThis as unknown as { __hotulanDb?: DbState };

/** Thrown when an old data/store.json is present but hasn't been imported yet. */
export class LegacyDataNotImportedError extends Error {
  constructor() {
    super(
      `Хуучин өгөгдөл (${LEGACY_JSON_FILE}) импортлогдоогүй байна. ` +
        "`npm run db:import` ажиллуулж SQLite руу шилжүүлнэ үү.",
    );
  }
}

async function prepare(state: DbState, options: { seedIfEmpty: boolean }): Promise<void> {
  const url = databaseUrl();
  if (url.startsWith("file:")) await mkdir(path.dirname(url.slice(5)), { recursive: true });
  // WAL lets readers proceed while a write transaction is open; persisted in the file.
  await state.client.execute("PRAGMA journal_mode = WAL");
  await state.client.execute("PRAGMA foreign_keys = ON");
  await state.client.execute("PRAGMA busy_timeout = 5000");
  await migrate(state.db, { migrationsFolder: MIGRATIONS_DIR });

  if (!options.seedIfEmpty) return;
  const [{ n }] = await state.db.select({ n: count() }).from(schema.categories);
  if (n === 0) {
    // Never seed demo data on top of a store that still has real data waiting in JSON.
    if (existsSync(LEGACY_JSON_FILE)) throw new LegacyDataNotImportedError();
    const { seedDemoStore } = await import("../seed");
    await seedDemoStore(state.db);
  }
  // First super admin from .env — a no-op once any staff member can sign in.
  const { bootstrapOwner } = await import("../repo/people");
  await bootstrapOwner(state.db);
}

function init(options: { seedIfEmpty: boolean }): DbState {
  const client = createClient({ url: databaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  const state: DbState = { client, db, ready: Promise.resolve(), writeQueue: Promise.resolve() };
  state.ready = prepare(state, options).catch((err) => {
    // Let the next request retry instead of caching a failed init forever.
    if (g.__hotulanDb === state) g.__hotulanDb = undefined;
    throw err;
  });
  return state;
}

/** Ready-to-use database: migrated, and seeded with demo data if it is brand new. */
export async function getDb(): Promise<Db> {
  g.__hotulanDb ??= init({ seedIfEmpty: true });
  await g.__hotulanDb.ready;
  return g.__hotulanDb.db;
}

/** For scripts: migrated but never auto-seeded. */
export async function getDbForScript(): Promise<{ db: Db; close: () => void }> {
  const state = init({ seedIfEmpty: false });
  await state.ready;
  return { db: state.db, close: () => state.client.close() };
}

/**
 * Runs `fn` in a write transaction, one at a time per process.
 *
 * libSQL hands each transaction its own SQLite connection; serialising writes here
 * avoids SQLITE_BUSY between them (reads are unaffected thanks to WAL). Throwing from
 * `fn` rolls everything back. On Postgres this queue can simply be removed.
 */
export async function writeTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const state = g.__hotulanDb!;
  // libSQL opens transactions in "write" mode (BEGIN IMMEDIATE) by default.
  const start = () => db.transaction(fn);
  const run = state.writeQueue.then(start, start);
  state.writeQueue = run.catch(() => undefined);
  return run;
}

/** ISO timestamp for created/updated columns — always set from code, never DB defaults. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Short random id with a readable prefix, e.g. newId("cus") → "cus_k3j9x2m4q1". */
export function newId(prefix: string): string {
  const rand = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(rand, (b) => (b % 36).toString(36)).join("");
  return `${prefix}_${Date.now().toString(36).slice(-4)}${body}`;
}
