import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SEED_TICKETS } from "../data/seed-tickets";
import { MockProvider } from "@/lib/ai/mock";
import { AiServiceError, type AiProvider } from "@/lib/ai/types";
import { getDashboardStats } from "@/lib/dashboard/queries";
import type { Database } from "@/lib/db";
import { drafts, messages, tickets } from "@/lib/db/schema";
import { approveAndSend, escalateTicket, TicketActionError } from "@/lib/tickets/agent-actions";
import { createTicket } from "@/lib/tickets/intake";
import { processTicket, type PipelineDeps } from "@/lib/triage/pipeline";
import { clearTickets, createTestDb } from "./support/test-db";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});
afterAll(() => close());
beforeEach(() => clearTickets(db));

const deps = (ai: AiProvider = new MockProvider()): PipelineDeps => ({
  db,
  ai,
  config: { minConfidence: 0.6, kbMinScore: 0.25, maxAttempts: 3 },
});

async function triagedTicket(key: string) {
  const t = SEED_TICKETS.find((s) => s.key === key)!;
  const { id } = await createTicket(
    db,
    { customerName: t.customerName, customerEmail: t.customerEmail, tier: t.tier, subject: t.subject, body: t.body },
    { source: "seed" },
  );
  await processTicket(id, deps());
  return id;
}

const getTicket = async (id: string) => (await db.select().from(tickets).where(eq(tickets.id, id)))[0];
const getDraft = async (id: string) => (await db.select().from(drafts).where(eq(drafts.ticketId, id)))[0];
const getMessages = (id: string) => db.select().from(messages).where(eq(messages.ticketId, id));

describe("approveAndSend", () => {
  it("sends an unchanged AI draft and records it as unedited", async () => {
    const id = await triagedTicket("where-is-order");
    const draft = await getDraft(id);

    const result = await approveAndSend(db, { ticketId: id, body: draft.aiBody, agent: "Sam Rivera" });

    expect(result).toEqual({ edited: false, manual: false });
    expect((await getTicket(id)).status).toBe("sent");
    const d = await getDraft(id);
    expect(d.status).toBe("approved");
    expect(d.finalBody).toBeNull();
    expect(d.approvedBy).toBe("Sam Rivera");
    const [m] = await getMessages(id);
    expect(m).toMatchObject({ body: draft.aiBody, wasEdited: false, sentBy: "Sam Rivera", draftId: draft.id });
  });

  it("tracks edits, keeping the original AI text for comparison", async () => {
    const id = await triagedTicket("where-is-order");
    const draft = await getDraft(id);
    const edited = `${draft.aiBody}\n\nP.S. I've also added a note to your account.`;

    const result = await approveAndSend(db, { ticketId: id, body: edited, agent: "Mei Tanaka" });

    expect(result.edited).toBe(true);
    const d = await getDraft(id);
    expect(d.aiBody).toBe(draft.aiBody);
    expect(d.finalBody).toBe(edited);
    expect((await getMessages(id))[0].wasEdited).toBe(true);
  });

  it("ignores whitespace-only changes when tracking edits", async () => {
    const id = await triagedTicket("where-is-order");
    const draft = await getDraft(id);
    const result = await approveAndSend(db, { ticketId: id, body: `  ${draft.aiBody}\n\n`, agent: "Sam Rivera" });
    expect(result.edited).toBe(false);
  });

  it("can never send twice, even when two approvals race", async () => {
    const id = await triagedTicket("where-is-order");
    const { aiBody } = await getDraft(id);

    const results = await Promise.allSettled([
      approveAndSend(db, { ticketId: id, body: aiBody, agent: "Sam Rivera" }),
      approveAndSend(db, { ticketId: id, body: aiBody, agent: "Mei Tanaka" }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(TicketActionError);
    expect(await getMessages(id)).toHaveLength(1);
  });

  it("lets an agent write a reply by hand for a ticket the AI routed to a person", async () => {
    const id = await triagedTicket("esg-certificate");
    expect((await getTicket(id)).status).toBe("needs_review");

    const result = await approveAndSend(db, { ticketId: id, body: "Hi Ethan, our compliance team will be in touch.", agent: "Omar Haddad" });

    expect(result).toEqual({ edited: false, manual: true });
    const [m] = await getMessages(id);
    expect(m.draftId).toBeNull();
  });

  it("lets an agent reply by hand while the AI is down", async () => {
    const outage: AiProvider = {
      ...new MockProvider(),
      name: "mock",
      model: "down",
      classify: async () => {
        throw new AiServiceError("The AI service is unavailable (simulated outage).", "unavailable");
      },
      draftReply: async () => {
        throw new AiServiceError("unavailable", "unavailable");
      },
    };
    const t = SEED_TICKETS[0];
    const { id } = await createTicket(
      db,
      { customerName: t.customerName, customerEmail: t.customerEmail, tier: t.tier, subject: t.subject, body: t.body },
      { source: "seed" },
    );
    await processTicket(id, deps(outage));
    expect((await getTicket(id)).status).toBe("queued");

    await approveAndSend(db, { ticketId: id, body: "Hi Maya, here's how to reset your password…", agent: "Sam Rivera" });
    expect((await getTicket(id)).status).toBe("sent");
    // The queued ticket is no longer claimable, so the pipeline won't touch it.
    expect((await processTicket(id, deps())).outcome).toBe("skipped");
  });

  it("refuses tickets that are already closed", async () => {
    const id = await triagedTicket("where-is-order");
    await escalateTicket(db, { ticketId: id, note: "", agent: "Sam Rivera" });
    await expect(approveAndSend(db, { ticketId: id, body: "Hi", agent: "Sam Rivera" })).rejects.toBeInstanceOf(
      TicketActionError,
    );
  });
});

describe("escalateTicket", () => {
  it("closes the ticket and discards the pending draft so it can't be sent later", async () => {
    const id = await triagedTicket("where-is-order");
    await escalateTicket(db, { ticketId: id, note: "VIP customer", agent: "Mei Tanaka" });

    expect((await getTicket(id)).status).toBe("escalated");
    expect((await getDraft(id)).status).toBe("discarded");
    await expect(escalateTicket(db, { ticketId: id, note: "", agent: "Mei Tanaka" })).rejects.toBeInstanceOf(
      TicketActionError,
    );
  });

  it("refuses sent tickets", async () => {
    const id = await triagedTicket("where-is-order");
    const { aiBody } = await getDraft(id);
    await approveAndSend(db, { ticketId: id, body: aiBody, agent: "Sam Rivera" });
    await expect(escalateTicket(db, { ticketId: id, note: "", agent: "Sam Rivera" })).rejects.toThrow(
      /can't be escalated/,
    );
  });
});

describe("getDashboardStats", () => {
  it("summarises triage, routing, edits and timing", async () => {
    const a = await triagedTicket("where-is-order");
    const b = await triagedTicket("cancel-order");
    await triagedTicket("esg-certificate"); // routed to a person

    await approveAndSend(db, { ticketId: a, body: (await getDraft(a)).aiBody, agent: "Sam Rivera" });
    await approveAndSend(db, { ticketId: b, body: `${(await getDraft(b)).aiBody} Edited.`, agent: "Sam Rivera" });

    const stats = await getDashboardStats(db);
    expect(stats.triaged).toBe(3);
    expect(stats.routedToHuman).toBe(1);
    expect(stats.sentFromDraft).toBe(2);
    expect(stats.sentUnedited).toBe(1);
    expect(stats.avgSecondsToDraft).not.toBeNull();
    expect(stats.avgSecondsToDraft!).toBeGreaterThanOrEqual(0);
    // Mock-provider usage is excluded from AI cost.
    expect(stats.ai.tickets).toBe(0);
  });
});
