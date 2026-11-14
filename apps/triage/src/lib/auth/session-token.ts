import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { DEMO_AGENTS, type DemoAgent } from "@/lib/domain";
import { SESSION_HOURS } from "./constants";

/**
 * Stateless agent session: `base64url(payload).base64url(HMAC-SHA256(payload))`.
 * Tampering with the name or expiry invalidates the signature.
 */

export type AgentSession = { name: DemoAgent };

const payloadSchema = z.strictObject({ name: z.enum(DEMO_AGENTS), exp: z.number().int() });

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function encodeSession(name: DemoAgent, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ name, exp: now + SESSION_HOURS * 3_600_000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string, now = Date.now()): AgentSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const parsed = payloadSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (!parsed.success || parsed.data.exp <= now) return null;
    return { name: parsed.data.name };
  } catch {
    return null;
  }
}

/** Constant-time comparison that doesn't leak the expected length. */
export function passcodeMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
