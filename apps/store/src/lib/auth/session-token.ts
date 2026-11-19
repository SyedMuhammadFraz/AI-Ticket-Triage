import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Stateless signed session: `base64url(payload).base64url(HMAC-SHA256(payload))`.
 * Only the user id and expiry are stored; everything else is loaded from the
 * database on each request, so a deleted user can't keep using an old cookie.
 */
export { SESSION_COOKIE, SESSION_HOURS } from "./constants";
import { SESSION_HOURS } from "./constants";

const payloadSchema = z.strictObject({ uid: z.uuid(), exp: z.number().int() });

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function encodeSession(userId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + SESSION_HOURS * 3_600_000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string, now = Date.now()): { userId: string } | null {
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
    return { userId: parsed.data.uid };
  } catch {
    return null;
  }
}

/** Only allow redirects to local store pages (no open redirects via ?next=). */
export function safeNextPath(next: unknown, fallback = "/account/orders"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return /^\/(account|cart|products)?(?:[/?#]|$)/.test(next) ? next.slice(0, 300) : fallback;
}
