import { z } from "zod";
import { LIMITS, TIERS } from "@/lib/domain";

/**
 * Ticket input rules, shared by the browser (instant feedback) and the server
 * (the authoritative check). Client-safe: depends only on zod and domain constants.
 */

/**
 * Removes control and bidi-override characters (keeping newlines and tabs),
 * normalises line endings and trims. Applied to every free-text field.
 */
export function sanitizeText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

const text = (min: number, max: number, label: string) =>
  z.preprocess(
    sanitizeText,
    z
      .string({ error: `${label} is required` })
      // Empty gets its own message; the first issue is the one shown in the form.
      .min(1, { error: `${label} is required` })
      .min(min, { error: `${label} must be at least ${min} characters` })
      .max(max, { error: `${label} must be at most ${max} characters` }),
  );

export const ticketInputSchema = z.object({
  customerName: text(LIMITS.name.min, LIMITS.name.max, "Name"),
  customerEmail: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z
      .email({ error: "Enter a valid email address" })
      .max(LIMITS.email.max, { error: "Email is too long" }),
  ),
  tier: z.enum(TIERS, { error: "Choose your plan" }),
  subject: text(LIMITS.subject.min, LIMITS.subject.max, "Subject"),
  body: text(LIMITS.body.min, LIMITS.body.max, "Message"),
});

export type TicketInput = z.infer<typeof ticketInputSchema>;

/** The reply an agent approves (an AI draft, edited or not, or a reply written from scratch). */
export const agentReplySchema = text(1, LIMITS.reply.max, "Reply");

/** Optional context an agent adds when escalating. */
export const escalationNoteSchema = z.preprocess(
  sanitizeText,
  z.string().max(LIMITS.escalationNote.max, { error: `Note must be at most ${LIMITS.escalationNote.max} characters` }),
);
