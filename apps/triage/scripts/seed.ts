/**
 * Seeds the help centre (8 articles, upserted by slug) and the 10 sample tickets.
 *
 *   npm run db:seed    — idempotent; adds sample tickets only if none exist yet
 *   npm run db:reset   — deletes ALL tickets (and their drafts, messages and
 *                        audit events), then re-seeds. Development only.
 */
import { eq, notInArray, sql } from "drizzle-orm";
import { KB_ARTICLES } from "../data/kb-articles";
import { SEED_TICKETS } from "../data/seed-tickets";
import { closeDb, getDb } from "@/lib/db";
import { kbArticles, tickets } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { createTicket } from "@/lib/tickets/intake";

async function main() {
  const reset = process.argv.includes("--reset");
  const env = getEnv();
  if (reset && env.NODE_ENV === "production") {
    throw new Error("Refusing to reset the database with NODE_ENV=production.");
  }

  const db = getDb();

  for (const article of KB_ARTICLES) {
    await db
      .insert(kbArticles)
      .values(article)
      .onConflictDoUpdate({
        target: kbArticles.slug,
        set: {
          title: article.title,
          category: article.category,
          keywords: article.keywords,
          body: article.body,
        },
      });
  }
  // The seed defines the help centre: articles that are no longer in it are removed.
  const removed = await db
    .delete(kbArticles)
    .where(notInArray(kbArticles.slug, KB_ARTICLES.map((a) => a.slug)))
    .returning({ slug: kbArticles.slug });
  console.log(`✓ ${KB_ARTICLES.length} help articles upserted${removed.length ? `, ${removed.length} retired` : ""}`);

  if (reset) {
    await db.execute(sql`TRUNCATE TABLE tickets RESTART IDENTITY CASCADE`);
    console.log("✓ All tickets, drafts, messages and audit events deleted");
  }

  const existing = await db.$count(tickets, eq(tickets.source, "seed"));
  if (existing > 0) {
    console.log(`• ${existing} sample tickets already present — skipping (use npm run db:reset to start over)`);
    return;
  }

  for (const t of SEED_TICKETS) {
    await createTicket(
      db,
      {
        customerName: t.customerName,
        customerEmail: t.customerEmail,
        tier: t.tier,
        subject: t.subject,
        body: t.body,
      },
      { source: "seed" },
    );
  }
  console.log(`✓ ${SEED_TICKETS.length} sample tickets queued — run \`npm run queue:process\` to triage them`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
