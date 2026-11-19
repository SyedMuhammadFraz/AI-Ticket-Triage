"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { endSession, startSession } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/session-token";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

/** Demo sign-in: pick one of the fictional business buyers. The id is checked against the database. */
export async function signIn(formData: FormData): Promise<void> {
  const parsed = z.object({ userId: z.uuid(), next: z.string().max(300).optional() }).safeParse({
    userId: formData.get("userId"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) redirect("/sign-in?error=1");

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, parsed.data.userId));
  if (!user) redirect("/sign-in?error=1");

  await startSession(user.id);
  redirect(safeNextPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/");
}
