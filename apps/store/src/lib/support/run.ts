import "server-only";
import { getDb } from "@/lib/db";
import { getEnv, supportConfigured } from "@/lib/env";
import { companies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pendingSyncTickets, syncSupportTicket } from "./tickets";
import { createRemoteTicket } from "./triage-client";

/** Retries requests that haven't reached Triage Desk yet (e.g. it was down when they were sent). */
export async function syncPendingSupportTickets(): Promise<{ synced: number; failed: number }> {
  if (!supportConfigured(getEnv())) return { synced: 0, failed: 0 };
  const db = getDb();
  let synced = 0;
  let failed = 0;
  for (const { ticket, buyerName, buyerEmail } of await pendingSyncTickets(db)) {
    const [company] = await db.select().from(companies).where(eq(companies.id, ticket.companyId));
    if (!company) continue;
    const ok = await syncSupportTicket(db, ticket.id, {
      createRemote: createRemoteTicket,
      company,
      buyer: { name: buyerName, email: buyerEmail },
    });
    if (ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}
