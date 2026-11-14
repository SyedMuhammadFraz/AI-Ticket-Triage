/**
 * Only allow redirects back into the dashboard after sign-in. Anything else
 * (absolute URLs, protocol-relative "//evil.example", other paths) falls back
 * to the dashboard, which prevents open-redirect abuse of `?next=`.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return "/dashboard";
  if (!/^\/dashboard(?:[/?#]|$)/.test(next) || next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return next.slice(0, 500);
}
