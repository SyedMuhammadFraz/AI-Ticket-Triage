import { z } from "zod";
import { sanitizeText } from "./schema";

/**
 * Structured context a host app attaches to a ticket — e.g. the order the
 * customer is asking about. It comes from the host's backend (authenticated
 * with an API key), not from the customer, but it is still validated, size
 * limited and sanitised before it reaches the AI or the dashboard.
 */
const str = (max: number) => z.preprocess(sanitizeText, z.string().max(max));
const isoDate = z.iso.datetime({ offset: true });

export const ticketContextSchema = z.strictObject({
  company: z
    .strictObject({
      name: str(120),
      tierLabel: str(40).optional(),
      accountManager: str(80).nullish(),
      employees: z.number().int().min(0).max(10_000_000).optional(),
    })
    .optional(),
  order: z
    .strictObject({
      number: str(40),
      status: str(40),
      placedAt: isoDate,
      estimatedDelivery: isoDate.nullish(),
      poNumber: str(60).nullish(),
      paymentMethod: str(30).optional(),
      totalCents: z.number().int().min(0).max(1_000_000_000).optional(),
      carrier: str(60).nullish(),
      trackingNumber: str(60).nullish(),
      items: z
        .array(
          z.strictObject({
            sku: str(40),
            name: str(160),
            quantity: z.number().int().min(0).max(100_000),
            quantityDelivered: z.number().int().min(0).max(100_000).optional(),
          }),
        )
        .max(50),
      events: z
        .array(z.strictObject({ kind: str(40), note: str(300).nullish(), at: isoDate }))
        .max(30)
        .optional(),
    })
    .optional(),
});

export type TicketContext = z.infer<typeof ticketContextSchema>;

/** Hard cap on the serialised context so a host can't flood the prompt. */
export const MAX_CONTEXT_BYTES = 16_000;

const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmt = (iso: string) => day.format(new Date(iso));

/** Plain-text rendering of the context for prompts (stable, compact, no markup). */
export function formatContextForPrompt(ctx: TicketContext | null | undefined, now = new Date()): string | null {
  if (!ctx || (!ctx.company && !ctx.order)) return null;
  const lines: string[] = [`Today: ${fmt(now.toISOString())}`];
  if (ctx.company) {
    const c = ctx.company;
    lines.push(
      `Company: ${c.name}${c.tierLabel ? ` (${c.tierLabel} account)` : ""}${c.accountManager ? `, account manager ${c.accountManager}` : ""}`,
    );
  }
  if (ctx.order) {
    const o = ctx.order;
    lines.push(`Order ${o.number}: status ${o.status}, placed ${fmt(o.placedAt)}`);
    if (o.estimatedDelivery) lines.push(`Estimated delivery: ${fmt(o.estimatedDelivery)}`);
    if (o.poNumber) lines.push(`PO number: ${o.poNumber}`);
    if (o.paymentMethod) lines.push(`Payment: ${o.paymentMethod}`);
    if (o.carrier) lines.push(`Carrier: ${o.carrier}${o.trackingNumber ? `, tracking ${o.trackingNumber}` : ""}`);
    if (o.items.length) {
      lines.push("Items:");
      for (const i of o.items) {
        const delivered = i.quantityDelivered !== undefined ? ` (${i.quantityDelivered} delivered)` : "";
        lines.push(`- ${i.quantity} × ${i.name} [${i.sku}]${delivered}`);
      }
    }
    if (o.events?.length) {
      lines.push("Order history:");
      for (const e of o.events.slice(-8)) lines.push(`- ${fmt(e.at)}: ${e.kind}${e.note ? ` — ${e.note}` : ""}`);
    }
  }
  return lines.join("\n");
}
