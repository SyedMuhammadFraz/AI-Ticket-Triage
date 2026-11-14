import { NextResponse, type NextRequest } from "next/server";
import { AGENT_COOKIE } from "@/lib/auth/constants";

/**
 * Per-request Content Security Policy with a fresh nonce. Next.js reads the
 * nonce from the request's CSP header and applies it to its own scripts, so
 * only scripts we ship can run — injected <script> tags are blocked.
 *
 * Styles allow 'unsafe-inline' because React style attributes and the UI
 * library's injected styles need it; style injection is far lower risk than
 * script injection, and scripts remain strictly nonce-gated.
 */
export function proxy(request: NextRequest) {
  // Fast path only: send visitors without a session cookie to sign-in. The
  // dashboard page and every Server Action still verify the signed session.
  if (request.nextUrl.pathname.startsWith("/dashboard") && !request.cookies.has(AGENT_COOKIE)) {
    const signIn = new URL("/agent/sign-in", request.url);
    signIn.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, static assets and prefetches.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
