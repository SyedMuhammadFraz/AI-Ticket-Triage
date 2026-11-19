/**
 * Fernway Office Supply — a fictional B2B store. Client-safe constants only.
 */

export const STORE_NAME = "Fernway Office Supply";

export const COMPANY_TIERS = ["starter", "business", "enterprise"] as const;
export type CompanyTier = (typeof COMPANY_TIERS)[number];

export const TIER_LABELS: Record<CompanyTier, string> = {
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
};

/** Which Triage Desk tier each account level maps to (used when tickets are created). */
export const TRIAGE_TIER: Record<CompanyTier, "free" | "pro" | "enterprise"> = {
  starter: "free",
  business: "pro",
  enterprise: "enterprise",
};

export const PAYMENT_TERMS = ["card", "net30"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_METHODS = ["card", "invoice"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PRODUCT_CATEGORIES = [
  { slug: "paper", label: "Paper & notebooks", blurb: "Copy paper, pads and sticky notes" },
  { slug: "writing", label: "Pens & markers", blurb: "Pens, highlighters, whiteboard markers" },
  { slug: "ink-toner", label: "Ink & toner", blurb: "Cartridges, toner and drums" },
  { slug: "desk", label: "Desk & filing", blurb: "Staplers, trays, labels and organisers" },
  { slug: "furniture", label: "Furniture", blurb: "Chairs, desks and storage" },
  { slug: "tech", label: "Tech & accessories", blurb: "Monitors, docks, headsets, cables" },
  { slug: "breakroom", label: "Breakroom & cleaning", blurb: "Coffee, cups, wipes and soap" },
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS = PRODUCT_CATEGORIES.map((c) => c.slug) as [ProductCategory, ...ProductCategory[]];

export function categoryLabel(slug: string): string {
  return PRODUCT_CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

/**
 * Order lifecycle:
 *   processing → shipped → delivered
 *                  ├→ delayed → shipped/delivered
 *                  └→ partially_delivered → delivered
 *   processing → cancelled;  delivered → returned
 */
export const ORDER_STATUSES = [
  "processing",
  "shipped",
  "delayed",
  "partially_delivered",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  processing: "Processing",
  shipped: "Shipped",
  delayed: "Delayed",
  partially_delivered: "Partially delivered",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ORDER_EVENT_KINDS = [
  "placed",
  "approved",
  "packed",
  "shipped",
  "delayed",
  "partially_delivered",
  "delivered",
  "cancelled",
  "returned",
] as const;
export type OrderEventKind = (typeof ORDER_EVENT_KINDS)[number];

export function formatOrderNumber(n: number): string {
  return `FO-${n}`;
}

/** Parses "FO-50012" or "50012" into 50012. */
export function parseOrderNumber(value: string): number | null {
  const m = /^(?:FO-)?(\d{5,7})$/i.exec(value.trim());
  return m ? Number(m[1]) : null;
}

export const LIMITS = {
  cartLines: 50,
  quantity: { min: 1, max: 999 },
  poNumber: { max: 40 },
  search: { max: 80 },
} as const;

/** A support request as the buyer sees it. Status mirrors Triage Desk via signed webhooks. */
export const SUPPORT_STATUSES = ["submitted", "received", "in_review", "answered", "escalated"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/** Customer-facing wording (internal states like "submitted" vs "received" look the same to buyers). */
export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  submitted: "Received",
  received: "Received",
  in_review: "Being reviewed",
  answered: "Answered",
  escalated: "With a specialist",
};

export function formatSupportNumber(n: number): string {
  return `SR-${n}`;
}

export const SUPPORT_LIMITS = {
  subject: { min: 5, max: 150 },
  body: { min: 20, max: 5000 },
  perUserPerHour: 10,
} as const;
