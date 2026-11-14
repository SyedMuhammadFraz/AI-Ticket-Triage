import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { KB_ARTICLES } from "../../data/kb-articles";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * A real Postgres (PGlite, in memory) with the production migrations applied
 * and the help centre loaded. No server or Docker needed.
 */
export async function createTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(schema.kbArticles).values(KB_ARTICLES);
  return { db, close: () => client.close() };
}

export async function clearTickets(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE tickets RESTART IDENTITY CASCADE`);
}
