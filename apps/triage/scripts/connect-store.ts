/**
 * Connects the Fernway Office Supply store (apps/store) to Triage Desk:
 *  1. creates an API client for the store (scopes: tickets:write, tickets:read, kb:read),
 *  2. registers the store's webhook endpoint,
 *  3. writes TRIAGE_API_URL / TRIAGE_API_KEY / TRIAGE_WEBHOOK_SECRET into apps/store/.env.local.
 *
 * Re-running revokes the previous store key and endpoint and issues new ones.
 *   npm run integration:connect-store [-- --store-url=http://localhost:3000 --triage-url=http://localhost:3001]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { closeDb, getDb } from "@/lib/db";
import { apiClients, webhookEndpoints } from "@/lib/db/schema";
import { allowPrivateWebhooks, getEnv } from "@/lib/env";
import { createApiClient } from "@/lib/integrations/api-keys";
import { createWebhookEndpoint, WEBHOOK_EVENTS } from "@/lib/integrations/webhooks";

const CLIENT_NAME = "Fernway Office Supply store";

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
}

/** Sets KEY=value lines in a dotenv file, replacing existing ones and keeping everything else. */
function upsertEnv(file: string, values: Record<string, string>): void {
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  const remaining = new Map(Object.entries(values));
  const updated = lines.map((line) => {
    const key = line.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
    if (key && remaining.has(key)) {
      const value = remaining.get(key)!;
      remaining.delete(key);
      return `${key}=${value}`;
    }
    return line;
  });
  if (remaining.size) {
    if (updated.length && updated[updated.length - 1] !== "") updated.push("");
    updated.push("# Triage Desk integration (written by npm run integration:connect-store)");
    for (const [k, v] of remaining) updated.push(`${k}=${v}`);
  }
  writeFileSync(file, updated.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
}

async function main() {
  const env = getEnv();
  const db = getDb();
  const storeUrl = arg("store-url", "http://localhost:3000").replace(/\/$/, "");
  const triageUrl = arg("triage-url", "http://localhost:3001").replace(/\/$/, "");

  // Revoke earlier store credentials so only one live key exists.
  const old = await db
    .update(apiClients)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(apiClients.name, CLIENT_NAME), isNull(apiClients.revokedAt)))
    .returning({ id: apiClients.id });
  for (const o of old) {
    await db.update(webhookEndpoints).set({ active: false }).where(eq(webhookEndpoints.apiClientId, o.id));
  }

  const { client, key } = await createApiClient(db, { name: CLIENT_NAME, scopes: ["tickets:write", "tickets:read", "kb:read"] });
  const { secret } = await createWebhookEndpoint(db, {
    apiClientId: client.id,
    url: `${storeUrl}/api/webhooks/triage`,
    events: [...WEBHOOK_EVENTS],
    appSecret: env.APP_SECRET,
    allowPrivateNetwork: allowPrivateWebhooks(env),
  });

  const storeEnv = path.resolve(process.cwd(), "../store/.env.local");
  upsertEnv(storeEnv, { TRIAGE_API_URL: triageUrl, TRIAGE_API_KEY: key, TRIAGE_WEBHOOK_SECRET: secret });

  console.log(`✓ API client "${CLIENT_NAME}" created (key ${client.keyPrefix}…)${old.length ? `; ${old.length} older key(s) revoked` : ""}`);
  console.log(`✓ Webhook endpoint registered: ${storeUrl}/api/webhooks/triage (${WEBHOOK_EVENTS.join(", ")})`);
  console.log(`✓ Credentials written to ${path.relative(path.resolve(process.cwd(), "../.."), storeEnv)} (the key and secret aren't shown again)`);
  console.log("  Restart the store so it picks up the new settings.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
