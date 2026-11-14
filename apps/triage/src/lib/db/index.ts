import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Driver-agnostic database type: the app uses node-postgres, the test suite
 * uses an in-process PGlite instance, and all domain code accepts either.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
/** Either the database or an open transaction — repository functions accept both. */
export type DbExecutor = Pick<Database, "select" | "insert" | "update" | "delete">;

const globalForDb = globalThis as unknown as { __triagePool?: Pool; __triageDb?: Database };

/**
 * One connection pool per process. Cached on globalThis so Next.js hot reload
 * in development doesn't open a new pool on every edit.
 */
export function getDb(): Database {
  if (globalForDb.__triageDb) return globalForDb.__triageDb;

  const env = getEnv();
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 5 : 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  const db = drizzle(pool, { schema });
  globalForDb.__triagePool = pool;
  globalForDb.__triageDb = db;
  return db;
}

/** Closes the pool (used by CLI scripts so the process can exit). */
export async function closeDb(): Promise<void> {
  await globalForDb.__triagePool?.end();
  globalForDb.__triagePool = undefined;
  globalForDb.__triageDb = undefined;
}

export { schema };
