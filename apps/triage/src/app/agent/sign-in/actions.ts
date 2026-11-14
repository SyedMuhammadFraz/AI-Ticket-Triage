"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { safeNextPath } from "@/lib/auth/redirect";
import { startAgentSession } from "@/lib/auth/session";
import { passcodeMatches } from "@/lib/auth/session-token";
import { getDb } from "@/lib/db";
import { auditEvents } from "@/lib/db/schema";
import { DEMO_AGENTS } from "@/lib/domain";
import { getEnv } from "@/lib/env";
import { clientIp } from "@/lib/request";
import { hashIp } from "@/lib/tickets/intake";

export type SignInState = { error: string | null };

const MAX_FAILURES = 10;
const FAILURE_WINDOW = sql`now() - interval '15 minutes'`;

const signInSchema = z.object({
  agent: z.enum(DEMO_AGENTS),
  passcode: z.string().max(200).optional(),
  next: z.string().max(500).optional(),
});

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    agent: formData.get("agent"),
    passcode: formData.get("passcode") ?? undefined,
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Choose an agent to continue." };

  const env = getEnv();
  const db = getDb();

  if (env.AGENT_PASSCODE) {
    const ipHash = hashIp(clientIp(await headers()), env.APP_SECRET);
    const failures = await db.$count(
      auditEvents,
      and(
        eq(auditEvents.action, "agent.sign_in_failed"),
        sql`${auditEvents.details} ->> 'ipHash' = ${ipHash}`,
        gt(auditEvents.createdAt, FAILURE_WINDOW),
      ),
    );
    if (failures >= MAX_FAILURES) {
      return { error: "Too many failed attempts. Please wait 15 minutes and try again." };
    }
    if (!passcodeMatches(parsed.data.passcode ?? "", env.AGENT_PASSCODE)) {
      await recordAudit(db, {
        ticketId: null,
        actorType: "system",
        actor: "auth",
        action: "agent.sign_in_failed",
        details: { ipHash },
      });
      return { error: "That passcode isn't right." };
    }
  }

  await startAgentSession(parsed.data.agent);
  await recordAudit(db, { ticketId: null, actorType: "agent", actor: parsed.data.agent, action: "agent.signed_in" });
  redirect(safeNextPath(parsed.data.next));
}
