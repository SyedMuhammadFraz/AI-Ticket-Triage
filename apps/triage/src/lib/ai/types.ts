import type { PromptArticle, PromptTicket } from "@/lib/triage/prompts";

export type AiUsage = { inputTokens: number; outputTokens: number };

/**
 * Raw provider output. `data` is deliberately `unknown`: providers are not
 * trusted, and the pipeline validates every response with zod before use.
 */
export type AiResponse = {
  data: unknown;
  usage: AiUsage;
  latencyMs: number;
  model: string;
};

export interface AiProvider {
  readonly name: "mock" | "gemini";
  readonly model: string;
  classify(ticket: PromptTicket): Promise<AiResponse>;
  draftReply(ticket: PromptTicket, articles: PromptArticle[]): Promise<AiResponse>;
}

/** Errors from the AI layer. `message` is safe to store and show to agents. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "unavailable" | "invalid_output" | "config",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AiServiceError";
  }
}
