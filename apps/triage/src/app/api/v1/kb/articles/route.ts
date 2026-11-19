import { asc } from "drizzle-orm";
import { kbArticles } from "@/lib/db/schema";
import { apiJson, withApiAuth } from "@/lib/integrations/http";

/** GET /api/v1/kb/articles — the help centre, so a host app can publish the same articles the AI uses. */
export async function GET(request: Request): Promise<Response> {
  return withApiAuth(request, "kb:read", async ({ db }) => {
    const rows = await db
      .select({
        slug: kbArticles.slug,
        title: kbArticles.title,
        category: kbArticles.category,
        body: kbArticles.body,
        updatedAt: kbArticles.updatedAt,
      })
      .from(kbArticles)
      .orderBy(asc(kbArticles.category), asc(kbArticles.title));
    return apiJson({ articles: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })) });
  });
}
