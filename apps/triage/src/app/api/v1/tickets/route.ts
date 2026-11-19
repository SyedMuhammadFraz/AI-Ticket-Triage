import { after } from "next/server";
import { createTicketFromApi, apiCreateTicketSchema, IdempotencyConflictError } from "@/lib/integrations/api-tickets";
import { apiError, apiJson, readJson, validationError, withApiAuth } from "@/lib/integrations/http";
import { deliverWebhooksNow } from "@/lib/integrations/run";
import { serializeTicket } from "@/lib/integrations/webhooks";
import { processTicket } from "@/lib/triage/pipeline";
import { defaultPipelineDeps } from "@/lib/triage/run";

/**
 * POST /api/v1/tickets — a host app files a ticket on behalf of its customer.
 * Returns 201 (created) or 200 (same externalId re-sent). Triage runs in the
 * background; results arrive by webhook or via GET /api/v1/tickets/:id.
 */
export async function POST(request: Request): Promise<Response> {
  return withApiAuth(request, "tickets:write", async ({ client, db }) => {
    const parsed = apiCreateTicketSchema.safeParse(await readJson(request));
    if (!parsed.success) return validationError(parsed.error);

    try {
      const { ticket, created } = await createTicketFromApi(db, client, parsed.data);
      if (created) {
        after(async () => {
          try {
            await processTicket(ticket.id, defaultPipelineDeps());
          } catch (err) {
            console.error(`[api] background triage crashed for ticket ${ticket.id}:`, err);
          }
          await deliverWebhooksNow();
        });
      }
      return apiJson({ ticket: serializeTicket(ticket) }, created ? 201 : 200);
    } catch (err) {
      if (err instanceof IdempotencyConflictError) return apiError(409, "conflict", err.message);
      throw err;
    }
  });
}
