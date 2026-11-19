import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/** Driver-agnostic type: node-postgres in the app, in-memory PGlite in tests. */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __storePool?: Pool; __storeDb?: Database };

export function getDb(): Database {
  if (globalForDb.__storeDb) return globalForDb.__storeDb;
  const env = getEnv();
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 5 : 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => console.error("[store-db] idle client error:", err.message));
  const db = drizzle(pool, { schema });
  globalForDb.__storePool = pool;
  globalForDb.__storeDb = db;
  return db;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__storePool?.end();
  globalForDb.__storePool = undefined;
  globalForDb.__storeDb = undefined;
}

export { schema };
