"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { endAgentSession, getAgentSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { tickets } from "@/lib/db/schema";
import { approveAndSend, escalateTicket, TicketActionError } from "@/lib/tickets/agent-actions";
import { agentReplySchema, escalationNoteSchema } from "@/lib/tickets/schema";
import { deliverWebhooksNow } from "@/lib/integrations/run";
import { processQueue, processTicket, requeueTicket } from "@/lib/triage/pipeline";
import { defaultPipelineDeps } from "@/lib/triage/run";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const ticketIdSchema = z.uuid({ error: "Unknown ticket." });

/**
 * Every dashboard action goes through here: the session is verified on each
 * call (never trusted from the page), and only user-safe messages leave the server.
 */
async function asAgent(run: (agent: string) => Promise<ActionResult>): Promise<ActionResult> {
  const session = await getAgentSession();
  if (!session) return { ok: false, error: "Your session has expired. Please sign in again." };
  try {
    return await run(session.name);
  } catch (err) {
    if (err instanceof TicketActionError) return { ok: false, error: err.message };
    console.error("[dashboard] action failed:", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

export async function approveReply(input: { ticketId: string; body: string }): Promise<ActionResult> {
  return asAgent(async (agent) => {
    const parsed = z.object({ ticketId: ticketIdSchema, body: agentReplySchema }).safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

    const { edited, manual } = await approveAndSend(getDb(), { ...parsed.data, agent });
    after(deliverWebhooksNow); // hand the approved reply to the host app right away
    refresh();
    return {
      ok: true,
      message: manual ? "Reply sent to the customer." : edited ? "Edited reply sent." : "Draft approved and sent.",
    };
  });
}

export async function escalate(input: { ticketId: string; note?: string }): Promise<ActionResult> {
  return asAgent(async (agent) => {
    const parsed = z
      .object({ ticketId: ticketIdSchema, note: escalationNoteSchema.optional() })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

    await escalateTicket(getDb(), { ticketId: parsed.data.ticketId, note: parsed.data.note ?? "", agent });
    after(deliverWebhooksNow);
    refresh();
    return { ok: true, message: "Ticket escalated." };
  });
}

/** Re-queues a failed or waiting ticket and triages it in the background. */
export async function runTriage(input: { ticketId: string }): Promise<ActionResult> {
  return asAgent(async (agent) => {
    const parsed = z.object({ ticketId: ticketIdSchema }).safeParse(input);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

    const ok = await requeueTicket(getDb(), parsed.data.ticketId, agent);
    if (!ok) return { ok: false, error: "This ticket isn't waiting for triage." };

    after(async () => {
      try {
        await processTicket(parsed.data.ticketId, defaultPipelineDeps());
      } catch (err) {
        console.error(`[dashboard] background triage crashed for ticket ${parsed.data.ticketId}:`, err);
      }
      await deliverWebhooksNow();
    });
    refresh();
    return { ok: true, message: "Triage started." };
  });
}

/** Triages everything in the queue in the background (handy after loading sample data). */
export async function triageAllQueued(): Promise<ActionResult> {
  return asAgent(async () => {
    const db = getDb();
    const waiting = await db.$count(tickets, eq(tickets.status, "queued"));
    if (waiting === 0) return { ok: false, error: "There are no queued tickets." };

    after(async () => {
      try {
        await processQueue(defaultPipelineDeps(), { limit: 25 });
      } catch (err) {
        console.error("[dashboard] background queue processing crashed:", err);
      }
      await deliverWebhooksNow();
    });
    refresh();
    return { ok: true, message: `Triaging ${waiting} queued ticket${waiting === 1 ? "" : "s"}…` };
  });
}

export async function signOut(): Promise<void> {
  await endAgentSession();
  redirect("/agent/sign-in");
}
