import "server-only";
import { ApiError, GoogleGenAI } from "@google/genai";
import { buildClassifyPrompt, buildDraftPrompt, type BuiltPrompt } from "@/lib/triage/prompts";
import { classificationJsonSchema, draftJsonSchema } from "@/lib/triage/schemas";
import { AiServiceError, type AiProvider, type AiResponse } from "./types";

type GeminiOptions = { apiKey: string; model: string; timeoutMs: number; maxRpm?: number };

/** Earliest time the next request may start. Shared by all providers in this process. */
let nextSlotAt = 0;

/**
 * Spaces requests evenly to stay under a requests-per-minute quota (e.g. the
 * Gemini free tier). Per-process only: enough for the CLI queue runner and a
 * single server; it doesn't coordinate across serverless instances.
 */
async function waitForRateLimitSlot(maxRpm: number | undefined): Promise<void> {
  if (!maxRpm) return;
  const interval = Math.ceil(60_000 / maxRpm);
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + interval;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  readonly model: string;
  private readonly client: GoogleGenAI;
  private readonly timeoutMs: number;
  private readonly maxRpm?: number;

  constructor({ apiKey, model, timeoutMs, maxRpm }: GeminiOptions) {
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.maxRpm = maxRpm;
    this.client = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: timeoutMs,
        // One quick retry for transient errors; the ticket queue handles longer outages.
        retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 4 },
      },
    });
  }

  classify(ticket: Parameters<AiProvider["classify"]>[0]): Promise<AiResponse> {
    return this.generateJson(buildClassifyPrompt(ticket), classificationJsonSchema);
  }

  draftReply(...args: Parameters<AiProvider["draftReply"]>): Promise<AiResponse> {
    return this.generateJson(buildDraftPrompt(...args), draftJsonSchema);
  }

  private async generateJson(prompt: BuiltPrompt, jsonSchema: object): Promise<AiResponse> {
    await waitForRateLimitSlot(this.maxRpm);
    const started = performance.now();
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: prompt.user }] }],
        config: {
          systemInstruction: prompt.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiServiceError("The AI returned an empty response.", "invalid_output");
      }

      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (cause) {
        throw new AiServiceError("The AI returned malformed JSON.", "invalid_output", { cause });
      }

      const usage = response.usageMetadata;
      return {
        data,
        model: this.model,
        latencyMs: Math.round(performance.now() - started),
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
        },
      };
    } catch (err) {
      throw toAiServiceError(err);
    }
  }
}

/** Maps SDK/network errors to messages that are safe to log and show (no keys, no payloads). */
function toAiServiceError(err: unknown): AiServiceError {
  if (err instanceof AiServiceError) return err;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return new AiServiceError("The AI service timed out.", "timeout", { cause: err });
  }
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return new AiServiceError(
        "The AI service rejected the API key (check GEMINI_API_KEY).",
        "config",
        { cause: err },
      );
    }
    if (err.status === 404) {
      return new AiServiceError("The configured AI model was not found (check GEMINI_MODEL).", "config", {
        cause: err,
      });
    }
    if (err.status === 429) {
      return new AiServiceError("The AI service rate limit was reached.", "unavailable", { cause: err });
    }
    return new AiServiceError(`The AI service returned an error (HTTP ${err.status}).`, "unavailable", {
      cause: err,
    });
  }
  return new AiServiceError("The AI service could not be reached.", "unavailable", { cause: err });
}
