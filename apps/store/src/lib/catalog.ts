import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { products, type Product } from "@/lib/db/schema";
import { CATEGORY_SLUGS, LIMITS, type ProductCategory } from "@/lib/domain";

export function isCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && (CATEGORY_SLUGS as string[]).includes(value);
}

/** Escapes LIKE wildcards so a search for "100%" matches literally. */
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listProducts(
  db: Database,
  { category, q }: { category?: ProductCategory; q?: string },
): Promise<Product[]> {
  const term = q?.trim().slice(0, LIMITS.search.max);
  const filters = [
    category ? eq(products.category, category) : undefined,
    term ? or(ilike(products.name, likeTerm(term)), ilike(products.sku, likeTerm(term)), ilike(products.description, likeTerm(term))) : undefined,
  ].filter(Boolean);
  return db
    .select()
    .from(products)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(products.featured), asc(products.category), asc(products.sku));
}

export async function getProduct(db: Database, sku: string): Promise<Product | null> {
  const [row] = await db.select().from(products).where(eq(products.sku, sku));
  return row ?? null;
}

export async function getProductsBySku(db: Database, skus: string[]): Promise<Map<string, Product>> {
  if (skus.length === 0) return new Map();
  const rows = await db.select().from(products).where(inArray(products.sku, skus));
  return new Map(rows.map((p) => [p.sku, p]));
}

export async function featuredProducts(db: Database, limit = 8): Promise<Product[]> {
  return db.select().from(products).where(eq(products.featured, true)).orderBy(asc(products.sku)).limit(limit);
}
