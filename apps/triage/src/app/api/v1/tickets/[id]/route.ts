import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { messages, tickets } from "@/lib/db/schema";
import { apiError, apiJson, withApiAuth } from "@/lib/integrations/http";
import { serializeTicket } from "@/lib/integrations/webhooks";

/** GET /api/v1/tickets/:id — a client can only read tickets it created. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return withApiAuth(request, "tickets:read", async ({ client, db }) => {
    const id = z.uuid().safeParse((await params).id);
    if (!id.success) return apiError(404, "not_found", "Ticket not found.");

    const [ticket] = await db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id.data), eq(tickets.apiClientId, client.id)));
    if (!ticket) return apiError(404, "not_found", "Ticket not found.");

    const [message] = await db.select().from(messages).where(eq(messages.ticketId, ticket.id));
    return apiJson({
      ticket: serializeTicket(ticket),
      reply: message ? { body: message.body, sentBy: message.sentBy, sentAt: message.sentAt.toISOString() } : null,
    });
  });
}
