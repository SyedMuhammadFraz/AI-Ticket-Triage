import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { SEED_COMPANIES } from "../../data/companies";
import { SEED_PRODUCTS } from "../../data/products";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/** In-memory Postgres with the store's migrations, catalogue, companies and buyers. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(drizzle(client, { schema }), { migrationsFolder: "drizzle" });
  await db.insert(schema.products).values(SEED_PRODUCTS.map((p) => ({ ...p, featured: p.featured ?? false })));

  const companies = new Map<string, schema.Company>();
  const users = new Map<string, schema.User>();
  for (const { buyers, ...c } of SEED_COMPANIES) {
    const [company] = await db.insert(schema.companies).values(c).returning();
    companies.set(c.slug, company);
    for (const b of buyers) {
      const [u] = await db.insert(schema.users).values({ ...b, companyId: company.id }).returning();
      users.set(b.email, u);
    }
  }
  return { db, companies, users, close: () => client.close() };
}
