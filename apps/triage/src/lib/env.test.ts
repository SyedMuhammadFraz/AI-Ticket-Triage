import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAiProvider } from "@/lib/ai";
import { AiServiceError } from "@/lib/ai/types";
import { getEnv, resetEnvCache } from "./env";

const SECRET = "x".repeat(40);

beforeEach(() => {
  resetEnvCache();
  vi.stubEnv("DATABASE_URL", "postgres://u:p@localhost:5432/db");
  vi.stubEnv("APP_SECRET", SECRET);
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("AI_FORCE_FAIL", "false");
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("getEnv", () => {
  it("applies safe defaults", () => {
    const env = getEnv();
    expect(env.AI_PROVIDER).toBe("mock");
    expect(env.TRIAGE_MIN_CONFIDENCE).toBe(0.6);
    expect(env.AI_FORCE_FAIL).toBe(false);
  });

  it("names the problem variables without echoing their values", () => {
    vi.stubEnv("APP_SECRET", "too-short-secret-value");
    vi.stubEnv("DATABASE_URL", "mysql://root:hunter2@db/x");
    expect(() => getEnv()).toThrow(/APP_SECRET/);
    resetEnvCache();
    try {
      getEnv();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).not.toContain("hunter2");
      expect(message).not.toContain("too-short-secret-value");
    }
  });

  it("requires an API key when the Gemini provider is selected", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(() => getEnv()).toThrow(/GEMINI_API_KEY/);
  });
});

describe("getAiProvider", () => {
  it("uses the offline mock by default", () => {
    expect(getAiProvider().name).toBe("mock");
  });

  it("AI_FORCE_FAIL makes every call fail with a safe, displayable error", async () => {
    vi.stubEnv("AI_FORCE_FAIL", "true");
    const ai = getAiProvider();
    const ticket = { subject: "s", body: "b", customerName: "n", tier: "free" as const };
    await expect(ai.classify(ticket)).rejects.toBeInstanceOf(AiServiceError);
    await expect(ai.draftReply(ticket, [])).rejects.toThrow(/simulated outage/);
  });
});
