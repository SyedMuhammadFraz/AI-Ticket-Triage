/**
 * Prints the ticket queue, highest priority first, and compares sample tickets
 * with their expected outcome.
 *   npm run triage:status
 */
import { asc, desc } from "drizzle-orm";
import { SEED_TICKETS } from "../data/seed-tickets";
import { closeDb, getDb } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { priorityBand } from "@/lib/triage/priority";

async function main() {
  const db = getDb();
  const rows = await db
    .select()
    .from(tickets)
    .orderBy(desc(tickets.priorityScore), asc(tickets.createdAt));

  const expectedBySubject = new Map(SEED_TICKETS.map((t) => [t.subject, t.expected]));
  let checked = 0;
  let matched = 0;

  console.table(
    rows.map((t) => {
      const expected = expectedBySubject.get(t.subject);
      let check = "";
      if (expected && (t.status === "draft_ready" || t.status === "needs_review")) {
        checked += 1;
        const ok = expected.outcome === t.status;
        if (ok) matched += 1;
        check = ok ? "✓" : `✗ expected ${expected.outcome}`;
      }
      return {
        "#": t.number,
        status: t.status,
        pri: t.status === "queued" ? "" : `${priorityBand(t.priorityScore)} (${t.priorityScore})`,
        tier: t.tier,
        category: t.category ?? "",
        urgency: t.urgency ?? "",
        conf: t.confidence?.toFixed(2) ?? "",
        review: t.reviewReasons.join(", "),
        articles: t.kbMatches.map((m) => `${m.slug}:${m.score}`).join(" "),
        error: t.lastError ?? "",
        outcome: check,
        subject: t.subject.slice(0, 40),
      };
    }),
  );
  if (checked > 0) console.log(`Sample tickets with the expected outcome: ${matched}/${checked}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
