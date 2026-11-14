/**
 * Triages every queued ticket with the configured AI provider.
 *   npm run queue:process [-- --limit=50]
 */
import { closeDb } from "@/lib/db";
import { deliverWebhooksNow } from "@/lib/integrations/run";
import { processQueue } from "@/lib/triage/pipeline";
import { defaultPipelineDeps } from "@/lib/triage/run";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = Math.min(Math.max(Number(limitArg?.split("=")[1] ?? 50) || 50, 1), 500);

  const deps = defaultPipelineDeps();
  console.log(`Processing up to ${limit} queued tickets with ${deps.ai.name} (${deps.ai.model})…`);

  const results = await processQueue(deps, { limit });
  await deliverWebhooksNow();
  if (results.length === 0) {
    console.log("Queue is empty.");
    return;
  }
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Done:", counts);
  console.log("Run `npm run triage:status` to see each ticket.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
