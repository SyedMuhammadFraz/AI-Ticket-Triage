import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orderItems, products } from "@/lib/db/schema";
import { getCompanyOrder, listCompanyOrders, OrderError, placeOrder } from "@/lib/orders";
import { computeTotals } from "@/lib/pricing";
import { createTestDb } from "./support/test-db";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});
afterAll(() => ctx.close());

const meridian = () => ctx.companies.get("meridian-health")!;
const lin = () => ctx.companies.get("lin-moreau-architects")!;
const daniel = () => ctx.users.get("daniel.okafor@meridianhealth.example")!;
const lukas = () => ctx.users.get("lukas.becker@linmoreau.example")!;

describe("placeOrder", () => {
  it("prices from the database with the company's contract discount", async () => {
    const { number } = await placeOrder(ctx.db, {
      userId: daniel().id,
      company: meridian(),
      lines: [{ sku: "FUR-5001", quantity: 2 }, { sku: "PAP-1001", quantity: 3 }],
      poNumber: "MHP-PO-1",
      paymentMethod: "invoice",
    });

    const detail = await getCompanyOrder(ctx.db, meridian().id, number);
    expect(detail).not.toBeNull();
    const expected = computeTotals([{ unitPriceCents: 28900, quantity: 2 }, { unitPriceCents: 5499, quantity: 3 }], 12);
    expect(detail!.order).toMatchObject({ ...expected, poNumber: "MHP-PO-1", paymentMethod: "invoice", status: "processing" });
    expect(detail!.items.map((i) => i.item.sku).sort()).toEqual(["FUR-5001", "PAP-1001"]);
    expect(detail!.events.map((e) => e.kind)).toEqual(["placed", "approved"]);
  });

  it("decrements stock but never below zero", async () => {
    const [before] = await ctx.db.select().from(products).where(eq(products.sku, "INK-3020"));
    await placeOrder(ctx.db, {
      userId: daniel().id,
      company: meridian(),
      lines: [{ sku: "INK-3020", quantity: before.stock + 10 }],
      poNumber: null,
      paymentMethod: "invoice",
    });
    const [after] = await ctx.db.select().from(products).where(eq(products.sku, "INK-3020"));
    expect(after.stock).toBe(0);
  });

  it("refuses invoice payment for card-only (Starter) companies", async () => {
    await expect(
      placeOrder(ctx.db, { userId: lukas().id, company: lin(), lines: [{ sku: "PAP-1001", quantity: 1 }], poNumber: null, paymentMethod: "invoice" }),
    ).rejects.toBeInstanceOf(OrderError);
  });

  it("rejects empty carts and unknown products without writing anything", async () => {
    const before = await ctx.db.$count(orderItems);
    await expect(
      placeOrder(ctx.db, { userId: lukas().id, company: lin(), lines: [], poNumber: null, paymentMethod: "card" }),
    ).rejects.toThrow(/empty/);
    await expect(
      placeOrder(ctx.db, { userId: lukas().id, company: lin(), lines: [{ sku: "XXX-9999", quantity: 1 }], poNumber: null, paymentMethod: "card" }),
    ).rejects.toThrow(/no longer available/);
    expect(await ctx.db.$count(orderItems)).toBe(before);
  });
});

describe("company scoping", () => {
  it("never shows one company's orders to another", async () => {
    const { number } = await placeOrder(ctx.db, {
      userId: lukas().id,
      company: lin(),
      lines: [{ sku: "WRT-2001", quantity: 1 }],
      poNumber: null,
      paymentMethod: "card",
    });

    expect(await getCompanyOrder(ctx.db, lin().id, number)).not.toBeNull();
    // Same order number, different company → not found (no information leak).
    expect(await getCompanyOrder(ctx.db, meridian().id, number)).toBeNull();
    const meridianNumbers = (await listCompanyOrders(ctx.db, meridian().id)).map((o) => o.number);
    expect(meridianNumbers).not.toContain(number);
  });
});
