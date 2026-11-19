/**
 * Seeds Fernway Office Supply: companies and buyers, the catalogue, and an
 * order history whose dates are relative to now.
 *
 *   npm run db:seed    — idempotent: upserts companies/users/products, adds orders once
 *   npm run db:reset   — wipes ALL store data and re-seeds (refuses in production)
 */
import { sql } from "drizzle-orm";
import { SEED_COMPANIES } from "../data/companies";
import { SEED_ORDERS, type SeedOrder } from "../data/orders";
import { SEED_PRODUCTS } from "../data/products";
import { closeDb, getDb } from "@/lib/db";
import { companies, orderEvents, orderItems, orders, products, users } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { computeTotals } from "@/lib/pricing";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Event = { kind: string; note: string | null; at: Date };

/** Builds a believable timeline for a seeded order, never later than now. */
function timeline(o: SeedOrder, placedAt: Date, now: number): Event[] {
  const at = (msAfterPlaced: number) => new Date(Math.min(placedAt.getTime() + msAfterPlaced, now - 5 * 60_000));
  const events: Event[] = [{ kind: "placed", note: o.poNumber ? `PO ${o.poNumber}` : null, at: placedAt }];
  events.push({
    kind: "approved",
    note: o.paymentMethod === "invoice" ? "Net-30 invoice account approved" : "Card payment authorised",
    at: at(1 * HOUR),
  });
  if (o.status === "cancelled") {
    events.push({ kind: "cancelled", note: o.note ?? null, at: at(5 * HOUR) });
    return events;
  }
  if (o.status === "processing") {
    if (o.placedDaysAgo >= 1) events.push({ kind: "packed", note: "Picked and packed at the Reno fulfilment centre", at: at(18 * HOUR) });
    return events;
  }
  events.push({ kind: "packed", note: "Picked and packed at the Reno fulfilment centre", at: at(18 * HOUR) });
  events.push({ kind: "shipped", note: o.carrier ? `${o.carrier} · tracking ${o.trackingNumber}` : null, at: at(1 * DAY + 4 * HOUR) });

  if (o.status === "delayed") {
    events.push({ kind: "delayed", note: o.note ?? "Shipment delayed", at: new Date(now - 2 * DAY) });
  } else if (o.status === "partially_delivered") {
    events.push({ kind: "partially_delivered", note: o.note ?? null, at: new Date(now - 1 * DAY) });
  } else if (o.status === "delivered" || o.status === "returned") {
    const deliveredAt = at(Math.min(2 * DAY + 3 * HOUR, (o.placedDaysAgo - 0.2) * DAY));
    events.push({ kind: "delivered", note: "Signed for at reception", at: deliveredAt });
    if (o.status === "returned") {
      events.push({ kind: "returned", note: o.note ?? null, at: new Date(Math.min(deliveredAt.getTime() + 7 * DAY, now - DAY)) });
    }
  }
  return events;
}

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset && getEnv().NODE_ENV === "production") throw new Error("Refusing to reset with NODE_ENV=production.");
  const db = getDb();

  if (reset) {
    await db.execute(sql`TRUNCATE TABLE order_events, order_items, orders, users, companies, products RESTART IDENTITY CASCADE`);
    console.log("✓ All store data deleted");
  }

  // Catalogue
  for (const p of SEED_PRODUCTS) {
    const values = { ...p, featured: p.featured ?? false };
    await db.insert(products).values(values).onConflictDoUpdate({ target: products.sku, set: values });
  }
  console.log(`✓ ${SEED_PRODUCTS.length} products upserted`);

  // Companies and buyers
  const companyIds = new Map<string, { id: string; discount: number; address: string }>();
  const userIds = new Map<string, string>();
  for (const { buyers, ...c } of SEED_COMPANIES) {
    const [row] = await db
      .insert(companies)
      .values(c)
      .onConflictDoUpdate({ target: companies.slug, set: c })
      .returning({ id: companies.id });
    companyIds.set(c.slug, { id: row.id, discount: c.contractDiscountPct, address: c.shippingAddress });
    for (const b of buyers) {
      const [u] = await db
        .insert(users)
        .values({ ...b, companyId: row.id })
        .onConflictDoUpdate({ target: users.email, set: { name: b.name, jobTitle: b.jobTitle, companyId: row.id } })
        .returning({ id: users.id });
      userIds.set(b.email, u.id);
    }
  }
  console.log(`✓ ${SEED_COMPANIES.length} companies and ${userIds.size} buyers upserted`);

  if ((await db.$count(orders)) > 0) {
    console.log("• Orders already present — skipping (use npm run db:reset to start over)");
    return;
  }

  // Orders
  const catalog = new Map((await db.select().from(products)).map((p) => [p.sku, p]));
  const now = Date.now();
  for (const o of SEED_ORDERS) {
    const company = companyIds.get(o.company)!;
    const lines = o.items.map((i) => {
      const product = catalog.get(i.sku);
      if (!product) throw new Error(`Unknown SKU in seed order: ${i.sku}`);
      return { product, ...i };
    });
    const totals = computeTotals(
      lines.map((l) => ({ unitPriceCents: l.product.priceCents, quantity: l.quantity })),
      company.discount,
    );
    const placedAt = new Date(now - o.placedDaysAgo * DAY - 3 * HOUR);
    const fullyDelivered = o.status === "delivered" || o.status === "returned";

    await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          companyId: company.id,
          userId: userIds.get(o.buyer)!,
          status: o.status,
          poNumber: o.poNumber ?? null,
          paymentMethod: o.paymentMethod,
          ...totals,
          shippingAddress: company.address,
          carrier: o.carrier ?? null,
          trackingNumber: o.trackingNumber ?? null,
          estimatedDelivery: o.etaDays !== undefined ? new Date(now + o.etaDays * DAY) : null,
          placedAt,
        })
        .returning({ id: orders.id });
      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order.id,
          productId: l.product.id,
          sku: l.product.sku,
          name: l.product.name,
          quantity: l.quantity,
          quantityDelivered: l.delivered ?? (fullyDelivered ? l.quantity : 0),
          unitPriceCents: l.product.priceCents,
        })),
      );
      await tx.insert(orderEvents).values(timeline(o, placedAt, now).map((e) => ({ orderId: order.id, ...e })));
    });
  }
  console.log(`✓ ${SEED_ORDERS.length} orders created`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
