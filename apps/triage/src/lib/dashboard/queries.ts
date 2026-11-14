import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { MOCK_MODEL } from "@/lib/ai/mock";
import type { Database } from "@/lib/db";
import { auditEvents, drafts, kbArticles, messages, tickets } from "@/lib/db/schema";
import { QUEUE_FILTERS, TICKET_STATUSES, type QueueFilter, type TicketStatus } from "@/lib/domain";

/** Read-side queries for the agent dashboard. Callers must check the agent session first. */

export async function listQueue(db: Database, filter: QueueFilter, limit = 100) {
  const statuses = [...QUEUE_FILTERS[filter].statuses];
  const closed = filter === "sent" || filter === "escalated";
  return db
    .select({
      id: tickets.id,
      number: tickets.number,
      subject: tickets.subject,
      customerName: tickets.customerName,
      tier: tickets.tier,
      status: tickets.status,
      category: tickets.category,
      urgency: tickets.urgency,
      priorityScore: tickets.priorityScore,
      reviewReasons: tickets.reviewReasons,
      lastError: tickets.lastError,
      createdAt: tickets.createdAt,
    })
    .from(tickets)
    .where(inArray(tickets.status, statuses))
    .orderBy(
      ...(closed
        ? [desc(tickets.resolvedAt), desc(tickets.createdAt)]
        : [desc(tickets.priorityScore), asc(tickets.createdAt)]),
    )
    .limit(limit);
}
export type QueueItem = Awaited<ReturnType<typeof listQueue>>[number];

export async function countByStatus(db: Database): Promise<Record<TicketStatus, number>> {
  const rows = await db.select({ status: tickets.status, n: count() }).from(tickets).groupBy(tickets.status);
  const counts = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function getTicketDetail(db: Database, ticketId: string) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticket) return null;

  const [[draft], [message], events] = await Promise.all([
    db.select().from(drafts).where(eq(drafts.ticketId, ticketId)).orderBy(desc(drafts.createdAt)).limit(1),
    db.select().from(messages).where(eq(messages.ticketId, ticketId)).limit(1),
    db.select().from(auditEvents).where(eq(auditEvents.ticketId, ticketId)).orderBy(asc(auditEvents.createdAt)),
  ]);

  const articleIds = [
    ...new Set([...(draft?.citedArticleIds ?? []), ...ticket.kbMatches.map((m) => m.articleId)]),
  ];
  const articles = articleIds.length
    ? await db
        .select({ id: kbArticles.id, slug: kbArticles.slug, title: kbArticles.title, body: kbArticles.body })
        .from(kbArticles)
        .where(inArray(kbArticles.id, articleIds))
    : [];

  return { ticket, draft: draft ?? null, message: message ?? null, articles, events };
}
export type TicketDetail = NonNullable<Awaited<ReturnType<typeof getTicketDetail>>>;

export type DashboardStats = {
  triaged: number;
  waiting: number;
  /** Tickets queued in the last 2 minutes without an error — i.e. about to be triaged. */
  freshQueued: number;
  routedToHuman: number;
  avgSecondsToDraft: number | null;
  sentFromDraft: number;
  sentUnedited: number;
  ai: { tickets: number; inputTokens: number; outputTokens: number; model: string | null };
};

const AI_USAGE_ACTIONS = ["ai.classified", "ai.draft_created", "ai.draft_rejected"];

export async function getDashboardStats(db: Database): Promise<DashboardStats> {
  const realAi = and(inArray(auditEvents.action, AI_USAGE_ACTIONS), ne(auditEvents.actor, MOCK_MODEL));

  const [[t], [m], [u], [latest]] = await Promise.all([
    db
      .select({
        triaged: sql<number>`count(*) filter (where ${tickets.triagedAt} is not null)`.mapWith(Number),
        waiting: sql<number>`count(*) filter (where ${tickets.status} in ('queued', 'processing'))`.mapWith(Number),
        freshQueued: sql<number>`count(*) filter (where ${tickets.status} = 'queued' and ${tickets.lastError} is null and ${tickets.updatedAt} > now() - interval '2 minutes')`.mapWith(
          Number,
        ),
        routed: sql<number>`count(*) filter (where ${tickets.triagedAt} is not null and (cardinality(${tickets.reviewReasons}) > 0 or ${tickets.status} = 'escalated'))`.mapWith(
          Number,
        ),
        avgSeconds: sql<string | null>`avg(extract(epoch from (${tickets.draftedAt} - ${tickets.triageStartedAt}))) filter (where ${tickets.draftedAt} is not null and ${tickets.triageStartedAt} is not null)`,
      })
      .from(tickets),
    db
      .select({
        fromDraft: sql<number>`count(*) filter (where ${messages.draftId} is not null)`.mapWith(Number),
        unedited: sql<number>`count(*) filter (where ${messages.draftId} is not null and not ${messages.wasEdited})`.mapWith(
          Number,
        ),
      })
      .from(messages),
    db
      .select({
        tickets: sql<number>`count(distinct ${auditEvents.ticketId})`.mapWith(Number),
        input: sql<number>`coalesce(sum((${auditEvents.details} ->> 'inputTokens')::int), 0)`.mapWith(Number),
        output: sql<number>`coalesce(sum((${auditEvents.details} ->> 'outputTokens')::int), 0)`.mapWith(Number),
      })
      .from(auditEvents)
      .where(realAi),
    db.select({ model: auditEvents.actor }).from(auditEvents).where(realAi).orderBy(desc(auditEvents.createdAt)).limit(1),
  ]);

  return {
    triaged: t.triaged,
    waiting: t.waiting,
    freshQueued: t.freshQueued,
    routedToHuman: t.routed,
    avgSecondsToDraft: t.avgSeconds === null ? null : Number(t.avgSeconds),
    sentFromDraft: m.fromDraft,
    sentUnedited: m.unedited,
    ai: { tickets: u.tickets, inputTokens: u.input, outputTokens: u.output, model: latest?.model ?? null },
  };
}
