import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { apiClients, apiRateLimits, type ApiClient } from "@/lib/db/schema";

export const API_SCOPES = ["tickets:write", "tickets:read", "kb:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const KEY_PATTERN = /^td_live_[A-Za-z0-9_-]{32,64}$/;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Creates a client and returns its key. The key is only ever available here — store it securely. */
export async function createApiClient(
  db: Database,
  { name, scopes }: { name: string; scopes: ApiScope[] },
): Promise<{ client: ApiClient; key: string }> {
  const key = `td_live_${randomBytes(32).toString("base64url")}`;
  const [client] = await db
    .insert(apiClients)
    .values({ name, scopes, keyPrefix: key.slice(0, 16), keyHash: hashApiKey(key) })
    .returning();
  return { client, key };
}

export type AuthResult =
  | { ok: true; client: ApiClient }
  | { ok: false; status: 401 | 403 | 429; code: string; message: string };

/**
 * Verifies `Authorization: Bearer <key>`, the scope, and the per-minute rate
 * limit. Unknown, malformed and revoked keys get the same 401 so callers can't
 * tell them apart.
 */
export async function authenticateApiKey(
  db: Database,
  authorization: string | null,
  scope: ApiScope,
  limitPerMinute: number,
): Promise<AuthResult> {
  const key = authorization?.match(/^Bearer\s+(\S+)$/)?.[1];
  const invalid = { ok: false as const, status: 401 as const, code: "unauthorized", message: "Missing or invalid API key." };
  if (!key || !KEY_PATTERN.test(key)) return invalid;

  const [client] = await db
    .select()
    .from(apiClients)
    .where(and(eq(apiClients.keyHash, hashApiKey(key)), isNull(apiClients.revokedAt)));
  if (!client) return invalid;

  // Every authenticated request counts towards the limit — including ones refused for scope.
  const [window] = await db
    .insert(apiRateLimits)
    .values({ clientId: client.id, windowStart: sql`date_trunc('minute', now())`, count: 1 })
    .onConflictDoUpdate({
      target: [apiRateLimits.clientId, apiRateLimits.windowStart],
      set: { count: sql`${apiRateLimits.count} + 1` },
    })
    .returning({ count: apiRateLimits.count });
  if (window.count > limitPerMinute) {
    return { ok: false, status: 429, code: "rate_limited", message: "Rate limit exceeded. Try again in a minute." };
  }

  if (!client.scopes.includes(scope)) {
    return { ok: false, status: 403, code: "forbidden", message: `This API key lacks the "${scope}" scope.` };
  }

  // Cheap bookkeeping: record use at most once a minute.
  await db
    .update(apiClients)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(apiClients.id, client.id), or(isNull(apiClients.lastUsedAt), lt(apiClients.lastUsedAt, sql`now() - interval '1 minute'`))));

  return { ok: true, client };
}

/** Housekeeping for the rate-limit table (called from the jobs endpoint). */
export async function pruneRateLimitWindows(db: Database): Promise<void> {
  await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, sql`now() - interval '1 hour'`));
}
