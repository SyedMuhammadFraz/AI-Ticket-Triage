"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { clientIp } from "@/lib/request";
import {
  RateLimitError,
  assertWithinRateLimit,
  createTicket,
  hashIp,
  ticketInputSchema,
} from "@/lib/tickets/intake";
import { processTicket } from "@/lib/triage/pipeline";
import { defaultPipelineDeps } from "@/lib/triage/run";
import { TICKET_FIELDS, type SubmitState } from "./form-state";

/**
 * Public, unauthenticated endpoint: everything from the client is untrusted.
 * Server Actions are POST-only and Next.js rejects cross-origin calls, which
 * covers CSRF; we add validation, a honeypot and per-IP rate limiting.
 */
export async function submitTicket(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  // Honeypot: real users never see this field. Pretend success so bots learn nothing.
  if (formData.get("website")) {
    return { status: "success", ticketNumber: null };
  }

  const raw = Object.fromEntries(TICKET_FIELDS.map((f) => [f, formData.get(f) ?? undefined]));
  const parsed = ticketInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const env = getEnv();
    const db = getDb();
    const ipHash = hashIp(clientIp(await headers()), env.APP_SECRET);
    await assertWithinRateLimit(db, ipHash, env.SUBMISSION_RATE_LIMIT);

    const ticket = await createTicket(db, parsed.data, { source: "web_form", ipHash });

    // Triage runs after the response is sent, so the customer isn't kept waiting.
    // If it fails, the ticket stays queued and can be retried — nothing is lost.
    after(async () => {
      try {
        await processTicket(ticket.id, defaultPipelineDeps());
      } catch (err) {
        console.error(`[submit] background triage crashed for ticket ${ticket.id}:`, err);
      }
    });

    return { status: "success", ticketNumber: ticket.number };
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { status: "error", message: err.message };
    }
    console.error("[submit] could not save ticket:", err);
    return {
      status: "error",
      message: "Something went wrong on our side and your ticket wasn't saved. Please try again in a moment.",
    };
  }
}
