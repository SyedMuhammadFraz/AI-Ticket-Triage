import { after } from "next/server";
import { getDb } from "@/lib/db";
import { getEnv, supportConfigured } from "@/lib/env";
import { syncPendingSupportTickets } from "@/lib/support/run";
import { verifyTriageSignature } from "@/lib/support/signature";
import { applyTriageEvent, triageEventSchema } from "@/lib/support/tickets";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Receives events from Triage Desk. Order of checks: size → signature (on the
 * raw body) → schema → apply exactly once. Only a 2xx tells Triage Desk to stop
 * retrying, so transient failures here are simply retried later.
 */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  if (!supportConfigured(env)) return new Response("Not found", { status: 404 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });

  if (!verifyTriageSignature(raw, request.headers.get("triage-signature"), env.TRIAGE_WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const event = triageEventSchema.safeParse(json);
  if (!event.success) return new Response("Unrecognised event", { status: 400 });

  const result = await applyTriageEvent(getDb(), event.data);
  // Triage Desk is clearly reachable right now — a good moment to retry any requests that didn't get through.
  after(() => syncPendingSupportTickets().then(() => undefined));
  return Response.json({ received: true, result }, { headers: { "Cache-Control": "no-store" } });
}
