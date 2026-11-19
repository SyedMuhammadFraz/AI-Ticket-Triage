import "server-only";
import { z } from "zod";
import { getEnv, supportConfigured } from "@/lib/env";

/**
 * Thin client for Triage Desk's REST API. Server-side only: the API key never
 * reaches the browser. Every response is validated before use.
 */

export class TriageApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "TriageApiError";
  }
}

const remoteTicketSchema = z.object({
  ticket: z.object({ id: z.uuid(), number: z.number().int(), status: z.string() }),
});

const articlesSchema = z.object({
  articles: z.array(
    z.object({ slug: z.string(), title: z.string(), category: z.string(), body: z.string(), updatedAt: z.string() }),
  ),
});
export type HelpArticle = z.infer<typeof articlesSchema>["articles"][number];

function config() {
  const env = getEnv();
  if (!supportConfigured(env)) throw new TriageApiError("Support integration is not configured.", null);
  return { base: env.TRIAGE_API_URL.replace(/\/$/, ""), key: env.TRIAGE_API_KEY };
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const { base, key } = config();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      redirect: "error",
    });
  } catch (err) {
    throw new TriageApiError(`Triage Desk is unreachable (${err instanceof Error ? err.name : "error"}).`, null);
  }
  if (!res.ok) {
    const code = await res
      .json()
      .then((b: { error?: { code?: string } }) => b?.error?.code)
      .catch(() => undefined);
    throw new TriageApiError(`Triage Desk responded with HTTP ${res.status}${code ? ` (${code})` : ""}.`, res.status);
  }
  return res.json();
}

export type CreateRemoteTicket = {
  externalId: string;
  customerName: string;
  customerEmail: string;
  tier: "free" | "pro" | "enterprise";
  subject: string;
  body: string;
  context?: unknown;
};

export async function createRemoteTicket(input: CreateRemoteTicket) {
  const parsed = remoteTicketSchema.safeParse(await call("/api/v1/tickets", { method: "POST", body: JSON.stringify(input) }));
  if (!parsed.success) throw new TriageApiError("Unexpected response from Triage Desk.", null);
  return parsed.data.ticket;
}

let articleCache: { at: number; articles: HelpArticle[] } | null = null;
const ARTICLE_TTL_MS = 60_000;

/** Help-centre articles, cached briefly in memory. Returns null if Triage Desk can't be reached. */
export async function listHelpArticles(): Promise<HelpArticle[] | null> {
  if (articleCache && Date.now() - articleCache.at < ARTICLE_TTL_MS) return articleCache.articles;
  try {
    const parsed = articlesSchema.safeParse(await call("/api/v1/kb/articles"));
    if (!parsed.success) return null;
    articleCache = { at: Date.now(), articles: parsed.data.articles };
    return parsed.data.articles;
  } catch (err) {
    console.error("[help] could not load articles:", err instanceof Error ? err.message : err);
    return articleCache?.articles ?? null;
  }
}
