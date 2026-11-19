import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { orders, supportTickets, users, webhookReceipts, type Company, type SupportTicket } from "@/lib/db/schema";
import {
  formatOrderNumber,
  formatSupportNumber,
  SUPPORT_LIMITS,
  TIER_LABELS,
  TRIAGE_TIER,
  type SupportStatus,
} from "@/lib/domain";
import { getCompanyOrder, type CompanyOrder } from "@/lib/orders";

/** A support problem that's safe to show to the buyer. */
export class SupportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportError";
  }
}

function sanitize(v: unknown): unknown {
  return typeof v === "string"
    ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").trim()
    : v;
}

export const supportRequestSchema = z.object({
  orderNumber: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  subject: z.preprocess(
    sanitize,
    z
      .string({ error: "Subject is required" })
      .min(SUPPORT_LIMITS.subject.min, { error: `Subject must be at least ${SUPPORT_LIMITS.subject.min} characters` })
      .max(SUPPORT_LIMITS.subject.max),
  ),
  body: z.preprocess(
    sanitize,
    z
      .string({ error: "Message is required" })
      .min(SUPPORT_LIMITS.body.min, { error: `Please describe the problem in at least ${SUPPORT_LIMITS.body.min} characters` })
      .max(SUPPORT_LIMITS.body.max),
  ),
});
export type SupportRequest = z.infer<typeof supportRequestSchema>;

type Buyer = { id: string; name: string; email: string; company: Company };

/**
 * Saves the request locally first, so it can't be lost if Triage Desk is down.
 * The order must belong to the buyer's company.
 */
export async function createSupportTicket(db: Database, buyer: Buyer, input: SupportRequest): Promise<SupportTicket> {
  const [recent] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, buyer.id), gt(supportTickets.createdAt, sql`now() - interval '1 hour'`)));
  if ((recent?.n ?? 0) >= SUPPORT_LIMITS.perUserPerHour) {
    throw new SupportError("You've sent several requests in the last hour. Please wait a little before sending another.");
  }

  let orderId: string | null = null;
  if (input.orderNumber) {
    const order = await getCompanyOrder(db, buyer.company.id, input.orderNumber);
    if (!order) throw new SupportError("We couldn't find that order on your account.");
    orderId = order.order.id;
  }

  const [row] = await db
    .insert(supportTickets)
    .values({ userId: buyer.id, companyId: buyer.company.id, orderId, subject: input.subject, body: input.body })
    .returning();
  return row;
}

/** The order and company facts Triage Desk receives with the ticket (so the AI and the agent see them). */
export function buildTicketContext(company: Company, order: CompanyOrder | null) {
  return {
    company: {
      name: company.name,
      tierLabel: TIER_LABELS[company.tier],
      accountManager: company.accountManager,
      employees: company.employees,
    },
    ...(order && {
      order: {
        number: formatOrderNumber(order.order.number),
        status: order.order.status,
        placedAt: order.order.placedAt.toISOString(),
        estimatedDelivery: order.order.estimatedDelivery?.toISOString() ?? null,
        poNumber: order.order.poNumber,
        paymentMethod: order.order.paymentMethod === "invoice" ? "Invoice (Net 30)" : "Card",
        totalCents: order.order.totalCents,
        carrier: order.order.carrier,
        trackingNumber: order.order.trackingNumber,
        items: order.items.map(({ item }) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          quantityDelivered: item.quantityDelivered,
        })),
        events: order.events.slice(-12).map((e) => ({ kind: e.kind, note: e.note, at: e.at.toISOString() })),
      },
    }),
  };
}

export type RemoteCreate = (input: {
  externalId: string;
  customerName: string;
  customerEmail: string;
  tier: "free" | "pro" | "enterprise";
  subject: string;
  body: string;
  context?: unknown;
}) => Promise<{ id: string; number: number; status: string }>;

/**
 * Sends a locally saved request to Triage Desk. Idempotent: the store's
 * reference (SR-7001) is the externalId, so retrying never creates duplicates.
 * Failures are recorded and retried later; the buyer still sees "Received".
 */
export async function syncSupportTicket(
  db: Database,
  ticketId: string,
  deps: { createRemote: RemoteCreate; company: Company; buyer: { name: string; email: string } },
): Promise<boolean> {
  const [t] = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId));
  if (!t || t.triageTicketId) return Boolean(t?.triageTicketId);

  const order = t.orderId ? await orderForTicket(db, t) : null;
  try {
    const remote = await deps.createRemote({
      externalId: formatSupportNumber(t.number),
      customerName: deps.buyer.name,
      customerEmail: deps.buyer.email,
      tier: TRIAGE_TIER[deps.company.tier],
      subject: t.subject,
      body: t.body,
      context: buildTicketContext(deps.company, order),
    });
    await db
      .update(supportTickets)
      .set({
        triageTicketId: remote.id,
        triageNumber: remote.number,
        status: sql`case when ${supportTickets.status} = 'submitted' then 'received'::support_status else ${supportTickets.status} end`,
        lastSyncError: null,
        syncAttempts: sql`${supportTickets.syncAttempts} + 1`,
      })
      .where(eq(supportTickets.id, t.id));
    return true;
  } catch (err) {
    await db
      .update(supportTickets)
      .set({
        lastSyncError: err instanceof Error ? err.message.slice(0, 300) : "Sync failed",
        syncAttempts: sql`${supportTickets.syncAttempts} + 1`,
      })
      .where(eq(supportTickets.id, t.id));
    return false;
  }
}

async function orderForTicket(db: Database, t: SupportTicket): Promise<CompanyOrder | null> {
  if (!t.orderId) return null;
  const [row] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, t.orderId));
  return row ? getCompanyOrder(db, t.companyId, row.number) : null;
}

/** Requests that never reached Triage Desk (e.g. it was down), oldest first. */
export async function pendingSyncTickets(db: Database, limit = 20) {
  return db
    .select({ ticket: supportTickets, buyerName: users.name, buyerEmail: users.email })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id))
    .where(and(isNull(supportTickets.triageTicketId), lt(supportTickets.syncAttempts, 50)))
    .orderBy(supportTickets.createdAt)
    .limit(limit);
}

export async function listBuyerTickets(db: Database, userId: string) {
  return db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt));
}

export async function countUnreadReplies(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, userId), eq(supportTickets.status, "answered"), isNull(supportTickets.replySeenAt)));
  return row?.n ?? 0;
}

/** A buyer can only open their own requests; anything else is "not found". */
export async function getBuyerTicket(db: Database, userId: string, number: number) {
  const [t] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.userId, userId), eq(supportTickets.number, number)));
  return t ?? null;
}

export async function markReplySeen(db: Database, ticketId: string): Promise<void> {
  await db
    .update(supportTickets)
    .set({ replySeenAt: sql`now()` })
    .where(and(eq(supportTickets.id, ticketId), isNull(supportTickets.replySeenAt)));
}

// ── Webhook events from Triage Desk ───────────────────────────────────────────

export const triageEventSchema = z.object({
  id: z.uuid(),
  type: z.enum(["ticket.triaged", "ticket.reply_approved", "ticket.escalated"]),
  createdAt: z.string(),
  data: z.object({
    ticket: z.object({ id: z.uuid(), externalId: z.string().nullable(), status: z.string() }),
    reply: z
      .object({ body: z.string().max(10_000), sentBy: z.string().max(120), sentAt: z.string() })
      .optional(),
  }),
});
export type TriageEvent = z.infer<typeof triageEventSchema>;

const RANK: Record<SupportStatus, number> = { submitted: 0, received: 1, in_review: 2, answered: 3, escalated: 3 };

/**
 * Applies one event, exactly once (the receipt insert and the update share a
 * transaction), and only ever moves a request forward — a late "triaged" can't
 * undo an "answered".
 */
export async function applyTriageEvent(db: Database, event: TriageEvent): Promise<"applied" | "duplicate" | "ignored"> {
  return db.transaction(async (tx) => {
    const [receipt] = await tx
      .insert(webhookReceipts)
      .values({ eventId: event.id, type: event.type })
      .onConflictDoNothing()
      .returning();
    if (!receipt) return "duplicate";

    const [t] = await tx
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.triageTicketId, event.data.ticket.id));
    if (!t) return "ignored";

    const next: SupportStatus =
      event.type === "ticket.reply_approved" ? "answered" : event.type === "ticket.escalated" ? "escalated" : "in_review";
    if (RANK[next] <= RANK[t.status]) return "ignored";

    if (next === "answered") {
      const reply = event.data.reply;
      if (!reply) return "ignored";
      await tx
        .update(supportTickets)
        .set({ status: "answered", replyBody: reply.body, repliedBy: reply.sentBy, repliedAt: new Date(reply.sentAt) })
        .where(eq(supportTickets.id, t.id));
    } else {
      await tx.update(supportTickets).set({ status: next }).where(eq(supportTickets.id, t.id));
    }
    return "applied";
  });
}
