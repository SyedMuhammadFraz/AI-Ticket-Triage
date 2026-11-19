import { createHmac, timingSafeEqual } from "node:crypto";

/** Max age of a webhook signature; older (or future-dated) requests are rejected as possible replays. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verifies `Triage-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256("<t>.<raw body>")>`.
 * Uses the raw request body exactly as received. Multiple v1 values are
 * accepted so the sender can rotate secrets.
 */
export function verifyTriageSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const candidates = parts.filter(([k, v]) => k === "v1" && /^[0-9a-f]{64}$/.test(v ?? "")).map(([, v]) => v);
  if (!Number.isInteger(t) || candidates.length === 0) return false;
  if (Math.abs(nowSeconds - t) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"));
  return candidates.some((c) => {
    const actual = Buffer.from(c);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
