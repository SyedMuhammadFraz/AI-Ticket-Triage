import http from "node:http";
import type { AddressInfo } from "node:net";
import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_TICKETS } from "../data/seed-tickets";
import { MockProvider } from "@/lib/ai/mock";
import type { Database } from "@/lib/db";
import { apiClients, drafts, webhookDeliveries, type ApiClient } from "@/lib/db/schema";
import { authenticateApiKey, createApiClient } from "@/lib/integrations/api-keys";
import { apiCreateTicketSchema, createTicketFromApi, IdempotencyConflictError } from "@/lib/integrations/api-tickets";
import { createWebhookEndpoint, deliverDueWebhooks, MAX_ATTEMPTS, WEBHOOK_EVENTS } from "@/lib/integrations/webhooks";
import { approveAndSend, escalateTicket } from "@/lib/tickets/agent-actions";
import { formatContextForPrompt } from "@/lib/tickets/context";
import { createTicket } from "@/lib/tickets/intake";
import { processTicket, type PipelineDeps } from "@/lib/triage/pipeline";
import { clearTickets, createTestDb } from "./support/test-db";

const APP_SECRET = "a".repeat(40);
let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());
beforeEach(async () => {
  await clearTickets(db);
  await db.execute(sql`TRUNCATE TABLE api_clients RESTART IDENTITY CASCADE`);
});

const deps = (): PipelineDeps => ({ db, ai: new MockProvider(), config: { minConfidence: 0.6, kbMinScore: 0.25, maxAttempts: 3 } });

const sample = SEED_TICKETS.find((t) => t.key === "delayed-office-opening")!;
const orderContext = {
  company: { name: "Meridian Health Partners", tierLabel: "Enterprise", accountManager: "Dana Whitfield" },
  order: {
    number: "FO-50001",
    status: "delayed",
    placedAt: "2026-11-09T10:00:00.000Z",
    estimatedDelivery: "2026-11-23T10:00:00.000Z",
    poNumber: "MHP-PO-88213",
    carrier: "Fernway Freight",
    trackingNumber: "FWF-3318204",
    items: [{ sku: "FUR-5001", name: "Ergonomic mesh task chair", quantity: 60, quantityDelivered: 0 }],
    events: [{ kind: "delayed", note: "Carrier capacity issue", at: "2026-11-17T10:00:00.000Z" }],
  },
};

function apiInput(overrides: Record<string, unknown> = {}) {
  return apiCreateTicketSchema.parse({
    externalId: "SR-7001",
    customerName: sample.customerName,
    customerEmail: sample.customerEmail,
    tier: sample.tier,
    subject: sample.subject,
    body: sample.body,
    context: orderContext,
    ...overrides,
  });
}

async function connectedClient(): Promise<{ client: ApiClient; key: string; secret: string }> {
  const { client, key } = await createApiClient(db, { name: "Store", scopes: ["tickets:write", "tickets:read", "kb:read"] });
  const { secret } = await createWebhookEndpoint(db, {
    apiClientId: client.id,
    url: "http://localhost:3000/api/webhooks/triage",
    events: [...WEBHOOK_EVENTS],
    appSecret: APP_SECRET,
    allowPrivateNetwork: true,
  });
  return { client, key, secret };
}

const deliveries = () => db.select().from(webhookDeliveries).orderBy(webhookDeliveries.createdAt);

describe("API key authentication", () => {
  it("accepts a valid key with the right scope", async () => {
    const { key } = await createApiClient(db, { name: "Store", scopes: ["tickets:write"] });
    const result = await authenticateApiKey(db, `Bearer ${key}`, "tickets:write", 100);
    expect(result.ok).toBe(true);
  });

  it("gives the same 401 for missing, malformed, unknown and revoked keys", async () => {
    const { client, key } = await createApiClient(db, { name: "Store", scopes: ["tickets:write"] });
    await db.update(apiClients).set({ revokedAt: sql`now()` }).where(eq(apiClients.id, client.id));
    for (const header of [null, "Basic abc", "Bearer nope", `Bearer td_live_${"x".repeat(43)}`, `Bearer ${key}`]) {
      const r = await authenticateApiKey(db, header, "tickets:write", 100);
      expect(r).toMatchObject({ ok: false, status: 401, code: "unauthorized" });
    }
  });

  it("returns 403 for a missing scope and 429 over the per-minute limit", async () => {
    const { key } = await createApiClient(db, { name: "Store", scopes: ["kb:read"] });
    expect(await authenticateApiKey(db, `Bearer ${key}`, "tickets:write", 100)).toMatchObject({ ok: false, status: 403 });
    expect((await authenticateApiKey(db, `Bearer ${key}`, "kb:read", 2)).ok).toBe(true);
    expect((await authenticateApiKey(db, `Bearer ${key}`, "kb:read", 2)).ok).toBe(false); // 3rd counted call this minute
  });
});

describe("creating tickets through the API", () => {
  it("is idempotent on externalId, and refuses a different ticket under the same id", async () => {
    const { client } = await connectedClient();
    const first = await createTicketFromApi(db, client, apiInput());
    const again = await createTicketFromApi(db, client, apiInput());
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, ticket: { id: first.ticket.id } });
    await expect(createTicketFromApi(db, client, apiInput({ body: "Something completely different here." }))).rejects.toBeInstanceOf(
      IdempotencyConflictError,
    );
  });

  it("validates the context strictly", () => {
    expect(apiCreateTicketSchema.safeParse({ ...apiInput(), context: { ...orderContext, isAdmin: true } }).success).toBe(false);
    const huge = { ...orderContext, order: { ...orderContext.order, events: Array.from({ length: 31 }, () => orderContext.order.events[0]) } };
    expect(apiCreateTicketSchema.safeParse({ ...apiInput(), context: huge }).success).toBe(false);
  });

  it("gives the AI the order context as plain, factual text", () => {
    const text = formatContextForPrompt(apiInput().context, new Date("2026-11-19T00:00:00Z"))!;
    expect(text).toContain("Order FO-50001: status delayed");
    expect(text).toContain("Estimated delivery: Mon, Nov 23, 2026");
    expect(text).toContain("60 × Ergonomic mesh task chair [FUR-5001] (0 delivered)");
  });
});

describe("webhook events (transactional outbox)", () => {
  it("emits triaged → reply_approved for an API ticket, carrying the approved reply", async () => {
    const { client } = await connectedClient();
    const { ticket } = await createTicketFromApi(db, client, apiInput());
    await processTicket(ticket.id, deps());
    const [draft] = await db.select().from(drafts).where(eq(drafts.ticketId, ticket.id));
    await approveAndSend(db, { ticketId: ticket.id, body: draft.aiBody, agent: "Sam Rivera" });

    const events = await deliveries();
    expect(events.map((e) => e.eventType)).toEqual(["ticket.triaged", "ticket.reply_approved"]);
    const approved = events[1].payload as { id: string; data: { ticket: { externalId: string; status: string }; reply: { body: string; sentBy: string } } };
    expect(approved.id).toBe(events[1].id);
    expect(approved.data.ticket).toMatchObject({ externalId: "SR-7001", status: "sent" });
    expect(approved.data.reply).toMatchObject({ body: draft.aiBody, sentBy: "Sam Rivera" });
  });

  it("never leaks the agent's internal escalation note to the host app", async () => {
    const { client } = await connectedClient();
    const { ticket } = await createTicketFromApi(db, client, apiInput());
    await processTicket(ticket.id, deps());
    await escalateTicket(db, { ticketId: ticket.id, note: "VIP — internal only", agent: "Mei Tanaka" });
    const escalated = (await deliveries()).find((e) => e.eventType === "ticket.escalated")!;
    expect(JSON.stringify(escalated.payload)).not.toContain("internal only");
  });

  it("emits nothing for tickets that didn't come through the API", async () => {
    await connectedClient();
    const { id } = await createTicket(
      db,
      { customerName: "Web User", customerEmail: "web@example.com", tier: "free", subject: sample.subject, body: sample.body },
      { source: "web_form" },
    );
    await processTicket(id, deps());
    expect(await deliveries()).toHaveLength(0);
  });
});

describe("webhook delivery", () => {
  async function queueOneEvent() {
    const conn = await connectedClient();
    const { ticket } = await createTicketFromApi(db, conn.client, apiInput());
    await processTicket(ticket.id, deps());
    return conn;
  }

  it("signs each request so the receiver can verify it", async () => {
    const { secret } = await queueOneEvent();
    const seen: Array<{ body: string; headers: Record<string, string> }> = [];
    const result = await deliverDueWebhooks(db, {
      appSecret: APP_SECRET,
      allowPrivateNetwork: true,
      post: async (_url, body, headers) => {
        seen.push({ body, headers });
        return { status: 200 };
      },
    });
    expect(result).toEqual({ delivered: 1, failed: 0 });
    const { body, headers } = seen[0];
    const [, t, v1] = headers["triage-signature"].match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    expect(createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")).toBe(v1);
    expect(headers["triage-event-type"]).toBe("ticket.triaged");
    expect((await deliveries())[0]).toMatchObject({ status: "delivered", attempts: 1, lastStatusCode: 200 });
  });

  it("retries failures with backoff, then dead-letters", async () => {
    await queueOneEvent();
    const failing = async () => ({ status: 500 });
    await deliverDueWebhooks(db, { appSecret: APP_SECRET, allowPrivateNetwork: true, post: failing });
    let [row] = await deliveries();
    expect(row).toMatchObject({ status: "pending", attempts: 1, lastStatusCode: 500 });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());

    // Not due yet → nothing is sent.
    expect(await deliverDueWebhooks(db, { appSecret: APP_SECRET, allowPrivateNetwork: true, post: failing })).toEqual({ delivered: 0, failed: 0 });

    // Fast-forward to the final attempt.
    await db.update(webhookDeliveries).set({ attempts: MAX_ATTEMPTS - 1, nextAttemptAt: sql`now() - interval '1 second'` });
    await deliverDueWebhooks(db, { appSecret: APP_SECRET, allowPrivateNetwork: true, post: failing });
    [row] = await deliveries();
    expect(row).toMatchObject({ status: "dead", attempts: MAX_ATTEMPTS });
  });

  it("delivers over real HTTP, and refuses private addresses when they aren't allowed", async () => {
    const received: string[] = [];
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push(body);
        res.writeHead(204).end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    try {
      await queueOneEvent();
      await db.execute(sql`UPDATE webhook_endpoints SET url = ${`http://127.0.0.1:${port}/hook`}`);

      // Production-style settings: localhost is refused and nothing reaches the server.
      const blocked = await deliverDueWebhooks(db, { appSecret: APP_SECRET, allowPrivateNetwork: false });
      expect(blocked.failed).toBe(1);
      expect(received).toHaveLength(0);

      await db.update(webhookDeliveries).set({ nextAttemptAt: sql`now() - interval '1 second'` });
      const ok = await deliverDueWebhooks(db, { appSecret: APP_SECRET, allowPrivateNetwork: true });
      expect(ok.delivered).toBe(1);
      expect(JSON.parse(received[0])).toMatchObject({ type: "ticket.triaged" });
    } finally {
      server.close();
    }
  });
});
