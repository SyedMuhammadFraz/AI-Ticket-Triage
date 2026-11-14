import "server-only";
import { getEnv } from "@/lib/env";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { AiServiceError, type AiProvider } from "./types";

/** Wraps a provider so every call fails — used to demonstrate safe failure. */
class FailingProvider implements AiProvider {
  constructor(private readonly inner: AiProvider) {}
  get name() {
    return this.inner.name;
  }
  get model() {
    return this.inner.model;
  }
  async classify(): Promise<never> {
    throw new AiServiceError("The AI service is unavailable (simulated outage).", "unavailable");
  }
  async draftReply(): Promise<never> {
    throw new AiServiceError("The AI service is unavailable (simulated outage).", "unavailable");
  }
}

export function getAiProvider(): AiProvider {
  const env = getEnv();
  const provider: AiProvider =
    env.AI_PROVIDER === "gemini"
      ? new GeminiProvider({
          apiKey: env.GEMINI_API_KEY!, // presence enforced by env validation
          model: env.GEMINI_MODEL,
          timeoutMs: env.AI_TIMEOUT_MS,
          maxRpm: env.AI_MAX_RPM,
        })
      : new MockProvider();
  return env.AI_FORCE_FAIL ? new FailingProvider(provider) : provider;
}

export { AiServiceError, type AiProvider } from "./types";
