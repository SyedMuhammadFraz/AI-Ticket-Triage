import { z } from "zod";
import { CATEGORIES, URGENCIES } from "@/lib/domain";

/**
 * Every AI response is validated against these schemas before it touches the
 * database. Anything that doesn't match is treated as an AI failure.
 */
export const classificationSchema = z.strictObject({
  category: z.enum(CATEGORIES),
  urgency: z.enum(URGENCIES),
  confidence: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(600),
  suspicious_instructions: z.boolean(),
});
export type Classification = z.infer<typeof classificationSchema>;

export const draftOutputSchema = z.strictObject({
  reply: z.string().trim().max(4000),
  cited_articles: z.array(z.string().trim().min(1).max(100)).max(8),
  insufficient_context: z.boolean(),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;

/**
 * Hand-written JSON Schemas for the provider's structured-output mode. Kept
 * explicit (rather than generated) so they stay within the subset of JSON
 * Schema that model APIs accept.
 */
export const classificationJsonSchema = {
  type: "object",
  properties: {
    category: { type: "string", enum: [...CATEGORIES] },
    urgency: { type: "string", enum: [...URGENCIES] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
    suspicious_instructions: { type: "boolean" },
  },
  required: ["category", "urgency", "confidence", "reason", "suspicious_instructions"],
  additionalProperties: false,
} as const;

export const draftJsonSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    cited_articles: { type: "array", items: { type: "string" } },
    insufficient_context: { type: "boolean" },
  },
  required: ["reply", "cited_articles", "insufficient_context"],
  additionalProperties: false,
} as const;
