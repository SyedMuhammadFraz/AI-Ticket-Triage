import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { orderEvents, orderItems, orders, products, users, type Company } from "@/lib/db/schema";
import type { PaymentMethod } from "@/lib/domain";
import { computeTotals } from "@/lib/pricing";
import type { CartLine } from "@/lib/cart";
import { getProductsBySku } from "@/lib/catalog";

/** A checkout problem that's safe to show to the buyer. */
export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/** All order reads are scoped to the buyer's company: colleagues share order history, other companies never see it. */
export async function listCompanyOrders(db: Database, companyId: string) {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      poNumber: orders.poNumber,
      totalCents: orders.totalCents,
      placedAt: orders.placedAt,
      estimatedDelivery: orders.estimatedDelivery,
      buyerName: users.name,
      itemCount: sql<number>`(select coalesce(sum(${orderItems.quantity}), 0) from ${orderItems} where ${orderItems.orderId} = ${orders.id})`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.companyId, companyId))
    .orderBy(desc(orders.placedAt));
}

export async function getCompanyOrder(db: Database, companyId: string, number: number) {
  const [row] = await db
    .select({ order: orders, buyerName: users.name, buyerEmail: users.email })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .where(and(eq(orders.companyId, companyId), eq(orders.number, number)));
  if (!row) return null;

  const [items, events] = await Promise.all([
    db
      .select({ item: orderItems, icon: products.icon, category: products.category })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, row.order.id))
      .orderBy(asc(orderItems.sku)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, row.order.id)).orderBy(asc(orderEvents.at)),
  ]);
  return { ...row, items, events };
}
export type CompanyOrder = NonNullable<Awaited<ReturnType<typeof getCompanyOrder>>>;

export async function countCompanyOrders(db: Database, companyId: string): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders).where(eq(orders.companyId, companyId));
  return row?.n ?? 0;
}

/**
 * Places an order from the cart. Prices come from the database (never the
 * client), the contract discount from the company record, and invoice payment
 * is only allowed for companies on Net-30 terms.
 */
export async function placeOrder(
  db: Database,
  input: { userId: string; company: Company; lines: CartLine[]; poNumber: string | null; paymentMethod: PaymentMethod },
): Promise<{ number: number }> {
  if (input.lines.length === 0) throw new OrderError("Your cart is empty.");
  if (input.paymentMethod === "invoice" && input.company.paymentTerms !== "net30") {
    throw new OrderError("Invoice payment is available on Business and Enterprise accounts.");
  }

  const catalog = await getProductsBySku(db, input.lines.map((l) => l.sku));
  const missing = input.lines.filter((l) => !catalog.has(l.sku));
  if (missing.length) throw new OrderError("Some items in your cart are no longer available. Please review your cart.");

  const priced = input.lines.map((l) => ({ product: catalog.get(l.sku)!, quantity: l.quantity }));
  const totals = computeTotals(
    priced.map((p) => ({ unitPriceCents: p.product.priceCents, quantity: p.quantity })),
    input.company.contractDiscountPct,
  );

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        companyId: input.company.id,
        userId: input.userId,
        status: "processing",
        poNumber: input.poNumber,
        paymentMethod: input.paymentMethod,
        ...totals,
        shippingAddress: input.company.shippingAddress,
        estimatedDelivery: sql`now() + make_interval(days => ${Math.max(...priced.map((p) => p.product.leadTimeDays)) + 1})`,
      })
      .returning({ id: orders.id, number: orders.number });

    await tx.insert(orderItems).values(
      priced.map((p) => ({
        orderId: order.id,
        productId: p.product.id,
        sku: p.product.sku,
        name: p.product.name,
        quantity: p.quantity,
        unitPriceCents: p.product.priceCents,
      })),
    );
    for (const p of priced) {
      await tx
        .update(products)
        .set({ stock: sql`greatest(${products.stock} - ${p.quantity}, 0)` })
        .where(eq(products.id, p.product.id));
    }
    await tx.insert(orderEvents).values([
      { orderId: order.id, kind: "placed", note: input.poNumber ? `PO ${input.poNumber}` : null },
      ...(input.paymentMethod === "invoice"
        ? [{ orderId: order.id, kind: "approved", note: "Net-30 invoice account approved" }]
        : [{ orderId: order.id, kind: "approved", note: "Card payment authorised" }]),
    ]);
    return { number: order.number };
  });
}
