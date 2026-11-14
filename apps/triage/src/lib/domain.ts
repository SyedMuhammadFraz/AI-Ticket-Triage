/**
 * Shared domain vocabulary. Safe to import from both server and client code:
 * contains no secrets and no server-only dependencies.
 */

export const TIERS = ["free", "pro", "enterprise"] as const;
export type Tier = (typeof TIERS)[number];

export const CATEGORIES = [
  "delivery",
  "damaged_wrong_item",
  "returns_refunds",
  "billing_invoices",
  "order_changes",
  "account_access",
  "product_question",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const URGENCIES = ["low", "medium", "high", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];

/**
 * Ticket lifecycle:
 *   queued → processing → draft_ready  ─Approve→ sent
 *                │                     └Escalate→ escalated
 *                ├→ needs_review (no draft; a human must write or escalate)
 *                └→ failed ─Retry→ queued
 */
export const TICKET_STATUSES = [
  "queued",
  "processing",
  "draft_ready",
  "needs_review",
  "failed",
  "sent",
  "escalated",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Why a ticket was routed to a human instead of receiving an AI draft. */
export const REVIEW_REASONS = [
  "no_kb_match",
  "low_confidence",
  "suspicious_instructions",
  "insufficient_context",
  "invalid_citation",
  "unsafe_draft",
] as const;
export type ReviewReason = (typeof REVIEW_REASONS)[number];

export const DRAFT_STATUSES = ["pending", "approved", "discarded"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const ACTOR_TYPES = ["customer", "ai", "agent", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const TICKET_SOURCES = ["web_form", "seed", "webhook", "api"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

/** Internal tier keys stay generic; labels match the host store's account levels. */
export const TIER_LABELS: Record<Tier, string> = {
  free: "Starter",
  pro: "Business",
  enterprise: "Enterprise",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  delivery: "Delivery",
  damaged_wrong_item: "Damaged / wrong item",
  returns_refunds: "Returns & refunds",
  billing_invoices: "Billing & invoices",
  order_changes: "Order changes",
  account_access: "Account access",
  product_question: "Product question",
  other: "Other",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  draft_ready: "Draft ready",
  needs_review: "Needs review",
  failed: "Failed",
  sent: "Sent",
  escalated: "Escalated",
};

export const REVIEW_REASON_LABELS: Record<ReviewReason, string> = {
  no_kb_match: "No help article matches this question",
  low_confidence: "AI confidence is below the review threshold",
  suspicious_instructions: "Ticket contains instructions aimed at the AI",
  insufficient_context: "Matched articles don't fully answer the question",
  invalid_citation: "Draft cited an article that wasn't retrieved",
  unsafe_draft: "Draft contained a promise or link not backed by policy",
};

/** Input limits shared by the form (client) and the server-side validation. */
export const LIMITS = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  subject: { min: 5, max: 150 },
  body: { min: 20, max: 5000 },
  reply: { max: 5000 },
  escalationNote: { max: 500 },
} as const;

/** Fictional support agents for the demo sign-in ("acting as"). */
export const DEMO_AGENTS = ["Sam Rivera", "Mei Tanaka", "Omar Haddad"] as const;
export type DemoAgent = (typeof DEMO_AGENTS)[number];

/** Tickets an agent can still act on. */
export const OPEN_STATUSES = ["queued", "processing", "draft_ready", "needs_review", "failed"] as const;

/** Dashboard queue tabs. */
export const QUEUE_FILTERS = {
  open: { label: "Open", statuses: OPEN_STATUSES },
  draft_ready: { label: "Draft ready", statuses: ["draft_ready"] },
  needs_review: { label: "Needs review", statuses: ["needs_review"] },
  failed: { label: "Failed", statuses: ["failed"] },
  sent: { label: "Sent", statuses: ["sent"] },
  escalated: { label: "Escalated", statuses: ["escalated"] },
  all: { label: "All", statuses: TICKET_STATUSES },
} as const satisfies Record<string, { label: string; statuses: readonly TicketStatus[] }>;
export type QueueFilter = keyof typeof QUEUE_FILTERS;
