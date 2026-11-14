import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  primaryKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { TicketContext } from "@/lib/tickets/context";
import {
  ACTOR_TYPES,
  CATEGORIES,
  DRAFT_STATUSES,
  REVIEW_REASONS,
  TICKET_SOURCES,
  TICKET_STATUSES,
  TIERS,
  URGENCIES,
} from "@/lib/domain";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const tierEnum = pgEnum("tier", TIERS);
export const categoryEnum = pgEnum("category", CATEGORIES);
export const urgencyEnum = pgEnum("urgency", URGENCIES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const reviewReasonEnum = pgEnum("review_reason", REVIEW_REASONS);
export const draftStatusEnum = pgEnum("draft_status", DRAFT_STATUSES);
export const actorTypeEnum = pgEnum("actor_type", ACTOR_TYPES);
export const ticketSourceEnum = pgEnum("ticket_source", TICKET_SOURCES);

export type KbMatch = { articleId: string; slug: string; title: string; score: number };

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", ["pending", "delivered", "dead"]);

/** A host application (e.g. the store) that talks to Triage Desk through the REST API. */
export const apiClients = pgTable("api_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** First characters of the key, safe to display (e.g. "td_live_AbC12345"). */
  keyPrefix: text("key_prefix").notNull(),
  /** SHA-256 of the full key. The key itself is shown once and never stored. */
  keyHash: text("key_hash").notNull().unique(),
  scopes: text("scopes").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-friendly reference shown to customers and agents, e.g. #1042. */
    number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 1001 }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    tier: tierEnum("tier").notNull(),
    source: ticketSourceEnum("source").notNull().default("web_form"),

    status: ticketStatusEnum("status").notNull().default("queued"),
    category: categoryEnum("category"),
    urgency: urgencyEnum("urgency"),
    confidence: real("confidence"),
    triageReason: text("triage_reason"),
    priorityScore: integer("priority_score").notNull().default(0),
    reviewReasons: reviewReasonEnum("review_reasons").array().notNull().default(sql`'{}'`),
    kbMatches: jsonb("kb_matches").$type<KbMatch[]>().notNull().default([]),

    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /** Set while a worker holds the ticket; lets a crashed run be reclaimed. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    /** HMAC of the submitter's IP, for rate limiting without storing the IP itself. */
    submitterIpHash: text("submitter_ip_hash"),

    /** Set when the ticket came from a host app through the API. */
    apiClientId: uuid("api_client_id").references(() => apiClients.id),
    /** The host app's own id for this ticket — makes creation idempotent. */
    externalId: text("external_id"),
    /** Order/company context supplied by the host app (validated). */
    context: jsonb("context").$type<TicketContext>(),

    /** When the latest triage run started — "time to draft" is measured from here. */
    triageStartedAt: timestamp("triage_started_at", { withTimezone: true }),
    triagedAt: timestamp("triaged_at", { withTimezone: true }),
    draftedAt: timestamp("drafted_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("tickets_queue_idx").on(t.status, t.priorityScore.desc(), t.createdAt),
    index("tickets_rate_limit_idx").on(t.submitterIpHash, t.createdAt),
    uniqueIndex("tickets_client_external_id").on(t.apiClientId, t.externalId),
  ],
);

export const kbArticles = pgTable(
  "kb_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    category: categoryEnum("category").notNull(),
    keywords: text("keywords").notNull().default(""),
    body: text("body").notNull(),
    search: tsvector("search")
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', keywords), 'A') || setweight(to_tsvector('english', body), 'B')`,
      ),
    ...timestamps,
  },
  (t) => [index("kb_articles_search_idx").using("gin", t.search)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    /** Exactly what the AI wrote — never modified, so edits can be measured. */
    aiBody: text("ai_body").notNull(),
    /** The agent's edited version, if any. */
    finalBody: text("final_body"),
    citedArticleIds: uuid("cited_article_ids").array().notNull(),
    status: draftStatusEnum("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // The database itself guarantees a ticket never has two competing drafts.
    uniqueIndex("drafts_one_pending_per_ticket")
      .on(t.ticketId)
      .where(sql`status = 'pending'`),
  ],
);

/** Simulated outbound email. Only the Approve action writes here. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").references(() => drafts.id),
    body: text("body").notNull(),
    wasEdited: boolean("was_edited").notNull().default(false),
    sentBy: text("sent_by").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("messages_one_per_ticket").on(t.ticketId)],
);

/** Append-only record of every AI action and human decision. */
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    // clock_timestamp() (not now()) so events written in one transaction still sort in order.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
  },
  (t) => [index("audit_events_ticket_idx").on(t.ticketId, t.createdAt)],
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type KbArticle = typeof kbArticles.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

/** Fixed one-minute windows for per-API-key rate limiting. */
export const apiRateLimits = pgTable(
  "api_rate_limits",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.windowStart] })],
);

/** Where a host app wants to receive events. The signing secret is encrypted at rest. */
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiClientId: uuid("api_client_id")
    .notNull()
    .references(() => apiClients.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  secretCiphertext: text("secret_ciphertext").notNull(),
  events: text("events").array().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Transactional outbox: an event row is written in the same transaction as the
 * state change it describes, then delivered (and retried) separately.
 * The row id is the event id receivers use to de-duplicate.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    lastStatusCode: integer("last_status_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [index("webhook_deliveries_due_idx").on(t.status, t.nextAttemptAt)],
);

export type ApiClient = typeof apiClients.$inferSelect;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
