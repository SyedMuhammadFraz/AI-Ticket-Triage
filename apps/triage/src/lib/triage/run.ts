import "server-only";
import { getAiProvider } from "@/lib/ai";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { PipelineDeps } from "./pipeline";

/** Production wiring for the pipeline: real database, configured AI provider, env thresholds. */
export function defaultPipelineDeps(): PipelineDeps {
  const env = getEnv();
  return {
    db: getDb(),
    ai: getAiProvider(),
    config: {
      minConfidence: env.TRIAGE_MIN_CONFIDENCE,
      kbMinScore: env.KB_MIN_SCORE,
      maxAttempts: env.TRIAGE_MAX_ATTEMPTS,
    },
  };
}
