import { createHmac } from "node:crypto";
import { and, count, eq, gt, sql } from "drizzle-orm";
import type { TicketSource } from "@/lib/domain";
import type { Database } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { recordAudit } from "@/lib/audit";
import type { TicketInput } from "./schema";

export { sanitizeText, ticketInputSchema, type TicketInput } from "./schema";

export class RateLimitError extends Error {
  constructor() {
    super("Too many tickets submitted. Please wait a few minutes and try again.");
    this.name = "RateLimitError";
  }
}

/** Keyed hash of an IP address: lets us rate-limit without storing the IP. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export async function assertWithinRateLimit(
  db: Database,
  ipHash: string,
  limit: number,
  windowMinutes = 10,
): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(tickets)
    .where(
      and(
        eq(tickets.submitterIpHash, ipHash),
        gt(tickets.createdAt, sql`now() - make_interval(mins => ${windowMinutes})`),
      ),
    );
  if ((row?.n ?? 0) >= limit) throw new RateLimitError();
}

/** Saves a validated ticket as "queued" and records who submitted it. */
export async function createTicket(
  db: Database,
  input: TicketInput,
  meta: { source: TicketSource; ipHash?: string | null },
): Promise<{ id: string; number: number }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tickets)
      .values({
        subject: input.subject,
        body: input.body,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        tier: input.tier,
        source: meta.source,
        submitterIpHash: meta.ipHash ?? null,
      })
      .returning({ id: tickets.id, number: tickets.number });

    await recordAudit(tx, {
      ticketId: created.id,
      actorType: "customer",
      actor: "customer",
      action: "ticket.created",
      details: { source: meta.source, tier: input.tier },
    });

    return created;
  });
}
