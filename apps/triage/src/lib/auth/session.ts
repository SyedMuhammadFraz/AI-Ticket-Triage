import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { DemoAgent } from "@/lib/domain";
import { getEnv } from "@/lib/env";
import { AGENT_COOKIE, SESSION_HOURS } from "./constants";
import { decodeSession, encodeSession, type AgentSession } from "./session-token";

/**
 * Data-access-layer auth checks. The proxy only does an optimistic cookie
 * check; every page and Server Action calls one of these itself.
 */
export async function getAgentSession(): Promise<AgentSession | null> {
  const token = (await cookies()).get(AGENT_COOKIE)?.value;
  return decodeSession(token, getEnv().APP_SECRET);
}

/** For pages: redirects to sign-in when there's no valid session. */
export async function requireAgent(nextPath = "/dashboard"): Promise<AgentSession> {
  const session = await getAgentSession();
  if (!session) redirect(`/agent/sign-in?next=${encodeURIComponent(nextPath)}`);
  return session;
}

export async function startAgentSession(name: DemoAgent): Promise<void> {
  const env = getEnv();
  (await cookies()).set(AGENT_COOKIE, encodeSession(name, env.APP_SECRET), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAgentSession(): Promise<void> {
  (await cookies()).delete(AGENT_COOKIE);
}
