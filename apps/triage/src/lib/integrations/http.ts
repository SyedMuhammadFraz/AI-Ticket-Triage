import "server-only";
import type { ZodError } from "zod";
import { getDb, type Database } from "@/lib/db";
import type { ApiClient } from "@/lib/db/schema";
import { getEnv } from "@/lib/env";
import { authenticateApiKey, type ApiScope } from "./api-keys";

const NO_STORE = { "Cache-Control": "no-store" };
export const MAX_BODY_BYTES = 64 * 1024;

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

/** One error shape for every endpoint: { error: { code, message, details? } }. */
export function apiError(status: number, code: string, message: string, details?: unknown): Response {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: NO_STORE });
}

export function validationError(error: ZodError): Response {
  return apiError(
    422,
    "validation_failed",
    "The request body is invalid.",
    error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export class BodyError extends Error {}

/** Reads a JSON body with a hard size cap (content-length is checked first, then the real size). */
export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) throw new BodyError("Request body too large.");
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new BodyError("Request body too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new BodyError("Request body must be valid JSON.");
  }
}

/** Authenticates the API key for `scope`, then runs the handler. Unexpected errors become a generic 500. */
export async function withApiAuth(
  request: Request,
  scope: ApiScope,
  handler: (ctx: { client: ApiClient; db: Database }) => Promise<Response>,
): Promise<Response> {
  try {
    const db = getDb();
    const auth = await authenticateApiKey(db, request.headers.get("authorization"), scope, getEnv().API_RATE_LIMIT_PER_MINUTE);
    if (!auth.ok) {
      const res = apiError(auth.status, auth.code, auth.message);
      if (auth.status === 401) res.headers.set("WWW-Authenticate", 'Bearer realm="triage-desk"');
      if (auth.status === 429) res.headers.set("Retry-After", "60");
      return res;
    }
    return await handler({ client: auth.client, db });
  } catch (err) {
    if (err instanceof BodyError) return apiError(400, "bad_request", err.message);
    console.error("[api] unhandled error:", err);
    return apiError(500, "internal_error", "Something went wrong.");
  }
}
