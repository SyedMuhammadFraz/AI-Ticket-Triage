import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import type { Database, DbExecutor } from "@/lib/db";
import { messages, tickets, webhookDeliveries, webhookEndpoints, type Ticket } from "@/lib/db/schema";
import { assertAllowedUrl, postJson } from "./outbound";

export const WEBHOOK_EVENTS = ["ticket.triaged", "ticket.reply_approved", "ticket.escalated"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

/** Retry schedule after each failed attempt (seconds). After the last one the delivery is dead-lettered. */
export const BACKOFF_SECONDS = [30, 120, 600, 1800, 7200, 21600];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;

/** Public, stable view of a ticket shared with host apps (API responses and webhook payloads). */
export function serializeTicket(t: Ticket) {
  return {
    id: t.id,
    number: t.number,
    externalId: t.externalId,
    status: t.status,
    category: t.category,
    urgency: t.urgency,
    priorityScore: t.priorityScore,
    reviewReasons: t.reviewReasons,
    createdAt: t.createdAt.toISOString(),
    triagedAt: t.triagedAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
  };
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Registers an endpoint and returns its signing secret (shown once; stored encrypted). */
export async function createWebhookEndpoint(
  db: Database,
  input: { apiClientId: string; url: string; events: WebhookEventType[]; appSecret: string; allowPrivateNetwork: boolean },
): Promise<{ id: string; secret: string }> {
  assertAllowedUrl(input.url, input.allowPrivateNetwork);
  const secret = `whsec_${randomBytes(32).toString("base64url")}`;
  const [row] = await db
    .insert(webhookEndpoints)
    .values({
      apiClientId: input.apiClientId,
      url: input.url,
      events: input.events,
      secretCiphertext: sealSecret(secret, input.appSecret),
    })
    .returning({ id: webhookEndpoints.id });
  return { id: row.id, secret };
}

/**
 * Writes an event to the outbox for every subscribed endpoint of the ticket's
 * API client. Call it inside the same transaction as the state change, so an
 * event exists if and only if the change committed. Tickets that didn't come
 * through the API have no client and produce no events.
 */
export async function enqueueTicketEvent(
  tx: DbExecutor,
  ticketId: string,
  type: WebhookEventType,
  extra: Record<string, unknown> = {},
): Promise<number> {
  const [ticket] = await tx.select().from(tickets).where(eq(tickets.id, ticketId));
  if (!ticket?.apiClientId) return 0;

  const endpoints = await tx
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.apiClientId, ticket.apiClientId),
        eq(webhookEndpoints.active, true),
        sql`${type} = any(${webhookEndpoints.events})`,
      ),
    );
  if (endpoints.length === 0) return 0;

  const createdAt = new Date().toISOString();
  await tx.insert(webhookDeliveries).values(
    endpoints.map((e) => {
      const id = randomUUID();
      return {
        id,
        endpointId: e.id,
        ticketId,
        eventType: type,
        payload: { id, type, createdAt, data: { ticket: serializeTicket(ticket), ...extra } },
      };
    }),
  );
  return endpoints.length;
}

/** The approved reply as it was sent, for the `ticket.reply_approved` event. */
export async function replyPayload(tx: DbExecutor, ticketId: string) {
  const [m] = await tx.select().from(messages).where(eq(messages.ticketId, ticketId));
  return m ? { reply: { body: m.body, sentBy: m.sentBy, sentAt: m.sentAt.toISOString(), edited: m.wasEdited } } : {};
}

export type DeliveryOptions = {
  appSecret: string;
  allowPrivateNetwork: boolean;
  limit?: number;
  timeoutMs?: number;
  /** Injected in tests. */
  post?: typeof postJson;
};

/**
 * Delivers due outbox events. Each batch is claimed atomically (SKIP LOCKED), so
 * concurrent runners never send the same event twice at the same time; a crashed
 * runner's claim simply expires and the event is retried.
 */
export async function deliverDueWebhooks(db: Database, opts: DeliveryOptions): Promise<{ delivered: number; failed: number }> {
  const post = opts.post ?? postJson;
  const due = db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "pending"), lte(webhookDeliveries.nextAttemptAt, sql`now()`)))
    .orderBy(asc(webhookDeliveries.createdAt))
    .limit(opts.limit ?? 20)
    .for("update", { skipLocked: true });

  const claimed = await db
    .update(webhookDeliveries)
    .set({ nextAttemptAt: sql`now() + interval '2 minutes'` })
    .where(inArray(webhookDeliveries.id, due))
    .returning();

  let delivered = 0;
  let failed = 0;
  for (const d of claimed) {
    const [endpoint] = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId));
    const attempt = d.attempts + 1;
    let statusCode: number | null = null;
    let error: string | null = null;

    if (!endpoint?.active) {
      error = "Endpoint is inactive";
    } else {
      try {
        const body = JSON.stringify(d.payload);
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = signWebhook(openSecret(endpoint.secretCiphertext, opts.appSecret), timestamp, body);
        const res = await post(
          endpoint.url,
          body,
          {
            "user-agent": "TriageDesk-Webhooks/1.0",
            "triage-event-id": d.id,
            "triage-event-type": d.eventType,
            "triage-signature": `t=${timestamp},v1=${signature}`,
          },
          { allowPrivateNetwork: opts.allowPrivateNetwork, timeoutMs: opts.timeoutMs ?? 10_000 },
        );
        statusCode = res.status;
        if (res.status < 200 || res.status >= 300) error = `Receiver responded with HTTP ${res.status}`;
      } catch (err) {
        error = err instanceof Error ? err.message.slice(0, 300) : "Delivery failed";
      }
    }

    if (!error) {
      delivered += 1;
      await db
        .update(webhookDeliveries)
        .set({ status: "delivered", attempts: attempt, deliveredAt: sql`now()`, lastStatusCode: statusCode, lastError: null })
        .where(eq(webhookDeliveries.id, d.id));
    } else {
      failed += 1;
      const dead = attempt >= MAX_ATTEMPTS;
      await db
        .update(webhookDeliveries)
        .set({
          status: dead ? "dead" : "pending",
          attempts: attempt,
          lastError: error,
          lastStatusCode: statusCode,
          nextAttemptAt: dead ? sql`now()` : sql`now() + make_interval(secs => ${BACKOFF_SECONDS[attempt - 1]})`,
        })
        .where(eq(webhookDeliveries.id, d.id));
    }
  }
  return { delivered, failed };
}
