import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { COMPANY_TIERS, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_TERMS, SUPPORT_STATUSES } from "@/lib/domain";

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const companyTierEnum = pgEnum("company_tier", COMPANY_TIERS);
export const paymentTermsEnum = pgEnum("payment_terms", PAYMENT_TERMS);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);

/** A business customer. Every buyer belongs to one company and sees that company's orders. */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tier: companyTierEnum("tier").notNull(),
  paymentTerms: paymentTermsEnum("payment_terms").notNull(),
  contractDiscountPct: integer("contract_discount_pct").notNull().default(0),
  accountManager: text("account_manager"),
  industry: text("industry").notNull(),
  employees: integer("employees").notNull(),
  shippingAddress: text("shipping_address").notNull(),
  createdAt,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    jobTitle: text("job_title").notNull(),
    createdAt,
  },
  (t) => [index("users_company_idx").on(t.companyId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    unitLabel: text("unit_label").notNull(),
    priceCents: integer("price_cents").notNull(),
    stock: integer("stock").notNull(),
    leadTimeDays: integer("lead_time_days").notNull().default(1),
    icon: text("icon").notNull(),
    featured: boolean("featured").notNull().default(false),
    specs: jsonb("specs").$type<Array<[string, string]>>().notNull().default([]),
    createdAt,
  },
  (t) => [index("products_category_idx").on(t.category)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Customer-facing number, shown as FO-50001. */
    number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 50001 }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum("status").notNull().default("processing"),
    poNumber: text("po_number"),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    shippingAddress: text("shipping_address").notNull(),
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    estimatedDelivery: timestamp("estimated_delivery", { withTimezone: true }),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("orders_company_idx").on(t.companyId, t.placedAt.desc())],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    /** Snapshot of the product at purchase time, so later catalogue edits don't rewrite history. */
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    quantityDelivered: integer("quantity_delivered").notNull().default(0),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** Order timeline (placed, shipped, delayed…), shown to buyers and passed to support as context. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    note: text("note"),
    at: timestamp("at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.at)],
);

export const supportStatusEnum = pgEnum("support_status", SUPPORT_STATUSES);

/**
 * The store's own record of a support request. The AI triage and agent review
 * happen in Triage Desk; this row tracks the link and what the buyer sees.
 */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Customer-facing reference, shown as SR-7001. Also sent to Triage Desk as the externalId. */
    number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 7001 }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    orderId: uuid("order_id").references(() => orders.id),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: supportStatusEnum("status").notNull().default("submitted"),
    triageTicketId: uuid("triage_ticket_id").unique(),
    triageNumber: integer("triage_number"),
    syncAttempts: integer("sync_attempts").notNull().default(0),
    lastSyncError: text("last_sync_error"),
    replyBody: text("reply_body"),
    repliedBy: text("replied_by"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    replySeenAt: timestamp("reply_seen_at", { withTimezone: true }),
    createdAt,
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("support_tickets_user_idx").on(t.userId, t.createdAt.desc())],
);

/** Webhook events already applied — makes at-least-once delivery safe (each event id is processed once). */
export const webhookReceipts = pgTable("webhook_receipts", {
  eventId: uuid("event_id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
