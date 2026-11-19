import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { supportTickets, webhookReceipts } from "@/lib/db/schema";
import { placeOrder } from "@/lib/orders";
import {
  applyTriageEvent,
  buildTicketContext,
  createSupportTicket,
  SupportError,
  syncSupportTicket,
  type RemoteCreate,
  type TriageEvent,
} from "@/lib/support/tickets";
import { getCompanyOrder } from "@/lib/orders";
import { createTestDb } from "./support/test-db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let orderNumber: number;

beforeAll(async () => {
  ctx = await createTestDb();
  ({ number: orderNumber } = await placeOrder(ctx.db, {
    userId: buyer().id,
    company: buyer().company,
    lines: [{ sku: "FUR-5001", quantity: 4 }],
    poNumber: "MHP-PO-1",
    paymentMethod: "invoice",
  }));
});
afterAll(() => ctx.close());
beforeEach(async () => {
  await ctx.db.delete(webhookReceipts);
  await ctx.db.delete(supportTickets);
});

function buyer() {
  const u = ctx.users.get("daniel.okafor@meridianhealth.example")!;
  return { ...u, company: ctx.companies.get("meridian-health")! };
}
function otherBuyer() {
  const u = ctx.users.get("lukas.becker@linmoreau.example")!;
  return { ...u, company: ctx.companies.get("lin-moreau-architects")! };
}

const request = (extra = {}) => ({ subject: "Chairs not arrived", body: "Our chairs haven't arrived and the office opens Monday.", ...extra });

function fakeRemote(): RemoteCreate & { calls: Parameters<RemoteCreate>[0][] } {
  const calls: Parameters<RemoteCreate>[0][] = [];
  const fn = (async (input) => {
    calls.push(input);
    return { id: randomUUID(), number: 1001 + calls.length, status: "queued" };
  }) as RemoteCreate & { calls: typeof calls };
  fn.calls = calls;
  return fn;
}

describe("creating a support request", () => {
  it("only attaches orders from the buyer's own company", async () => {
    await expect(createSupportTicket(ctx.db, otherBuyer(), request({ orderNumber }))).rejects.toBeInstanceOf(SupportError);
    const t = await createSupportTicket(ctx.db, buyer(), request({ orderNumber }));
    expect(t.orderId).not.toBeNull();
    expect(t.status).toBe("submitted");
  });

  it("limits requests per buyer per hour", async () => {
    for (let i = 0; i < 10; i++) await createSupportTicket(ctx.db, buyer(), request());
    await expect(createSupportTicket(ctx.db, buyer(), request())).rejects.toThrow(/wait/);
  });
});

describe("syncing to Triage Desk", () => {
  it("sends the store reference, mapped tier and order context, then marks the request received", async () => {
    const t = await createSupportTicket(ctx.db, buyer(), request({ orderNumber }));
    const remote = fakeRemote();
    expect(await syncSupportTicket(ctx.db, t.id, { createRemote: remote, company: buyer().company, buyer: buyer() })).toBe(true);

    const sent = remote.calls[0];
    expect(sent).toMatchObject({ externalId: `SR-${t.number}`, tier: "enterprise", customerEmail: buyer().email });
    expect(sent.context).toMatchObject({
      company: { name: "Meridian Health Partners", tierLabel: "Enterprise", accountManager: "Dana Whitfield" },
      order: { number: `FO-${orderNumber}`, poNumber: "MHP-PO-1", items: [{ sku: "FUR-5001", quantity: 4 }] },
    });
    const [row] = await ctx.db.select().from(supportTickets).where(eq(supportTickets.id, t.id));
    expect(row).toMatchObject({ status: "received", triageNumber: 1002, lastSyncError: null });

    // Already synced → no second remote call (retries can't create duplicates).
    await syncSupportTicket(ctx.db, t.id, { createRemote: remote, company: buyer().company, buyer: buyer() });
    expect(remote.calls).toHaveLength(1);
  });

  it("keeps the request and records the error when Triage Desk is down", async () => {
    const t = await createSupportTicket(ctx.db, buyer(), request());
    const down: RemoteCreate = async () => {
      throw new Error("Triage Desk is unreachable (TimeoutError).");
    };
    expect(await syncSupportTicket(ctx.db, t.id, { createRemote: down, company: buyer().company, buyer: buyer() })).toBe(false);
    const [row] = await ctx.db.select().from(supportTickets).where(eq(supportTickets.id, t.id));
    expect(row).toMatchObject({ status: "submitted", triageTicketId: null, syncAttempts: 1 });
    expect(row.lastSyncError).toMatch(/unreachable/);
  });

  it("builds context without an order too", async () => {
    const order = await getCompanyOrder(ctx.db, buyer().company.id, orderNumber);
    expect(buildTicketContext(buyer().company, null)).not.toHaveProperty("order");
    expect(buildTicketContext(buyer().company, order).order?.status).toBe("processing");
  });
});

describe("webhook events", () => {
  async function syncedTicket() {
    const t = await createSupportTicket(ctx.db, buyer(), request());
    const triageId = randomUUID();
    await syncSupportTicket(ctx.db, t.id, {
      createRemote: async () => ({ id: triageId, number: 1042, status: "queued" }),
      company: buyer().company,
      buyer: buyer(),
    });
    return { t, triageId };
  }
  const event = (triageId: string, type: TriageEvent["type"], reply?: TriageEvent["data"]["reply"]): TriageEvent => ({
    id: randomUUID(),
    type,
    createdAt: new Date().toISOString(),
    data: { ticket: { id: triageId, externalId: null, status: "x" }, ...(reply && { reply }) },
  });
  const status = async (id: string) => (await ctx.db.select().from(supportTickets).where(eq(supportTickets.id, id)))[0];

  it("applies each event exactly once", async () => {
    const { t, triageId } = await syncedTicket();
    const e = event(triageId, "ticket.triaged");
    expect(await applyTriageEvent(ctx.db, e)).toBe("applied");
    expect(await applyTriageEvent(ctx.db, e)).toBe("duplicate");
    expect((await status(t.id)).status).toBe("in_review");
  });

  it("delivers the approved reply and never moves backwards", async () => {
    const { t, triageId } = await syncedTicket();
    const reply = { body: "Hi Daniel, your chairs arrive Monday.", sentBy: "Sam Rivera", sentAt: new Date().toISOString() };
    expect(await applyTriageEvent(ctx.db, event(triageId, "ticket.reply_approved", reply))).toBe("applied");
    // A late, out-of-order "triaged" must not undo the answer.
    expect(await applyTriageEvent(ctx.db, event(triageId, "ticket.triaged"))).toBe("ignored");
    expect(await status(t.id)).toMatchObject({ status: "answered", replyBody: reply.body, repliedBy: "Sam Rivera" });
  });

  it("ignores events for tickets it doesn't know", async () => {
    expect(await applyTriageEvent(ctx.db, event(randomUUID(), "ticket.escalated"))).toBe("ignored");
  });
});
