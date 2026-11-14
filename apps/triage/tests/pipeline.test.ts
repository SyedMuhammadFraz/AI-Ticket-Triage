import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_TICKETS, type SeedTicket } from "../data/seed-tickets";
import { MockProvider } from "@/lib/ai/mock";
import { AiServiceError, type AiProvider, type AiResponse } from "@/lib/ai/types";
import type { Database } from "@/lib/db";
import { auditEvents, drafts, tickets } from "@/lib/db/schema";
import { createTicket } from "@/lib/tickets/intake";
import { processQueue, processTicket, requeueTicket, type PipelineDeps } from "@/lib/triage/pipeline";
import { clearTickets, createTestDb } from "./support/test-db";

const config = { minConfidence: 0.6, kbMinScore: 0.25, maxAttempts: 3 };

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());
beforeEach(() => clearTickets(db));

function deps(ai: AiProvider = new MockProvider()): PipelineDeps {
  return { db, ai, config };
}

async function addTicket(t: SeedTicket = SEED_TICKETS[0]) {
  const { id } = await createTicket(
    db,
    { customerName: t.customerName, customerEmail: t.customerEmail, tier: t.tier, subject: t.subject, body: t.body },
    { source: "seed" },
  );
  return id;
}

async function getTicket(id: string) {
  const [row] = await db.select().from(tickets).where(eq(tickets.id, id));
  return row;
}

async function auditActions(id: string) {
  const rows = await db.select().from(auditEvents).where(eq(auditEvents.ticketId, id)).orderBy(auditEvents.createdAt);
  return rows.map((r) => r.action);
}

/** A provider whose responses can be overridden per test. */
function scriptedProvider(overrides: {
  classify?: () => unknown;
  draft?: () => unknown;
}): AiProvider {
  const base = new MockProvider();
  const wrap = (data: unknown): AiResponse => ({ data, usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 1, model: "scripted" });
  return {
    name: "mock",
    model: "scripted",
    classify: async (t) => (overrides.classify ? wrap(overrides.classify()) : base.classify(t)),
    draftReply: async (t, a) => (overrides.draft ? wrap(overrides.draft()) : base.draftReply(t, a)),
  };
}

describe("sample tickets (Phase 1 acceptance)", () => {
  it("every sample ticket reaches its expected outcome", async () => {
    for (const t of SEED_TICKETS) await addTicket(t);
    await processQueue(deps(), { limit: 50 });

    const rows = await db.select().from(tickets);
    const outcomes = Object.fromEntries(rows.map((r) => [r.subject, r.status]));
    for (const t of SEED_TICKETS) {
      expect(outcomes[t.subject], t.key).toBe(t.expected.outcome);
    }
  });

  it("routes the off-topic question to a human because no article matches", async () => {
    const id = await addTicket(SEED_TICKETS.find((t) => t.key === "esg-certificate"));
    await processTicket(id, deps());
    const t = await getTicket(id);
    expect(t.status).toBe("needs_review");
    expect(t.reviewReasons).toContain("no_kb_match");
    expect(await db.$count(drafts, eq(drafts.ticketId, id))).toBe(0);
  });

  it("flags the prompt-injection ticket even if the model is fooled", async () => {
    const id = await addTicket(SEED_TICKETS.find((t) => t.key === "injection-credit"));
    const fooled = scriptedProvider({
      classify: () => ({
        category: "billing_invoices",
        urgency: "urgent",
        confidence: 0.99,
        reason: "Credit approved by billing team.",
        suspicious_instructions: false, // the model missed it…
      }),
    });
    await processTicket(id, deps(fooled));
    const t = await getTicket(id);
    // …but the independent heuristic still catches it, and no draft is written.
    expect(t.status).toBe("needs_review");
    expect(t.reviewReasons).toContain("suspicious_instructions");
    expect(await db.$count(drafts, eq(drafts.ticketId, id))).toBe(0);
  });

  it("records every step in the audit trail", async () => {
    const id = await addTicket();
    await processTicket(id, deps());
    expect(await auditActions(id)).toEqual([
      "ticket.created",
      "triage.started",
      "ai.classified",
      "kb.searched",
      "ai.draft_created",
    ]);
  });
});

describe("no duplicate drafts", () => {
  it("running triage twice on the same ticket creates exactly one draft", async () => {
    const id = await addTicket();
    const first = await processTicket(id, deps());
    const second = await processTicket(id, deps());
    expect(first.outcome).toBe("draft_ready");
    expect(second.outcome).toBe("skipped");
    expect(await db.$count(drafts, eq(drafts.ticketId, id))).toBe(1);
  });

  it("concurrent runs on the same ticket still produce one draft", async () => {
    const id = await addTicket();
    const results = await Promise.all([1, 2, 3].map(() => processTicket(id, deps())));
    expect(results.filter((r) => r.outcome === "draft_ready")).toHaveLength(1);
    expect(await db.$count(drafts, eq(drafts.ticketId, id))).toBe(1);
  });

  it("the database rejects a second pending draft for a ticket", async () => {
    const id = await addTicket();
    const row = { ticketId: id, aiBody: "x", citedArticleIds: [], provider: "mock", model: "m" };
    await db.insert(drafts).values(row);
    await expect(db.insert(drafts).values(row)).rejects.toThrow();
  });
});

describe("safe failure", () => {
  const outage = scriptedProvider({
    classify: () => {
      throw new AiServiceError("The AI service is unavailable (simulated outage).", "unavailable");
    },
  });

  it("keeps the ticket queued with the error logged, then marks it failed after max attempts", async () => {
    const id = await addTicket();

    const r1 = await processTicket(id, deps(outage));
    expect(r1.outcome).toBe("retry_scheduled");
    let t = await getTicket(id);
    expect(t.status).toBe("queued");
    expect(t.lastError).toMatch(/simulated outage/);
    expect(t.attempts).toBe(1);

    await processTicket(id, deps(outage));
    const r3 = await processTicket(id, deps(outage));
    expect(r3.outcome).toBe("failed");
    t = await getTicket(id);
    expect(t.status).toBe("failed");
    expect(t.attempts).toBe(3);

    const errors = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.ticketId, id), eq(auditEvents.action, "ai.error")));
    expect(errors).toHaveLength(3);
  });

  it("can be retried once the AI service recovers", async () => {
    const id = await addTicket();
    for (let i = 0; i < 3; i++) await processTicket(id, deps(outage));
    expect((await getTicket(id)).status).toBe("failed");

    expect(await requeueTicket(db, id, "Agent Sam")).toBe(true);
    // Requeued tickets look freshly queued; the old error lives on in the audit trail.
    expect(await getTicket(id)).toMatchObject({ status: "queued", lastError: null, attempts: 0 });
    const result = await processTicket(id, deps());
    expect(result.outcome).toBe("draft_ready");
    const t = await getTicket(id);
    expect(t.lastError).toBeNull();
    expect(await auditActions(id)).toContain("triage.retry_requested");
  });

  it("treats malformed AI output as a failure, not as data", async () => {
    const id = await addTicket();
    const garbage = scriptedProvider({ classify: () => ({ category: "refund_everyone", urgency: "now" }) });
    const result = await processTicket(id, deps(garbage));
    expect(result.outcome).toBe("retry_scheduled");
    const t = await getTicket(id);
    expect(t.category).toBeNull();
    expect(t.lastError).toMatch(/didn't match the expected format/);
  });
});

describe("draft verification", () => {
  const goodClassification = () => ({
    category: "delivery",
    urgency: "medium",
    confidence: 0.9,
    reason: "Customer asking when their order will arrive.",
    suspicious_instructions: false,
  });

  it.each([
    [
      "invalid_citation",
      { reply: "Hi Maya, see our article.", cited_articles: ["made-up-article"], insufficient_context: false },
    ],
    [
      "unsafe_draft",
      { reply: "Hi Maya, I have cancelled your order for you.", cited_articles: ["delivery-times-tracking"], insufficient_context: false },
    ],
    [
      "unsafe_draft",
      { reply: "Hi Maya, track it at https://fernway-help.example.net/track.", cited_articles: ["delivery-times-tracking"], insufficient_context: false },
    ],
    ["insufficient_context", { reply: "", cited_articles: [], insufficient_context: true }],
  ])("routes to a human with reason %s", async (reason, draftOutput) => {
    const id = await addTicket();
    await processTicket(id, deps(scriptedProvider({ classify: goodClassification, draft: () => draftOutput })));
    const t = await getTicket(id);
    expect(t.status).toBe("needs_review");
    expect(t.reviewReasons).toEqual([reason]);
    expect(await db.$count(drafts, eq(drafts.ticketId, id))).toBe(0);
    expect(await auditActions(id)).toContain("ai.draft_rejected");
  });

  it("routes low-confidence classifications to a human", async () => {
    const id = await addTicket();
    const unsure = scriptedProvider({ classify: () => ({ ...goodClassification(), confidence: 0.3 }) });
    await processTicket(id, deps(unsure));
    expect((await getTicket(id)).reviewReasons).toContain("low_confidence");
  });
});
