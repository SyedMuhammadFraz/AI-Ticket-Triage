import { z } from "zod";

/** Server-side configuration for the store, validated on first use. Never imported by client code. */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine((v) => /^postgres(ql)?:\/\//.test(v), "DATABASE_URL must be a postgres:// URL"),
  /** Signs customer sessions. */
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),

  /** Triage Desk integration. Run `npm run integration:connect-store -w apps/triage` to fill these in. */
  TRIAGE_API_URL: z.url().optional(),
  TRIAGE_API_KEY: z.string().regex(/^td_live_[A-Za-z0-9_-]{32,64}$/, "TRIAGE_API_KEY looks malformed").optional(),
  TRIAGE_WEBHOOK_SECRET: z.string().min(32, "TRIAGE_WEBHOOK_SECRET must be at least 32 characters").optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Support features need all three Triage Desk settings. */
export function supportConfigured(env: Env): env is Env & { TRIAGE_API_URL: string; TRIAGE_API_KEY: string; TRIAGE_WEBHOOK_SECRET: string } {
  return Boolean(env.TRIAGE_API_URL && env.TRIAGE_API_KEY && env.TRIAGE_WEBHOOK_SECRET);
}

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
    throw new Error(`Invalid store configuration:\n${problems}\nSee apps/store/.env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCache(): void {
  cached = undefined;
}
