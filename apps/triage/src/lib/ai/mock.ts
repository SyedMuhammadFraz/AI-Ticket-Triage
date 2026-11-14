import type { Category, Urgency } from "@/lib/domain";
import { detectInjection } from "@/lib/triage/guards";
import type { PromptArticle, PromptTicket } from "@/lib/triage/prompts";
import type { AiProvider, AiResponse } from "./types";

/**
 * Deterministic, offline stand-in for a real model. It lets the whole app run
 * and be tested without an API key. It is intentionally simple — rule-based
 * keyword matching — and is clearly labelled "mock" everywhere it appears.
 */

const CATEGORY_RULES: Array<{ category: Category; pattern: RegExp }> = [
  { category: "returns_refunds", pattern: /\breturn|refund|credit note|money back|send (it|them) back|swap\b/i },
  { category: "damaged_wrong_item", pattern: /\bdamaged|broken|cracked|dented|crushed|defective|faulty|wrong item|missing item/i },
  { category: "order_changes", pattern: /\bcancel|change (the|my|our) (order|address)|add (an )?item|modify/i },
  { category: "delivery", pattern: /\bdeliver|tracking|shipment|shipped|package|arriv|late\b|delay|\beta\b|courier|carrier/i },
  { category: "billing_invoices", pattern: /\binvoice|po number|purchase order|payment|charged|card\b|vat|tax id|net.?30|credit\b/i },
  { category: "account_access", pattern: /\bsign ?in|log ?in|password|locked out|give (him|her|them) access|access to|permission/i },
  { category: "product_question", pattern: /\bcompatib|toner|cartridge|spec(ification)?s?\b|which (model|printer)|quote|bulk|in stock|assembly/i },
];

function classifyCategory(text: string): { category: Category; confidence: number } {
  const hits = CATEGORY_RULES.filter(({ pattern }) => pattern.test(text));
  if (hits.length === 0) return { category: "other", confidence: 0.45 };
  // Fewer competing matches → more confident.
  return { category: hits[0].category, confidence: hits.length === 1 ? 0.9 : 0.75 };
}

function classifyUrgency(text: string): Urgency {
  const timePressure = /\basap|urgent|immediately|right now|today|tomorrow|monday|opens|opening|in (an|1|one) hour|deadline|launch\b/i.test(text);
  const blocked = /\blocked|read-only|can't|cannot|blocking|nobody|nowhere|whole team|running low|stuck|stopped\b/i.test(text);
  if (timePressure && blocked) return "urgent";
  if (blocked) return "high";
  if (/\bhow (do|can) (i|we)|can i\b|wondering|question|invoice|vat\b/i.test(text)) return "low";
  return "medium";
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

export const MOCK_MODEL = "mock-rules-v1";

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  readonly model = MOCK_MODEL;

  async classify(ticket: PromptTicket): Promise<AiResponse> {
    const text = `${ticket.subject}\n${ticket.body}`;
    const { category, confidence } = classifyCategory(text);
    const urgency = classifyUrgency(text);
    const suspicious = detectInjection(text).length > 0;
    return this.respond(
      {
        category,
        urgency,
        confidence,
        reason: `Mock classifier: keyword rules matched "${category}" with ${urgency} urgency.`,
        suspicious_instructions: suspicious,
      },
      text,
    );
  }

  async draftReply(ticket: PromptTicket, articles: PromptArticle[]): Promise<AiResponse> {
    const primary = articles[0];
    if (!primary) {
      return this.respond({ reply: "", cited_articles: [], insufficient_context: true }, ticket.body);
    }
    const firstName = ticket.customerName.trim().split(/\s+/)[0] ?? "there";
    const reply = [
      `Hi ${firstName},`,
      "",
      `Thanks for getting in touch about "${ticket.subject}". Here's what our help article "${primary.title}" says:`,
      "",
      stripMarkdown(primary.body),
      "",
      "If anything is still unclear, just reply to this email and we'll be happy to help.",
      "",
      "Best regards,",
      "The Fernway Support Team",
    ].join("\n");
    return this.respond(
      { reply, cited_articles: [primary.slug], insufficient_context: false },
      ticket.body + primary.body,
    );
  }

  private respond(data: unknown, inputText: string): AiResponse {
    return {
      data,
      model: this.model,
      latencyMs: 5,
      usage: {
        inputTokens: Math.ceil(inputText.length / 4),
        outputTokens: Math.ceil(JSON.stringify(data).length / 4),
      },
    };
  }
}
