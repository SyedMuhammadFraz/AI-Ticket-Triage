import { z } from "zod";

/**
 * Server-side configuration, validated once on first use. Secrets live only in
 * environment variables and are never imported by client components.
 * (Next.js only exposes variables prefixed with NEXT_PUBLIC_ to the browser;
 * none of these are.)
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgres:// URL"),

    /** Used to hash submitter IP addresses for rate limiting (and, later, to sign sessions). */
    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),

    AI_PROVIDER: z.enum(["mock", "gemini"]).default("mock"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    GEMINI_MODEL: z.string().min(1).default("gemini-3.5-flash-lite"),
    AI_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(25_000),
    /** Optional cap on AI requests per minute (per process), e.g. to fit a free-tier quota. */
    AI_MAX_RPM: z.coerce.number().int().min(1).max(10_000).optional(),
    /** Demo switch: makes every AI call fail so the safe-failure path can be shown. */
    AI_FORCE_FAIL: z.stringbool().default(false),

    /** Classifications below this confidence are routed to a human. */
    TRIAGE_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
    /**
     * Minimum knowledge-base relevance (text score + same-category boost) for an
     * article to count as a match. Tuned on the sample tickets: correct articles
     * score ≥ 0.31 with the boost, unrelated questions stay below 0.1.
     */
    KB_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.25),
    /** How many times the pipeline retries a ticket automatically before marking it failed. */
    TRIAGE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),

    /** Ticket submissions allowed per IP address per 10 minutes. */
    SUBMISSION_RATE_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),

    /** Bearer token for the queue-processing endpoint (e.g. a Vercel Cron job). */
    CRON_SECRET: z.string().min(32).optional(),

    /**
     * Shared passcode for the agent dashboard. Leave unset for a local demo;
     * set it on any public deployment so strangers can't approve replies.
     */
    AGENT_PASSCODE: z.string().min(8, "AGENT_PASSCODE must be at least 8 characters").optional(),

    /** Requests per minute allowed per API key. */
    API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(120),
    /**
     * Allow webhook URLs on private networks / plain http (needed for localhost
     * in development). Defaults to true outside production, false in production.
     */
    WEBHOOK_ALLOW_PRIVATE_NETWORK: z.stringbool().optional(),

    /** Optional list prices (USD per 1M tokens) so the stats bar can estimate AI cost. */
    AI_PRICE_INPUT_PER_MTOK: z.coerce.number().min(0).optional(),
    AI_PRICE_OUTPUT_PER_MTOK: z.coerce.number().min(0).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message: "GEMINI_API_KEY is required when AI_PROVIDER=gemini",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function allowPrivateWebhooks(env: Env): boolean {
  return env.WEBHOOK_ALLOW_PRIVATE_NETWORK ?? env.NODE_ENV !== "production";
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only variable names and messages are printed — never values.
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid server configuration:\n${problems}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache(): void {
  cached = undefined;
}
