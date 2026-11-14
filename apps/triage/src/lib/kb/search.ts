import { desc, sql } from "drizzle-orm";
import type { Category } from "@/lib/domain";
import type { DbExecutor } from "@/lib/db";
import { kbArticles } from "@/lib/db/schema";

export type KbSearchResult = {
  id: string;
  slug: string;
  title: string;
  category: Category;
  body: string;
  /** Full-text relevance, normalised to 0–1. */
  textScore: number;
  /** textScore plus a boost when the article's category matches the ticket's. */
  score: number;
};

/** Boost applied when an article belongs to the category the classifier chose. */
export const CATEGORY_BOOST = 0.2;
const MAX_TERMS = 80;

/**
 * Turns free text into an OR-query of its distinct words. Built for
 * `websearch_to_tsquery`, which never throws on odd input and applies the same
 * stemming and stop-word removal as the indexed articles.
 */
export function toOrQuery(text: string): string | null {
  const terms = [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((t) => t.length > 1 && t !== "or" && t !== "and")
    .slice(0, MAX_TERMS);
  return terms.length > 0 ? terms.join(" or ") : null;
}

/**
 * Keyword search over the help centre (Postgres full-text search). Returns
 * only articles at or above `minScore`, best first. An empty result means
 * "no article answers this" — the pipeline then routes the ticket to a human.
 */
export async function searchKnowledgeBase(
  db: DbExecutor,
  text: string,
  opts: { category?: Category | null; minScore: number; limit?: number },
): Promise<KbSearchResult[]> {
  const query = toOrQuery(text);
  if (!query) return [];

  // The query text is always passed as a bound parameter, never interpolated.
  const tsQuery = sql`websearch_to_tsquery('english', ${query})`;
  const textScore = sql<number>`ts_rank(${kbArticles.search}, ${tsQuery}, 32)::float8`.mapWith(Number);

  const rows = await db
    .select({
      id: kbArticles.id,
      slug: kbArticles.slug,
      title: kbArticles.title,
      category: kbArticles.category,
      body: kbArticles.body,
      textScore,
    })
    .from(kbArticles)
    .where(sql`${kbArticles.search} @@ ${tsQuery}`)
    .orderBy(desc(textScore))
    .limit(10);

  return rows
    .map((row) => {
      const boost = opts.category && row.category === opts.category ? CATEGORY_BOOST : 0;
      return {
        ...row,
        textScore: round(row.textScore),
        score: round(Math.min(1, row.textScore + boost)),
      };
    })
    .filter((r) => r.score >= opts.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit ?? 3);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
