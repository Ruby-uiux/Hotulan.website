import path from "node:path";
import { defineConfig } from "drizzle-kit";

const dataDir = process.env.STORE_DATA_DIR ?? path.join(process.cwd(), "data");

/**
 * `npm run db:generate` writes SQL migrations to ./drizzle from lib/server/db/schema.ts.
 * The app applies them automatically on startup (lib/server/db/client.ts).
 * For PostgreSQL: dialect "postgresql", dbCredentials.url = postgres://…
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "hotulan.db").replace(/\\/g, "/")}`,
  },
});
