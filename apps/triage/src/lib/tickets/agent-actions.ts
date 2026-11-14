import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { recordAudit } from "@/lib/audit";
import type { Database } from "@/lib/db";
import { drafts, messages, tickets } from "@/lib/db/schema";
import type { TicketStatus } from "@/lib/domain";
import { enqueueTicketEvent, replyPayload } from "@/lib/integrations/webhooks";

/** An agent action that can't be applied. `message` is safe to show in the UI. */
export class TicketActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketActionError";
  }
}

/**
 * A reply can be sent for a reviewed ticket, and also by hand while the AI is
 * failing (queued/failed) so an outage never blocks the support team. A ticket
 * that's mid-triage ("processing") can't be sent until the run finishes.
 */
const SENDABLE: TicketStatus[] = ["draft_ready", "needs_review", "queued", "failed"];
const ESCALATABLE: TicketStatus[] = ["draft_ready", "needs_review", "failed", "queued"];

/** Treats whitespace-only differences as "not edited". */
function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The ONLY way a reply reaches a customer (sending is simulated by saving the
 * message). Runs in one transaction and only succeeds if the ticket is still
 * sendable, so double clicks or two agents racing can't send twice — and the
 * unique index on messages(ticket_id) backs that up.
 */
export async function approveAndSend(
  db: Database,
  { ticketId, body, agent }: { ticketId: string; body: string; agent: string },
): Promise<{ edited: boolean; manual: boolean }> {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(drafts)
      .where(and(eq(drafts.ticketId, ticketId), eq(drafts.status, "pending")))
      .orderBy(desc(drafts.createdAt))
      .limit(1);

    const [ticket] = await tx
      .update(tickets)
      .set({ status: "sent", resolvedAt: sql`now()` })
      .where(and(eq(tickets.id, ticketId), inArray(tickets.status, SENDABLE)))
      .returning({ id: tickets.id });
    if (!ticket) {
      throw new TicketActionError("This ticket has already been handled or isn't ready to send.");
    }

    const edited = draft ? normalise(body) !== normalise(draft.aiBody) : false;
    if (draft) {
      await tx
        .update(drafts)
        .set({ status: "approved", finalBody: edited ? body : null, approvedBy: agent, approvedAt: sql`now()` })
        .where(eq(drafts.id, draft.id));
    }

    await tx.insert(messages).values({
      ticketId,
      draftId: draft?.id ?? null,
      body,
      wasEdited: edited,
      sentBy: agent,
    });

    await recordAudit(tx, {
      ticketId,
      actorType: "agent",
      actor: agent,
      action: "agent.approved",
      details: { draftId: draft?.id ?? null, edited, manual: !draft, characters: body.length },
    });
    // Same transaction: the host app hears about the reply if and only if it was approved.
    await enqueueTicketEvent(tx, ticketId, "ticket.reply_approved", await replyPayload(tx, ticketId));

    return { edited, manual: !draft };
  });
}

/** Hands the ticket to a senior team. Any pending AI draft is discarded so it can't be sent later. */
export async function escalateTicket(
  db: Database,
  { ticketId, note, agent }: { ticketId: string; note: string; agent: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [ticket] = await tx
      .update(tickets)
      .set({ status: "escalated", resolvedAt: sql`now()`, lockedAt: null })
      .where(and(eq(tickets.id, ticketId), inArray(tickets.status, ESCALATABLE)))
      .returning({ id: tickets.id });
    if (!ticket) {
      throw new TicketActionError("This ticket can't be escalated in its current state.");
    }

    await tx
      .update(drafts)
      .set({ status: "discarded" })
      .where(and(eq(drafts.ticketId, ticketId), eq(drafts.status, "pending")));

    await recordAudit(tx, {
      ticketId,
      actorType: "agent",
      actor: agent,
      action: "agent.escalated",
      details: { note: note || null },
    });
    // The internal note stays internal: the host only learns the new status.
    await enqueueTicketEvent(tx, ticketId, "ticket.escalated");
  });
}
