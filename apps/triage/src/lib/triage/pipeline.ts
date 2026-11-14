import { and, asc, eq, lt, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { AiServiceError, type AiProvider } from "@/lib/ai/types";
import { recordAudit } from "@/lib/audit";
import type { Database, DbExecutor } from "@/lib/db";
import { enqueueTicketEvent } from "@/lib/integrations/webhooks";
import { formatContextForPrompt } from "@/lib/tickets/context";
import { drafts, tickets, type KbMatch, type Ticket } from "@/lib/db/schema";
import type { ReviewReason } from "@/lib/domain";
import { searchKnowledgeBase } from "@/lib/kb/search";
import { checkDraftSafety, citationsAreValid, detectInjection } from "./guards";
import { computePriority } from "./priority";
import type { PromptTicket } from "./prompts";
import { classificationSchema, draftOutputSchema } from "./schemas";

export type PipelineConfig = {
  minConfidence: number;
  kbMinScore: number;
  maxAttempts: number;
};

export type PipelineDeps = { db: Database; ai: AiProvider; config: PipelineConfig };

export type ProcessResult =
  | { outcome: "skipped"; ticketId: string }
  | { outcome: "draft_ready"; ticketId: string }
  | { outcome: "needs_review"; ticketId: string; reasons: ReviewReason[] }
  | { outcome: "retry_scheduled" | "failed"; ticketId: string; error: string };

const PIPELINE_ACTOR = "triage-pipeline";
/** A ticket stuck in "processing" this long is assumed abandoned (e.g. a crashed run). */
const STALE_LOCK = sql`now() - interval '5 minutes'`;

/**
 * Atomically moves a ticket from "queued" (or an abandoned "processing") to
 * "processing". Exactly one concurrent caller can win; everyone else gets null.
 * This is what makes running triage twice on the same ticket harmless.
 */
async function claimTicket(db: Database, ticketId: string): Promise<Ticket | null> {
  const [claimed] = await db
    .update(tickets)
    .set({
      status: "processing",
      lockedAt: sql`now()`,
      triageStartedAt: sql`now()`,
      attempts: sql`${tickets.attempts} + 1`,
    })
    .where(
      and(
        eq(tickets.id, ticketId),
        or(
          eq(tickets.status, "queued"),
          and(eq(tickets.status, "processing"), lt(tickets.lockedAt, STALE_LOCK)),
        ),
      ),
    )
    .returning();
  return claimed ?? null;
}

function parseAiOutput<T>(schema: z.ZodType<T>, data: unknown, step: string): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".") || "(root)"))];
    throw new AiServiceError(
      `The AI ${step} response didn't match the expected format (${fields.join(", ")}).`,
      "invalid_output",
    );
  }
  return parsed.data;
}

/** Writes the end state of a run, but only if this run still owns the ticket. */
async function finish(db: DbExecutor, ticketId: string, values: Partial<typeof tickets.$inferInsert>) {
  await db
    .update(tickets)
    .set({ ...values, lockedAt: null })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, "processing")));
}

export async function processTicket(ticketId: string, deps: PipelineDeps): Promise<ProcessResult> {
  const { db, ai, config } = deps;

  const ticket = await claimTicket(db, ticketId);
  if (!ticket) return { outcome: "skipped", ticketId };

  await recordAudit(db, {
    ticketId,
    actorType: "system",
    actor: PIPELINE_ACTOR,
    action: "triage.started",
    details: { attempt: ticket.attempts, provider: ai.name, model: ai.model },
  });

  const promptTicket: PromptTicket = {
    subject: ticket.subject,
    body: ticket.body,
    customerName: ticket.customerName,
    tier: ticket.tier,
    context: formatContextForPrompt(ticket.context),
  };
  const ticketText = `${ticket.subject}\n${ticket.body}`;

  try {
    // 1. Classify (AI) — validated before anything is stored.
    const classifyRes = await ai.classify(promptTicket);
    const classification = parseAiOutput(classificationSchema, classifyRes.data, "classification");
    const priorityScore = computePriority(ticket.tier, classification.urgency);

    await db
      .update(tickets)
      .set({
        category: classification.category,
        urgency: classification.urgency,
        confidence: classification.confidence,
        triageReason: classification.reason,
        priorityScore,
        triagedAt: sql`now()`,
      })
      .where(eq(tickets.id, ticketId));

    await recordAudit(db, {
      ticketId,
      actorType: "ai",
      actor: classifyRes.model,
      action: "ai.classified",
      details: {
        category: classification.category,
        urgency: classification.urgency,
        confidence: classification.confidence,
        suspiciousInstructions: classification.suspicious_instructions,
        priorityScore,
        inputTokens: classifyRes.usage.inputTokens,
        outputTokens: classifyRes.usage.outputTokens,
        latencyMs: classifyRes.latencyMs,
      },
    });

    // 2. Independent checks that don't depend on the model's judgement.
    const reasons: ReviewReason[] = [];
    const injectionSignals = detectInjection(ticketText);
    if (classification.suspicious_instructions || injectionSignals.length > 0) {
      reasons.push("suspicious_instructions");
    }
    if (classification.confidence < config.minConfidence) reasons.push("low_confidence");

    // 3. Retrieve help articles (no AI). Matches are kept even for human-routed
    //    tickets so the agent can see related articles.
    const articles = await searchKnowledgeBase(db, ticketText, {
      category: classification.category,
      minScore: config.kbMinScore,
    });
    const kbMatches: KbMatch[] = articles.map((a) => ({
      articleId: a.id,
      slug: a.slug,
      title: a.title,
      score: a.score,
    }));
    await recordAudit(db, {
      ticketId,
      actorType: "system",
      actor: PIPELINE_ACTOR,
      action: "kb.searched",
      details: { matches: kbMatches, minScore: config.kbMinScore },
    });
    if (articles.length === 0) reasons.push("no_kb_match");

    if (reasons.length > 0) {
      return await routeToHuman(db, ticketId, reasons, kbMatches, { injectionSignals });
    }

    // 4. Draft a reply grounded only in the retrieved articles (AI).
    const draftRes = await ai.draftReply(
      promptTicket,
      articles.map(({ slug, title, body }) => ({ slug, title, body })),
    );
    const draft = parseAiOutput(draftOutputSchema, draftRes.data, "draft");

    // 5. Verify the draft before any human sees it.
    const retrievedSlugs = articles.map((a) => a.slug);
    const safety = checkDraftSafety(
      draft.reply,
      articles.map((a) => `${a.title}\n${a.body}`).join("\n"),
    );
    const draftProblems: ReviewReason[] = [];
    if (draft.insufficient_context || draft.reply.length === 0) draftProblems.push("insufficient_context");
    else if (!citationsAreValid(draft.cited_articles, retrievedSlugs)) draftProblems.push("invalid_citation");
    else if (!safety.ok) draftProblems.push("unsafe_draft");

    if (draftProblems.length > 0) {
      await recordAudit(db, {
        ticketId,
        actorType: "ai",
        actor: draftRes.model,
        action: "ai.draft_rejected",
        details: {
          reasons: draftProblems,
          citedArticles: draft.cited_articles,
          promiseViolations: safety.promiseViolations,
          unknownHosts: safety.unknownHosts,
          inputTokens: draftRes.usage.inputTokens,
          outputTokens: draftRes.usage.outputTokens,
        },
      });
      return await routeToHuman(db, ticketId, draftProblems, kbMatches, {});
    }

    // 6. Save the draft. The partial unique index means a concurrent run can
    //    never leave a second pending draft behind.
    const slugToId = new Map(articles.map((a) => [a.slug, a.id]));
    const citedIds = [...new Set(draft.cited_articles)].map((slug) => slugToId.get(slug)!);

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(drafts)
        .values({
          ticketId,
          aiBody: draft.reply,
          citedArticleIds: citedIds,
          provider: ai.name,
          model: draftRes.model,
          inputTokens: draftRes.usage.inputTokens,
          outputTokens: draftRes.usage.outputTokens,
          latencyMs: draftRes.latencyMs,
        })
        .onConflictDoNothing({ target: drafts.ticketId, where: sql`status = 'pending'` })
        .returning({ id: drafts.id });

      await tx
        .update(tickets)
        .set({ status: "draft_ready", reviewReasons: [], kbMatches, lastError: null, lockedAt: null, draftedAt: sql`now()` })
        .where(and(eq(tickets.id, ticketId), eq(tickets.status, "processing")));
      await enqueueTicketEvent(tx, ticketId, "ticket.triaged");

      await recordAudit(tx, {
        ticketId,
        actorType: "ai",
        actor: draftRes.model,
        action: row ? "ai.draft_created" : "ai.duplicate_draft_prevented",
        details: row
          ? {
              draftId: row.id,
              citedArticles: draft.cited_articles,
              inputTokens: draftRes.usage.inputTokens,
              outputTokens: draftRes.usage.outputTokens,
              latencyMs: draftRes.latencyMs,
            }
          : {},
      });
    });

    // Either way (new draft, or a concurrent run's draft already existed) the
    // ticket now has exactly one pending draft.
    return { outcome: "draft_ready", ticketId };
  } catch (err) {
    return handleFailure(db, ticket, err, config.maxAttempts);
  }
}

async function routeToHuman(
  db: Database,
  ticketId: string,
  reasons: ReviewReason[],
  kbMatches: KbMatch[],
  details: Record<string, unknown>,
): Promise<ProcessResult> {
  await db.transaction(async (tx) => {
    await finish(tx, ticketId, { status: "needs_review", reviewReasons: reasons, kbMatches, lastError: null });
    await recordAudit(tx, {
      ticketId,
      actorType: "system",
      actor: PIPELINE_ACTOR,
      action: "triage.routed_to_human",
      details: { reasons, ...details },
    });
    await enqueueTicketEvent(tx, ticketId, "ticket.triaged");
  });
  return { outcome: "needs_review", ticketId, reasons };
}

async function handleFailure(
  db: Database,
  ticket: Ticket,
  err: unknown,
  maxAttempts: number,
): Promise<ProcessResult> {
  const known = err instanceof AiServiceError;
  const message = known ? err.message : "An unexpected error occurred during triage.";
  // Full detail goes to server logs only; the stored message is safe to display.
  console.error(`[triage] ticket ${ticket.id} attempt ${ticket.attempts} failed:`, err);

  const exhausted = ticket.attempts >= maxAttempts;
  await finish(db, ticket.id, { status: exhausted ? "failed" : "queued", lastError: message });
  await recordAudit(db, {
    ticketId: ticket.id,
    actorType: "system",
    actor: PIPELINE_ACTOR,
    action: "ai.error",
    details: {
      message,
      kind: known ? err.kind : "unexpected",
      attempt: ticket.attempts,
      maxAttempts,
      nextStatus: exhausted ? "failed" : "queued",
    },
  });
  return { outcome: exhausted ? "failed" : "retry_scheduled", ticketId: ticket.id, error: message };
}

/**
 * Puts a failed (or stuck-queued) ticket back in the queue with a fresh set of
 * attempts. Returns false if the ticket isn't in a retryable state.
 */
export async function requeueTicket(db: Database, ticketId: string, actor: string): Promise<boolean> {
  const [row] = await db
    .update(tickets)
    // The previous error stays in the audit trail; clearing it here marks the
    // ticket as freshly queued (so the dashboard shows it as pending again).
    .set({ status: "queued", attempts: 0, lockedAt: null, lastError: null })
    .where(and(eq(tickets.id, ticketId), or(eq(tickets.status, "failed"), eq(tickets.status, "queued"))))
    .returning({ id: tickets.id });
  if (!row) return false;
  await recordAudit(db, {
    ticketId,
    actorType: actor === PIPELINE_ACTOR ? "system" : "agent",
    actor,
    action: "triage.retry_requested",
  });
  return true;
}

/** Processes waiting tickets one at a time (sequential keeps us inside AI rate limits). */
export async function processQueue(
  deps: PipelineDeps,
  opts: { limit: number },
): Promise<ProcessResult[]> {
  const waiting = await deps.db
    .select({ id: tickets.id })
    .from(tickets)
    .where(
      or(
        eq(tickets.status, "queued"),
        and(eq(tickets.status, "processing"), lt(tickets.lockedAt, STALE_LOCK)),
      ),
    )
    .orderBy(asc(tickets.createdAt))
    .limit(opts.limit);

  const results: ProcessResult[] = [];
  for (const { id } of waiting) {
    results.push(await processTicket(id, deps));
  }
  return results;
}
