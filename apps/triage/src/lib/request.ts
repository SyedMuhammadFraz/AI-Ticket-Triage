/**
 * Best-effort client IP for rate limiting. On Vercel (and most managed hosts)
 * `x-forwarded-for` is set by the platform's edge and can be trusted; when
 * self-hosting, make sure your reverse proxy overwrites it.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
