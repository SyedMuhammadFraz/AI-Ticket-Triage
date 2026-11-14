import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { pruneRateLimitWindows } from "@/lib/integrations/api-keys";
import { deliverWebhooksNow } from "@/lib/integrations/run";
import { processQueue } from "@/lib/triage/pipeline";
import { defaultPipelineDeps } from "@/lib/triage/run";

/**
 * Processes queued tickets (including ones whose earlier attempt failed).
 * Intended for a scheduler such as Vercel Cron, which sends
 * `Authorization: Bearer $CRON_SECRET`. Disabled when CRON_SECRET is unset.
 */
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function handle(request: Request): Promise<Response> {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (!authorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  const results = await processQueue(defaultPipelineDeps(), { limit: 10 });
  await deliverWebhooksNow(); // also retries earlier failed deliveries that are now due
  await pruneRateLimitWindows(getDb());
  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});
  return Response.json({ processed: results.length, summary }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle; // Vercel Cron uses GET
export const POST = handle;
