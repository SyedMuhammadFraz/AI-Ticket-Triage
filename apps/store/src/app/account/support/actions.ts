"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEnv, supportConfigured } from "@/lib/env";
import { syncPendingSupportTickets } from "@/lib/support/run";
import { createRemoteTicket } from "@/lib/support/triage-client";
import { createSupportTicket, SupportError, supportRequestSchema, syncSupportTicket } from "@/lib/support/tickets";

export type SupportFormState = {
  error: string | null;
  fieldErrors?: Partial<Record<"subject" | "body" | "orderNumber", string[]>>;
};

export async function submitSupportRequest(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again to contact support." };
  if (!supportConfigured(getEnv())) return { error: "Support is temporarily unavailable. Please try again later." };

  const parsed = supportRequestSchema.safeParse({
    orderNumber: formData.get("orderNumber") ?? "",
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const db = getDb();
  let number: number;
  try {
    const ticket = await createSupportTicket(db, user, parsed.data);
    number = ticket.number;
    // Send it now; if Triage Desk is unreachable the request is kept and retried — the buyer isn't blocked.
    const synced = await syncSupportTicket(db, ticket.id, {
      createRemote: createRemoteTicket,
      company: user.company,
      buyer: { name: user.name, email: user.email },
    });
    if (!synced) after(() => syncPendingSupportTickets().then(() => undefined));
  } catch (err) {
    if (err instanceof SupportError) return { error: err.message };
    console.error("[support] could not create request:", err);
    return { error: "We couldn't send your request. Please try again." };
  }
  redirect(`/account/support/${number}?sent=1`);
}
