import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import type { Database } from "@/lib/db";
import { tickets, type ApiClient, type Ticket } from "@/lib/db/schema";
import { MAX_CONTEXT_BYTES, ticketContextSchema } from "@/lib/tickets/context";
import { ticketInputSchema } from "@/lib/tickets/schema";

export const apiCreateTicketSchema = ticketInputSchema
  .extend({
    /** The host app's own ticket id. Re-sending the same id returns the same ticket. */
    externalId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9._:-]+$/, { error: "externalId may contain letters, digits and . _ : -" }),
    context: ticketContextSchema.optional(),
  })
  .strict()
  .refine((v) => !v.context || JSON.stringify(v.context).length <= MAX_CONTEXT_BYTES, {
    error: `context must be at most ${MAX_CONTEXT_BYTES} bytes`,
    path: ["context"],
  });

export type ApiCreateTicket = z.infer<typeof apiCreateTicketSchema>;

export class IdempotencyConflictError extends Error {
  constructor() {
    super("A ticket with this externalId already exists with different content.");
    this.name = "IdempotencyConflictError";
  }
}

/**
 * Creates a ticket for an API client. Idempotent on (client, externalId): a
 * retry with the same content returns the existing ticket; the same id with
 * different content is a conflict rather than a silent overwrite.
 */
export async function createTicketFromApi(
  db: Database,
  client: ApiClient,
  input: ApiCreateTicket,
): Promise<{ ticket: Ticket; created: boolean }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tickets)
      .values({
        subject: input.subject,
        body: input.body,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        tier: input.tier,
        source: "api",
        apiClientId: client.id,
        externalId: input.externalId,
        context: input.context ?? null,
      })
      .onConflictDoNothing({ target: [tickets.apiClientId, tickets.externalId] })
      .returning();

    if (created) {
      await recordAudit(tx, {
        ticketId: created.id,
        actorType: "system",
        actor: `api:${client.keyPrefix}`,
        action: "ticket.created",
        details: { source: "api", client: client.name, externalId: input.externalId, hasContext: Boolean(input.context) },
      });
      return { ticket: created, created: true };
    }

    const [existing] = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.apiClientId, client.id), eq(tickets.externalId, input.externalId)));
    if (!existing || existing.subject !== input.subject || existing.body !== input.body) {
      throw new IdempotencyConflictError();
    }
    return { ticket: existing, created: false };
  });
}
